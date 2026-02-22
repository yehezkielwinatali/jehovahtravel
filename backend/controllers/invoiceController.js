import mongoose from "mongoose";
import Invoice from "../models/invoiceModel.js";
import { getAuth } from "@clerk/express";
import path from "path";
import { generateInvoiceNumber } from "../utils/generateInvoiceNumber.js";
import ExcelJS from "exceljs";

const API_BASE_URL = "http://localhost:4000";

const isObjectIdString = (id) => mongoose.Types.ObjectId.isValid(id);

function getTodayLocal() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/* ===============================
   COMPUTE TOTALS
=================================*/
function computeTotals(items = [], downPayment = 0) {
  const safe = Array.isArray(items) ? items.filter(Boolean) : [];
  const subtotal = safe.reduce((sum, item) => {
    return sum + Number(item.qty || 0) * Number(item.unitPrice || 0);
  }, 0);

  const totalNta = safe.reduce((sum, item) => {
    return sum + Number(item.qty || 0) * Number(item.nta || 0);
  }, 0);

  const dp = Number(downPayment) || 0;
  const total = Math.max(subtotal - dp, 0);
  const profit = subtotal - totalNta;

  return { subtotal, downPayment: dp, total, totalNta, profit };
}

/* ===============================
   PARSE ITEMS & FILE HELPERS (Tetap sama)
=================================*/
function parseItemsField(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return [];
    }
  }
  return [];
}

function uploadedFilesToUrls(req) {
  const urls = {};
  if (!req.files) return urls;
  const mapping = {
    logoName: "logoDataUrl",
    stampName: "stampDataUrl",
    logo: "logoDataUrl",
    stamp: "stampDataUrl",
  };
  Object.keys(mapping).forEach((field) => {
    const arr = req.files[field];
    if (Array.isArray(arr) && arr[0]) {
      const filename =
        arr[0].filename || (arr[0].path && path.basename(arr[0].path));
      if (filename) {
        urls[mapping[field]] = `${API_BASE_URL}/uploads/${filename}`;
      }
    }
  });
  return urls;
}

/* ===============================
   CONTROLLERS
=================================*/

