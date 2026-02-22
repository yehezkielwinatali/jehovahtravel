import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import logo from "../assets/logo.png";
import stamp from "../assets/stamp.png";
import { invoicePreviewStyles } from "../assets/dummyStyles";

// Konfigurasi API tetap sama
const API_BASE = "http://localhost:4000";
const PROFILE_ENDPOINT = `${API_BASE}/api/businessProfile/me`;
const INVOICE_ENDPOINT = (id) => `${API_BASE}/api/invoice/${id}`;
const EditIcon = ({ className = "w-4 h-4" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

// --- Helper Functions (Tetap dipertahankan dari kode lama kamu) ---
function resolveImageUrl(url) {
  if (!url) return null;
  const s = String(url).trim();
  if (s.startsWith("data:")) return s;
  if (/localhost|127\.0\.0\.1/.test(s)) {
    const path = s.replace(/^https?:\/\/[^/]+/, "");
    return `${API_BASE.replace(/\/+$/, "")}${path}`;
  }
  if (/^https?:\/\//i.test(s)) return s;
  return `${API_BASE.replace(/\/+$/, "")}/${s.replace(/^\/+/, "")}`;
}

function currencyFmt(amount = 0) {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateInput) {
  if (!dateInput) return "—";

  if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [year, month, day] = dateInput.split("-");
    const d = new Date(Number(year), Number(month) - 1, Number(day));

    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  const d = new Date(dateInput);

  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// --- Main Component ---
export default function InvoicePreview() {
  const { id } = useParams();
  const loc = useLocation();
  const navigate = useNavigate();
  const { getToken } = useAuth();

  const [invoice, setInvoice] = useState(loc?.state?.invoice ?? null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch Data (Logika dari file asli kamu)
  useEffect(() => {
    async function fetchData() {
      try {
        const token = await getToken();
        const headers = { Authorization: `Bearer ${token}` };

        // Fetch Profile & Invoice secara paralel
        const [profileRes, invoiceRes] = await Promise.all([
          fetch(PROFILE_ENDPOINT, { headers }),
          fetch(INVOICE_ENDPOINT(id), { headers }),
        ]);

        const profileJson = await profileRes.json();
        const invoiceJson = await invoiceRes.json();

        setProfile(profileJson?.data ?? profileJson);
        setInvoice(invoiceJson?.data ?? invoiceJson);
      } catch (err) {
        console.error("Error fetching data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id, getToken]);

  const handlePrint = () => window.print();

  if (loading)
    return <div className="p-10 text-center">Loading Invoice...</div>;
  if (!invoice)
    return (
      <div className="p-10 text-center text-red-500">Invoice not found.</div>
    );

  // Pastikan variabel ini dihitung tepat sebelum return
  // Di bagian atas sebelum return JSX
  const items = invoice?.items || [];
  const subtotal = items.reduce((acc, item) => {
    // Kita cek apakah properti namanya 'qty' atau 'quantity'
    const q = Number(item.qty || item.quantity || 0);
    const p = Number(item.unitPrice || 0);
    return acc + q * p;
  }, 0);

  const downPayment = Number(invoice?.downPayment || 0);
  const total = Number(invoice?.total ?? subtotal - downPayment);

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 no-print-bg">
      {/* Tombol Navigasi & Print */}
      <div className="max-w-[21cm] mx-auto mb-6 flex justify-between no-print">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-600 flex items-center gap-2 hover:underline"
        >
          ← Kembali
        </button>
        <div className="flex gap-3">
          <button
            onClick={() =>
              navigate(`/app/invoices/${invoice.id}/edit`, {
                state: { invoice },
              })
            }
            className={invoicePreviewStyles.editInvoiceButton}
          >
            <EditIcon className="w-4 h-4" /> Edit Invoice
          </button>
          <button
            onClick={handlePrint}
            className="bg-black text-white px-6 py-2 rounded shadow hover:bg-gray-800 transition flex items-center gap-2"
          >
            Cetak Invoice
          </button>
        </div>
      </div>

      {/* --- START AREA DESAIN JEHOVAH --- */}
      <div className="print-preview-container text-black" id="print-area">
        {/* Header: Logo & Alamat */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-5">
            <img
              src={logo}
              alt="Logo Perusahaan"
              className="h-full w-60 object-contain"
            />
            <div>
              <h1 className="text-2xl font-bold leading-tight">
                Jehovah Tour & Travel
              </h1>
              <p className="text-[11px] leading-tight mt-1">
                Jl. Darmo Permai Timur 5/20, Surabaya
              </p>
              <p className="text-[11px] leading-tight">
                Email : sub_jehovah@yahoo.com
              </p>
            </div>
          </div>
        </div>

        <div className="text-right mb-1">
          <h2 className="text-xl font-bold tracking-[0.3em] uppercase">
            Invoice
          </h2>
        </div>

        {/* Info Grid (Kepada & Info Invoice) */}
        <div className="grid grid-cols-2 border-t-2 border-black pt-2">
          <div className="border-r border-black pr-4 min-h-22.5 relative">
            <p className="text-[10px] italic">Kepada :</p>
            <p className="font-bold text-sm uppercase">
              {invoice.client?.name || "YULLI"}
            </p>

            <div className="absolute bottom-1 w-full pr-8 flex justify-between text-[10px]">
              <span>{formatDate(invoice.dueDate)}</span>
              <span>Tgl. Jatuh Tempo</span>
            </div>
          </div>

          <div className="grid grid-cols-2 text-[10px]">
            <div className="border-b border-r border-black p-1.5">
              <p className="italic">Tanggal</p>
              <p className="font-bold">{formatDate(invoice.issueDate)}</p>
            </div>
            <div className="border-b border-black p-1.5">
              <p className="italic">Nomor</p>
              <p className="font-bold">{invoice.invoiceNumber || id}</p>
            </div>
          </div>
        </div>

        {/* Table Produk */}
        {/* Table Produk */}
        <table className="w-full border-collapse border-2 border-black mt-4 text-[11px]">
          <thead>
            <tr className="border-b-2 border-black bg-gray-50">
              <th className="border-r border-black p-1.5 text-left w-[30%]">
                Nama
              </th>
              <th className="border-r border-black p-1.5 text-left w-[35%]">
                Keterangan
              </th>
              <th className="border-r border-black p-1.5 text-center w-[8%]">
                Kts.
              </th>
              <th className="border-r border-black p-1.5 text-right w-[12%]">
                @Harga
              </th>
              <th className="p-1.5 text-right w-[15%]">Total Harga</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-b border-black">
                <td className="border-r border-black p-1.5 align-top uppercase font-medium">
                  {item.name || "—"}
                </td>
                <td className="border-r border-black p-1.5 align-top text-[10px]">
                  {item.description || "—"}
                </td>
                <td className="border-r border-black p-1.5 text-center align-top">
                  {item.qty}
                </td>
                <td className="border-r border-black p-1.5 text-right align-top">
                  {currencyFmt(item.unitPrice)}
                </td>
                <td className="p-1.5 text-right align-top font-semibold">
                  {currencyFmt(item.qty * item.unitPrice)}
                </td>
              </tr>
            ))}

            {/* Baris Kosong Penyeimbang (Optional) */}
            {items.length < 3 && (
              <tr className="h-10 border-b border-black">
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td></td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Bagian Perhitungan - Diletakkan di luar table agar penempatan bebas */}
        <div className="flex justify-end mt-2">
          <div className="w-[40%] text-[11px]">
            <div className="flex justify-between p-1.5 border-b border-black">
              <span className="italic">Subtotal</span>
              <span>{currencyFmt(subtotal)}</span>
            </div>
            <div className="flex justify-between p-1.5 border-b border-black">
              <span className="italic">Uang Muka (DP)</span>
              <span className="text-red-600">{currencyFmt(downPayment)}</span>
            </div>
            <div className="flex justify-between p-1.5 border-2 border-black mt-1 font-bold bg-gray-100 uppercase text-xs">
              <span>Total</span>
              <span>{currencyFmt(total)}</span>
            </div>
          </div>
        </div>

        {/* Tanda Tangan & Stamp */}
        <div className="flex justify-around mt-12 text-[11px] relative">
          <div className="text-center">
            <p>Disiapkan Oleh</p>

            <div className="mt-10">
              <p className="font-bold mb-2">{invoice.signatureName}</p>
            </div>

            <div className="border-t border-black w-32 mx-auto"></div>
          </div>

          {/* Stamp di tengah (jika ada) */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 ml-4">
            <img src={stamp} className="h-30 w-auto" alt="Stamp" />
          </div>

          <div className="text-center">
            <p>Disetujui Oleh</p>

            <div className="mt-10">
              <p className="font-bold mb-2">{invoice.signatureTitle}</p>
            </div>

            <div className="border-t border-black w-32 mx-auto"></div>
          </div>
        </div>
      </div>
      {/* --- END AREA DESAIN JEHOVAH --- */}
    </div>
  );
}
