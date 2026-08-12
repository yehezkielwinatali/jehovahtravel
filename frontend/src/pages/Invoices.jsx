import React, { useMemo, useState, useEffect, useCallback } from "react";
import StatusBadge from "../components/StatusBadge";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import {
  Search,
  Filter,
  Plus,
  Eye,
  Trash2,
  RotateCcw,
  RefreshCw,
  Download,
  X,
  Inbox,
  AlertTriangle,
  FileText,
  CheckCircle2,
  Clock,
  CircleDashed,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_REACT_APP_BACKEND_URL;

/* ---------- helpers (unchanged logic) ---------- */

function resolveImageUrl(url) {
  if (!url) return null;
  const s = String(url).trim();

  if (s.startsWith("data:") || s.startsWith("blob:")) return s;

  if (/^https?:\/\//i.test(s)) {
    try {
      const parsed = new URL(s);
      if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
        const path =
          parsed.pathname + (parsed.search || "") + (parsed.hash || "");
        return `${API_BASE.replace(/\/+$/, "")}${path}`;
      }
      return parsed.href;
    } catch (e) {
      // fall through to relative handling
    }
  }

  return `${API_BASE.replace(/\/+$/, "")}/${s.replace(/^\/+/, "")}`;
}

function normalizeInvoiceFromServer(inv = {}) {
  const id = inv.invoiceNumber || inv.id || inv._id || String(inv._id || "");
  const amount = inv.total ?? inv.subtotal ?? 0;
  const status = inv.status ?? inv.statusLabel ?? "Draft";

  const logo = resolveImageUrl(
    inv.logoDataUrl ?? inv.logoUrl ?? inv.logo ?? null,
  );
  const stamp = resolveImageUrl(
    inv.stampDataUrl ?? inv.stampUrl ?? inv.stamp ?? null,
  );
  const signature = resolveImageUrl(
    inv.signatureDataUrl ?? inv.signatureUrl ?? inv.signature ?? null,
  );

  return { ...inv, id, amount, status, logo, stamp, signature };
}

function normalizeClient(raw) {
  if (!raw) return { name: "", email: "", address: "", phone: "" };
  if (typeof raw === "string")
    return { name: raw, email: "", address: "", phone: "" };
  if (typeof raw === "object") {
    return {
      name: raw.name ?? raw.company ?? raw.client ?? "",
      email: raw.email ?? raw.emailAddress ?? "",
      address: raw.address ?? "",
      phone: raw.phone ?? raw.contact ?? "",
    };
  }
  return { name: "", email: "", address: "", phone: "" };
}

function formatCurrency(amount = 0, currency = "INR") {
  try {
    if (currency === "INR") {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
      }).format(amount);
    }
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