export async function createInvoice(req, res) {
  try {
    const { userId } = getAuth(req) || {};
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const body = req.body || {};

    const items = parseItemsField(body.items);

    // ⬇️ TAMBAHKAN LOG DI SINI ⬇️
    console.log("--- DEBUG SIMPAN BARU ---");
    console.log("Isi Items dari Frontend:", JSON.stringify(items, null, 2));
    const totals = computeTotals(items, body.downPayment);
    const fileUrls = uploadedFilesToUrls(req);

    // ✅ Tentukan tanggal dulu
    const issueDate = body.issueDate || getTodayLocal();

    // ✅ Generate nomor berdasarkan issueDate yang sama
    const invoiceNumber = await generateInvoiceNumber(userId, issueDate);

    const invoice = await Invoice.create({
      owner: userId,
      invoiceNumber,
      issueDate,
      dueDate: body.dueDate || "",
      fromBusinessName: body.fromBusinessName || "",
      fromEmail: body.fromEmail || "",
      fromAddress: body.fromAddress || "",
      fromPhone: body.fromPhone || "",
      client: body.client || {},
      items,
      subtotal: totals.subtotal,
      downPayment: totals.downPayment,
      totalNta: totals.totalNta, // TAMBAHKAN INI
      profit: totals.profit,
      total: totals.total,
      currency: body.currency || "IDR",
      status: body.status || "draft",
      signatureName: body.signatureName || "",
      signatureTitle: body.signatureTitle || "",
      ...fileUrls,
    });

    return res.status(201).json(invoice);
  } catch (err) {
    console.error("createInvoice error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function getInvoices(req, res) {
  try {
    const { userId } = getAuth(req) || {};
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const q = { owner: userId };

    // Filter status & invoiceNumber jika ada
    if (req.query.status) q.status = req.query.status;
    if (req.query.invoiceNumber) q.invoiceNumber = req.query.invoiceNumber;

    // Di dalam export async function getInvoices(req, res)
    if (req.query.search) {
      const search = req.query.search.trim();
      // Membersihkan input dari karakter regex khusus agar tidak crash
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = { $regex: safeSearch, $options: "i" };

      q.$or = [
        { invoiceNumber: searchRegex },
        { "client.name": searchRegex },
        { fromEmail: searchRegex },
        // ⬇️ INI KUNCINYA UNTUK MENCARI DI DALAM TABEL ⬇️
        { "items.name": searchRegex }, // Mencari "BUDIANTO"
        { "items.description": searchRegex }, // Mencari "SQ123"
      ];
    }

    // Eksekusi Query
    const invoices = await Invoice.find(q).sort({ createdAt: -1 }).lean();

    return res.status(200).json({ success: true, data: invoices });
  } catch (err) {
    console.error("Search Error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function getInvoiceById(req, res) {
  try {
    const { userId } = getAuth(req) || {};
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;
    let inv;
    if (isObjectIdString(id)) {
      inv = await Invoice.findById(id);
    } else {
      inv = await Invoice.findOne({ invoiceNumber: id, owner: userId });
    }

    if (!inv)
      return res
        .status(404)
        .json({ success: false, message: "Invoice not found" });
    if (inv.owner && String(inv.owner) !== String(userId)) {
      return res
        .status(403)
        .json({ success: false, message: "Not your invoice" });
    }
    return res.status(200).json({ success: true, data: inv });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function updateInvoice(req, res) {
  try {
    const { userId } = getAuth(req) || {};
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;
    const body = req.body || {};

    const query = isObjectIdString(id)
      ? { _id: id, owner: userId }
      : { invoiceNumber: id, owner: userId };

    const existing = await Invoice.findOne(query);
    if (!existing)
      return res
        .status(404)
        .json({ success: false, message: "Invoice not found" });

    // 1. Tentukan nilai item dan DP (Gunakan data lama jika data baru kosong)
    const items =
      body.items !== undefined ? parseItemsField(body.items) : existing.items;
    const dp =
      body.downPayment !== undefined ? body.downPayment : existing.downPayment;

    console.log("--- DEBUG UPDATE INVOICE ---");
    console.log("Items yang masuk ke DB:", JSON.stringify(items, null, 2));

    // 2. Validasi duplikasi nomor invoice
    if (
      body.invoiceNumber &&
      String(body.invoiceNumber).trim() !== existing.invoiceNumber
    ) {
      const conflict = await Invoice.findOne({
        invoiceNumber: String(body.invoiceNumber).trim(),
        owner: userId, // Tambahkan owner agar pengecekan lebih spesifik
      });
      if (conflict && String(conflict._id) !== String(existing._id)) {
        return res
          .status(409)
          .json({ success: false, message: "Invoice number already exists" });
      }
    }

    // 3. Hitung total menggunakan variabel 'dp' yang sudah kita amankan tadi
    const totals = computeTotals(items, dp);
    const fileUrls = uploadedFilesToUrls(req);

    const update = {
      invoiceNumber: body.invoiceNumber,
      issueDate: body.issueDate,
      dueDate: body.dueDate,
      fromBusinessName: body.fromBusinessName,
      fromEmail: body.fromEmail,
      fromAddress: body.fromAddress,
      fromPhone: body.fromPhone,
      fromGst: body.fromGst,
      client: body.client || existing.client,
      items,
      subtotal: totals.subtotal,
      total: totals.total,
      downPayment: totals.downPayment, // Gunakan hasil dari computeTotals
      totalNta: totals.totalNta, // TAMBAHKAN INI
      profit: totals.profit,
      currency: body.currency,
      status: body.status ? String(body.status).toLowerCase() : undefined,
      logoDataUrl: fileUrls.logoDataUrl || body.logoDataUrl || undefined,
      stampDataUrl: fileUrls.stampDataUrl || body.stampDataUrl || undefined,
      signatureDataUrl:
        fileUrls.signatureDataUrl || body.signatureDataUrl || undefined,
      signatureName: body.signatureName,
      signatureTitle: body.signatureTitle,
    };

    // Bersihkan field yang undefined
    Object.keys(update).forEach(
      (key) => update[key] === undefined && delete update[key],
    );

    const updated = await Invoice.findOneAndUpdate(
      { _id: existing._id, owner: userId }, // Tambahkan owner untuk extra security
      { $set: update },
      { returnDocument: "after", runValidators: true },
    );

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error("updateInvoice error:", err); // Tambahkan log error agar mudah debug
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function deleteInvoice(req, res) {
  try {
    const { userId } = getAuth(req) || {};
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;

    // 🔥 Gunakan helper isObjectIdString
    const query = isObjectIdString(id)
      ? { _id: id, owner: userId }
      : { invoiceNumber: id, owner: userId };

    const found = await Invoice.findOne(query);
    if (!found)
      return res
        .status(404)
        .json({ success: false, message: "Invoice not found" });

    await Invoice.deleteOne({ _id: found._id });
    return res
      .status(200)
      .json({ success: true, message: "Invoice deleted successfully" });
  } catch (err) {
    console.error("deleteInvoice error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export const exportInvoicesToExcel = async (req, res) => {
  try {
    const { month, year } = req.query;
    const { userId: owner } = getAuth(req) || {};

    const m = String(month).padStart(2, "0");
    const startStr = `${year}-${m}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endStr = `${year}-${m}-${String(lastDay).padStart(2, "0")}`;

    const invoices = await Invoice.find({
      owner,
      issueDate: { $gte: startStr, $lte: endStr },
    }).sort({ issueDate: 1 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Rekap Invoice");

    worksheet.columns = [
      { header: "No. Invoice", key: "invoiceNumber", width: 20 },
      { header: "Tanggal", key: "issueDate", width: 15 },
      { header: "Nama Client", key: "clientName", width: 25 },
      { header: "Nama Penumpang", key: "passengerName", width: 25 },
      { header: "Keterangan", key: "description", width: 30 },
      { header: "Total", key: "total", width: 18 },
      { header: "Total NTA (Modal)", key: "totalNta", width: 15 }, // Baru
      { header: "Profit", key: "profit", width: 15 },
      { header: "Status", key: "status", width: 15 },
    ];

    // Penampung Statistik
    let totalOmzet = 0;
    let omzetLunas = 0;
    let omzetPiutang = 0;
    let grandTotalNta = 0;
    let grandTotalProfit = 0;

    let countPaid = 0;
    let countUnpaid = 0;
    let countOverdue = 0;

    const today = getTodayLocal();

    // 1. Masukkan Data Detail
    invoices.forEach((inv) => {
      const passengerNames = inv.items.map((item) => item.name).join(", ");
      const descriptions = inv.items.map((item) => item.description).join(", ");
      const nilaiTotal = Number(inv.total || 0);
      const nilaiNta = Number(inv.totalNta || 0); // AMBIL DARI DB
      const nilaiProfit = Number(inv.profit || 0); // AMBIL DARI DB

      totalOmzet += nilaiTotal;
      grandTotalNta += nilaiNta;
      grandTotalProfit += nilaiProfit;
      // Logika Hitung Status & Nominal
      const statusLower = (inv.status || "").toLowerCase();

      if (statusLower === "paid") {
        omzetLunas += nilaiTotal;
        countPaid++;
      } else {
        omzetPiutang += nilaiTotal;
        // Cek apakah overdue (jika bukan paid dan melewati dueDate)
        if (inv.dueDate && inv.dueDate < today) {
          countOverdue++;
        } else {
          countUnpaid++;
        }
      }

      worksheet.addRow({
        invoiceNumber: inv.invoiceNumber,
        issueDate: inv.issueDate,
        clientName: inv.client?.name || "-",
        passengerName: passengerNames || "-",
        description: descriptions || "-",
        total: nilaiTotal,
        totalNta: nilaiNta, // ISI NILAINYA
        profit: nilaiProfit, // ISI NILAINYA
        status: statusLower.toUpperCase(),
      });
    });

    // --- ⬇️ RINGKASAN DI BAWAH TABEL ⬇️ ---
    worksheet.addRow([]); // Baris Kosong

    // Fungsi helper untuk styling baris ringkasan
    const addSummaryRow = (
      label,
      value,
      isCurrency = true,
      color = "000000",
    ) => {
      const row = worksheet.addRow({ description: label, total: value });
      row.font = { bold: true };
      if (isCurrency) row.getCell("total").numFmt = "#,##0";
      row.getCell("description").font = { bold: true, color: { argb: color } };
      row.eachCell((c) => {
        c.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFE0" },
        };
      });
      return row;
    };

    addSummaryRow("TOTAL INVOICE (LEMBAR)", invoices.length, false);
    addSummaryRow("TOTAL PAID (LUNAS)", countPaid, false, "006400");
    addSummaryRow("TOTAL UNPAID (BELUM BAYAR)", countUnpaid, false, "0000FF");
    addSummaryRow("TOTAL OVERDUE (TELAT)", countOverdue, false, "FF0000");
    addSummaryRow("TOTAL MODAL (NTA)", grandTotalNta, true, "E67E22"); // Warna Orange
    addSummaryRow("TOTAL PROFIT BERSIH", grandTotalProfit, true, "006400"); // Warna Hijau

    worksheet.addRow([]); // Baris Kosong Lagi

    addSummaryRow("TOTAL OMZET KESELURUHAN", totalOmzet, true);
    addSummaryRow("TOTAL DIBAYAR (CASH IN)", omzetLunas, true, "006400");
    addSummaryRow("TOTAL PIUTANG (PENDING)", omzetPiutang, true, "FF0000");

    // Header Bold
    worksheet.getRow(1).font = { bold: true };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Rekap_${month}_${year}.xlsx`,
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Export Error:", error);
    res.status(500).json({ message: "Gagal export excel" });
  }
};