function formatDate(dateInput) {
  if (!dateInput) return "—";
  const d = dateInput instanceof Date ? dateInput : new Date(String(dateInput));
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/* ---------- small UI pieces ---------- */

function SortIcon({ active, direction }) {
  if (!active) return <ChevronsUpDown className="h-3.5 w-3.5 text-slate-300" />;
  return direction === "asc" ? (
    <ArrowUp className="h-3.5 w-3.5 text-indigo-600" />
  ) : (
    <ArrowDown className="h-3.5 w-3.5 text-indigo-600" />
  );
}

function StatCard({ label, value, icon: Icon, accent }) {
  const accentMap = {
    indigo: {
      bg: "bg-indigo-50",
      ring: "ring-indigo-100",
      text: "text-indigo-600",
    },
    emerald: {
      bg: "bg-emerald-50",
      ring: "ring-emerald-100",
      text: "text-emerald-600",
    },
    amber: {
      bg: "bg-amber-50",
      ring: "ring-amber-100",
      text: "text-amber-600",
    },
    slate: {
      bg: "bg-slate-100",
      ring: "ring-slate-200",
      text: "text-slate-500",
    },
  };
  const a = accentMap[accent] || accentMap.indigo;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${a.bg} ring-1 ring-inset ${a.ring}`}
      >
        <Icon className={`h-5 w-5 ${a.text}`} strokeWidth={2} />
      </div>
      <div>
        <div className="text-xl font-bold tracking-tight text-slate-900">
          {value}
        </div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 rounded-full bg-slate-100 animate-pulse" />
          <div className="space-y-2">
            <div className="h-3 w-32 rounded bg-slate-100 animate-pulse" />
            <div className="h-2.5 w-20 rounded bg-slate-100 animate-pulse" />
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        <div className="h-3 w-20 rounded bg-slate-100 animate-pulse" />
      </td>
      <td className="px-5 py-4">
        <div className="h-6 w-16 rounded-full bg-slate-100 animate-pulse" />
      </td>
      <td className="px-5 py-4">
        <div className="h-3 w-16 rounded bg-slate-100 animate-pulse" />
      </td>
      <td className="px-5 py-4">
        <div className="ml-auto h-7 w-20 rounded-lg bg-slate-100 animate-pulse" />
      </td>
    </tr>
  );
}

/* ---------- Pagination ---------- */

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row">
      <div className="text-xs text-slate-500">
        Page <span className="font-medium text-slate-700">{page}</span> of{" "}
        <span className="font-medium text-slate-700">{totalPages}</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        >
          Previous
        </button>
        <div className="flex items-center gap-1">
          {pages.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={`h-7 w-7 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${
                p === page
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        >
          Next
        </button>
      </div>
    </div>
  );
}

/* ---------- Component ---------- */

export default function InvoicesPage() {
  const navigate = useNavigate();
  const { getToken, isSignedIn } = useAuth();

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDate, setExportDate] = useState({
    mode: "month",
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    startDate: "",
    endDate: "",
  });

  const obtainToken = useCallback(async () => {
    if (typeof getToken !== "function") return null;
    try {
      let token = await getToken({ template: "default" }).catch(() => null);
      if (!token)
        token = await getToken({ forceRefresh: true }).catch(() => null);
      return token;
    } catch {
      return null;
    }
  }, [getToken]);

  const handleDownload = async () => {
    const token = await obtainToken();
    try {
      let url = `${API_BASE}/api/invoice/export/excel`;
      if (exportDate.mode === "month") {
        url += `?month=${exportDate.month}&year=${exportDate.year}`;
      } else {
        url += `?startDate=${exportDate.startDate}&endDate=${exportDate.endDate}`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Gagal download");

      const blob = await res.blob();
      const fileUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = fileUrl;
      a.download = "Rekap_Invoice.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();

      setShowExportModal(false);
    } catch (err) {
      alert("Gagal mendownload rekapan.");
    }
  };

  const [allInvoices, setAllInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [perPage, setPerPage] = useState(6);
  const [sortBy, setSortBy] = useState({ key: "issueDate", dir: "desc" });
  const [page, setPage] = useState(1);

  const fetchInvoices = useCallback(async () => {
    if (!isSignedIn) return;

    setLoading(true);
    try {
      const token = await obtainToken();
      if (!token) return;

      const res = await fetch(`${API_BASE}/api/invoice`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        console.warn("Session expired");
        setError("unauthorized: session expired, please sign in again.");
        return;
      }

      const json = await res.json().catch(() => null);
      if (res.ok) {
        const raw = json?.data || [];
        const mapped = raw.map(normalizeInvoiceFromServer);
        setAllInvoices(mapped);
        setError(null);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Failed to load invoices.");
    } finally {
      setLoading(false);
    }
  }, [obtainToken, isSignedIn]);

  useEffect(() => {
    if (isSignedIn) fetchInvoices();
  }, [isSignedIn, fetchInvoices]);

  const filtered = useMemo(() => {
    let arr = Array.isArray(allInvoices) ? allInvoices.slice() : [];

    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter((i) => {
        const client = normalizeClient(i.client);
        const hasMatchingItemName = i.items?.some(
          (item) => item.name && item.name.toLowerCase().includes(q),
        );
        const hasMatchingDescription = i.items?.some(
          (item) =>
            item.description && item.description.toLowerCase().includes(q),
        );
        return (
          (client.name && client.name.toLowerCase().includes(q)) ||
          (i.id && i.id.toLowerCase().includes(q)) ||
          String(i.email || "")
            .toLowerCase()
            .includes(q) ||
          String(i.company || "")
            .toLowerCase()
            .includes(q) ||
          hasMatchingItemName ||
          hasMatchingDescription
        );
      });
    }

    if (status !== "all")
      arr = arr.filter(
        (i) =>
          (i.status || "").toString().toLowerCase() ===
          status.toString().toLowerCase(),
      );

    if (from || to) {
      arr = arr.filter((i) => {
        const d = new Date(i.issueDate || i.date || i.createdAt).setHours(
          0,
          0,
          0,
          0,
        );
        if (from) {
          const f = new Date(from).setHours(0, 0, 0, 0);
          if (d < f) return false;
        }
        if (to) {
          const t = new Date(to).setHours(23, 59, 59, 999);
          if (d > t) return false;
        }
        return true;
      });
    }

    arr.sort((a, b) => {
      const ak = a[sortBy.key];
      const bk = b[sortBy.key];

      if (typeof ak === "number" && typeof bk === "number")
        return sortBy.dir === "asc" ? ak - bk : bk - ak;

      const ad = Date.parse(ak || a.issueDate || a.dueDate || "");
      const bd = Date.parse(bk || b.issueDate || b.dueDate || "");
      if (!isNaN(ad) && !isNaN(bd))
        return sortBy.dir === "asc" ? ad - bd : bd - ad;

      const as = (ak || "").toString().toLowerCase();
      const bs = (bk || "").toString().toLowerCase();
      if (as < bs) return sortBy.dir === "asc" ? -1 : 1;
      if (as > bs) return sortBy.dir === "asc" ? 1 : -1;
      return 0;
    });

    return arr;
  }, [allInvoices, search, status, from, to, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const startIndex = (page - 1) * perPage;
  const pageData = filtered.slice(startIndex, startIndex + perPage);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages]);

  function handleSort(key) {
    setSortBy((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }

  function openInvoice(inv) {
    const found = allInvoices.find((x) => x && x.id === inv.id) || inv;
    navigate(`/app/invoices/${inv.id}/preview`, { state: { invoice: found } });
  }

  async function handleDeleteInvoice(inv) {
    const targetId = inv._id || inv.id;
    if (!targetId) return;
    if (!confirm(`Delete invoice ${inv.invoiceNumber || targetId}?`)) return;

    try {
      const token = await obtainToken();
      if (!token) return navigate("/login");

      const res = await fetch(
        `${API_BASE}/api/invoice/${encodeURIComponent(targetId)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (res.ok) {
        setAllInvoices((prev) =>
          prev.filter((item) => item._id !== targetId && item.id !== targetId),
        );
      } else {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message || "Delete failed");
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert(err.message);
    }
  }

  const getClientInitial = (client) => {
    const c = normalizeClient(client);
    return c.name ? c.name.charAt(0).toUpperCase() : "C";
  };

  const sortableHeader = (key, label) => (
    <th
      onClick={() => handleSort(key)}
      className="cursor-pointer select-none px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-slate-400 transition-colors hover:text-slate-600"
    >
      <div className="flex items-center gap-1.5">
        {label}
        <SortIcon active={sortBy.key === key} direction={sortBy.dir} />
      </div>
    </th>
  );

  return (
    <div className="w-full font-[Inter] text-slate-700">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');`}</style>

      {/* Export modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                Export Rekapan
              </h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium text-slate-500">
                Mode
              </label>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                value={exportDate.mode}
                onChange={(e) =>
                  setExportDate({ ...exportDate, mode: e.target.value })
                }
              >
                <option value="month">Per Bulan</option>
                <option value="range">Custom Tanggal</option>
              </select>
            </div>

            {exportDate.mode === "month" ? (
              <>
                <div className="mb-4">
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">
                    Bulan
                  </label>
                  <select
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                    value={exportDate.month}
                    onChange={(e) =>
                      setExportDate({ ...exportDate, month: e.target.value })
                    }
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {new Date(0, i).toLocaleString("id-ID", {
                          month: "long",
                        })}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-5">
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">
                    Tahun
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                    value={exportDate.year}
                    onChange={(e) =>
                      setExportDate({ ...exportDate, year: e.target.value })
                    }
                  />
                </div>
              </>
            ) : (
              <>
                <div className="mb-4">
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">
                    Tanggal Awal
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                    value={exportDate.startDate}
                    onChange={(e) =>
                      setExportDate({
                        ...exportDate,
                        startDate: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="mb-5">
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">
                    Tanggal Akhir
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                    value={exportDate.endDate}
                    onChange={(e) =>
                      setExportDate({ ...exportDate, endDate: e.target.value })
                    }
                  />
                </div>
              </>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowExportModal(false)}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
              >
                Batal
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-600 ring-1 ring-inset ring-indigo-100">
            Invoices
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Invoice Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Search, filter, and manage your invoices
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowExportModal(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          >
            <Download className="h-4 w-4" />
            Export Rekapan
          </button>
          <button
            type="button"
            onClick={() => navigate("/app/create-invoice")}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          >
            <Plus className="h-4 w-4" />
            Create Invoice
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error.replace(/^unauthorized:\s*/i, "")}
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => fetchInvoices()}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
            >
              Retry
            </button>
            {String(error).toLowerCase().includes("unauthorized") && (
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Invoices"
          value={allInvoices.length}
          icon={FileText}
          accent="indigo"
        />
        <StatCard
          label="Paid"
          value={
            allInvoices.filter(
              (inv) => (inv.status || "").toString().toLowerCase() === "paid",
            ).length
          }
          icon={CheckCircle2}
          accent="emerald"
        />
        <StatCard
          label="Unpaid"
          value={
            allInvoices.filter((inv) =>
              ["unpaid", "overdue"].includes(
                (inv.status || "").toString().toLowerCase(),
              ),
            ).length
          }
          icon={Clock}
          accent="amber"
        />
        <StatCard
          label="Drafts"
          value={
            allInvoices.filter(
              (inv) => (inv.status || "").toString().toLowerCase() === "draft",
            ).length
          }
          icon={CircleDashed}
          accent="slate"
        />
      </div>

      {/* Filters */}
      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 ring-1 ring-inset ring-indigo-100">
              <Filter className="h-4 w-4 text-indigo-600" />
            </div>
            <h2 className="text-sm font-semibold text-slate-900">
              Filters & Search
            </h2>
          </div>
          <div className="text-xs text-slate-500">
            Showing{" "}
            <span className="font-semibold text-slate-700">
              {filtered.length}
            </span>{" "}
            of {allInvoices.length} invoices
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label
              htmlFor="invoice-search"
              className="mb-1.5 block text-xs font-medium text-slate-500"
            >
              Search Invoices
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="invoice-search"
                name="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                onKeyDown={(e) => e.key === "Enter" && setPage(1)}
                placeholder="Search by client, invoice ID, email…"
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="status-filter"
              className="mb-1.5 block text-xs font-medium text-slate-500"
            >
              Status
            </label>
            <select
              id="status-filter"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            >
              <option value="all">All Status</option>
              <option value="Paid">Paid</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Overdue">Overdue</option>
              <option value="Draft">Draft</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">
              Date Range
            </label>
            <div className="flex items-center gap-2">
              <input
                id="from-date"
                name="from"
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                aria-label="Start date"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                id="to-date"
                name="to"
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                aria-label="End date"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col items-start justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <label
              htmlFor="per-page"
              className="text-xs font-medium text-slate-500"
            >
              Show
            </label>
            <select
              id="per-page"
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            >
              <option value={6}>6 per page</option>
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatus("all");
                setFrom("");
                setTo("");
                setPage(1);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset Filters
            </button>
            <button
              type="button"
              onClick={() => fetchInvoices()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-900">All Invoices</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Sorted by{" "}
            <span className="font-medium text-slate-700">{sortBy.key}</span> ·{" "}
            <span className="font-medium text-slate-700">
              {sortBy.dir === "asc" ? "Ascending" : "Descending"}
            </span>
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                {sortableHeader("client", "Client")}
                {sortableHeader("amount", "Amount")}
                {sortableHeader("status", "Status")}
                {sortableHeader("dueDate", "Due Date")}
                <th className="px-5 py-3 text-right text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: perPage }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}

              {!loading &&
                pageData.map((inv) => {
                  const client = normalizeClient(inv.client);
                  const clientInitial = getClientInitial(inv.client);
                  return (
                    <tr
                      key={inv.id}
                      className="group border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600 ring-1 ring-inset ring-indigo-100">
                            {clientInitial}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">
                              {client.name || inv.company || inv.id}
                            </div>
                            <div className="text-xs text-slate-400">
                              {inv.id}
                            </div>
                            {(client.email || inv.email) && (
                              <div className="text-xs text-slate-400">
                                {client.email || inv.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-700">
                        {formatCurrency(inv.amount || 0, inv.currency)}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge
                          status={inv.status}
                          size="default"
                          showIcon
                        />
                      </td>
                      <td className="px-5 py-4 text-slate-500">
                        {inv.dueDate ? formatDate(inv.dueDate) : "—"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openInvoice(inv)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                          >
                            <Eye className="h-3.5 w-3.5" /> View
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

              {!loading && pageData.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-16">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                        <Inbox className="h-5 w-5 text-slate-400" />
                      </div>
                      <div className="mt-4 text-sm font-medium text-slate-700">
                        No invoices found
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Try adjusting your search filters or create a new
                        invoice to get started.
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate("/app/create-invoice")}
                        className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                      >
                        <Plus className="h-3.5 w-3.5" /> Create your first
                        invoice
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!loading && pageData.length > 0 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            onChange={(p) => setPage(p)}
          />
        )}
      </div>
    </div>
  );
}
