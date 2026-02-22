import React, { useMemo, useState, useEffect, useCallback } from "react";
import StatusBadge from "../components/StatusBadge";
import { useNavigate } from "react-router-dom";
import { invoicesStyles } from "../assets/dummyStyles";
import { useAuth } from "@clerk/clerk-react";

const API_BASE = import.meta.env.VITE_REACT_APP_BACKEND_URL;

/* ---------- helpers ---------- */
/* ----------------- frontend-only: normalize image URLs ----------------- */
function resolveImageUrl(url) {
  if (!url) return null;
  const s = String(url).trim();

  // keep data/blobs as-is
  if (s.startsWith("data:") || s.startsWith("blob:")) return s;

  // absolute http(s)
  if (/^https?:\/\//i.test(s)) {
    try {
      const parsed = new URL(s);
      if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
        // rewrite localhost -> API_BASE
        const path =
          parsed.pathname + (parsed.search || "") + (parsed.hash || "");
        return `${API_BASE.replace(/\/+$/, "")}${path}`;
      }
      return parsed.href;
    } catch (e) {
      // fall through to relative handling
    }
  }

  // relative paths like "/uploads/..." or "uploads/..." -> prefix with API_BASE
  return `${API_BASE.replace(/\/+$/, "")}/${s.replace(/^\/+/, "")}`;
}

function normalizeInvoiceFromServer(inv = {}) {
  const id = inv.invoiceNumber || inv.id || inv._id || String(inv._id || "");

  const amount = inv.total ?? inv.subtotal ?? 0;
  const status = inv.status ?? inv.statusLabel ?? "Draft";

  // Resolve any image/url fields so frontend doesn't try to load localhost from deployed client
  const logo = resolveImageUrl(
    inv.logoDataUrl ?? inv.logoUrl ?? inv.logo ?? null,
  );
  const stamp = resolveImageUrl(
    inv.stampDataUrl ?? inv.stampUrl ?? inv.stamp ?? null,
  );
  const signature = resolveImageUrl(
    inv.signatureDataUrl ?? inv.signatureUrl ?? inv.signature ?? null,
  );

  return {
    ...inv,
    id,
    amount,
    status,
    logo,
    stamp,
    signature,
  };
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

/* ---------- date formatting helper: DD/MM/YYYY (e.g. 07/12/2025) ---------- */
function formatDate(dateInput) {
  if (!dateInput) return "—";
  const d = dateInput instanceof Date ? dateInput : new Date(String(dateInput));
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/* icons (same as you had) */
const SearchIcon = ({ className = "w-4 h-4" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M21 21l-4.35-4.35M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" />
  </svg>
);
const SortIcon = ({ className = "w-4 h-4", direction = "asc" }) => (
  <svg
    className={`${className} ${direction === "desc" ? "rotate-180" : ""}`}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M7 15l5 5 5-5M7 9l5-5 5 5" />
  </svg>
);
const FilterIcon = ({ className = "w-4 h-4" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
  </svg>
);
const PlusIcon = ({ className = "w-4 h-4" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M12 5v14m-7-7h14" />
  </svg>
);
const EyeIcon = ({ className = "w-4 h-4" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const ResetIcon = ({ className = "w-4 h-4" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

/* Pagination component */
function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);

  for (let i = start; i <= end; i++) pages.push(i);
  return (
    <div className={invoicesStyles.pagination}>
      <div className={invoicesStyles.paginationText}>
        Page {page} of {totalPages}
      </div>
      <div className={invoicesStyles.paginationControls}>
        <button
          type="button"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className={invoicesStyles.paginationButton}
        >
          Previous
        </button>
        <div className={invoicesStyles.paginationNumbers}>
          {pages.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={`${invoicesStyles.paginationNumber} ${
                p === page
                  ? invoicesStyles.paginationNumberActive
                  : invoicesStyles.paginationNumberInactive
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
          className={invoicesStyles.paginationButton}
        >
          Next
        </button>
      </div>
    </div>
  );
}

/* uid helper */
function uid() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID)
      return crypto.randomUUID();
  } catch {}
  return Math.random().toString(36).slice(2, 9);
}

/* ---------- Component ---------- */
export default function InvoicesPage() {
  const navigate = useNavigate();
  const { getToken, isSignedIn } = useAuth();

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDate, setExportDate] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });

  const handleDownload = async () => {
    const token = await obtainToken();
    const { month, year } = exportDate;

    try {
      const res = await fetch(
        `${API_BASE}/api/invoice/export/excel?month=${month}&year=${year}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!res.ok) throw new Error("Gagal download");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Rekap_Invoice_${month}_${year}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setShowExportModal(false);
    } catch (err) {
      alert("Gagal mendownload rekapan.");
    }
  };
  // State yang benar
  const [allInvoices, setAllInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filters state
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [perPage, setPerPage] = useState(6);
  const [sortBy, setSortBy] = useState({ key: "issueDate", dir: "desc" });
  const [page, setPage] = useState(1);

  const obtainToken = useCallback(async () => {
    if (typeof getToken !== "function") return null;
    try {
      let token = await getToken({ template: "default" }).catch(() => null);
      if (!token) {
        token = await getToken({ forceRefresh: true }).catch(() => null);
      }
      return token;
    } catch {
      return null;
    }
  }, [getToken]);

  // FETCH DATA
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
        return;
      }

      const json = await res.json().catch(() => null);
      if (res.ok) {
        const raw = json?.data || [];
        const mapped = raw.map(normalizeInvoiceFromServer);
        setAllInvoices(mapped); // <--- Menjadi ini
        setError(null);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Failed to load invoices.");
    } finally {
      setLoading(false);
    }
  }, [obtainToken, isSignedIn]); // Hapus dependency yang tidak perlu

  // TRIGGER FETCH PERTAMA KALI
  useEffect(() => {
    if (isSignedIn) {
      fetchInvoices();
    }
  }, [isSignedIn, fetchInvoices]);

  // client-side filtering/sorting (same logic)
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
          hasMatchingItemName || // <--- BARU: Cek Nama Penumpang
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

  // delete invoice (backend)
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
        // 🔥 KUNCI AUTO REFRESH: Gunakan setStoredInvoices
        setAllInvoices((prev) =>
          prev.filter((item) => item._id !== targetId && item.id !== targetId),
        );
        alert("Invoice deleted.");
      } else {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message || "Delete failed");
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert(err.message);
    }
  }

  // Helper: client initial
  const getClientInitial = (client) => {
    const c = normalizeClient(client);
    return c.name ? c.name.charAt(0).toUpperCase() : "C";
  };

  return (
    <div className={invoicesStyles.pageContainer}>
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-9999">
          <div className="bg-white p-6 rounded-xl shadow-2xl w-80">
            <h3 className="text-lg font-bold mb-4">Pilih Periode Rekap</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1 text-gray-600">
                  Bulan
                </label>
                <select
                  className="w-full border p-2 rounded"
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

              <div>
                <label className="block text-sm mb-1 text-gray-600">
                  Tahun
                </label>
                <input
                  type="number"
                  className="w-full border p-2 rounded"
                  value={exportDate.year}
                  onChange={(e) =>
                    setExportDate({ ...exportDate, year: e.target.value })
                  }
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  onClick={handleDownload}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium"
                >
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className={invoicesStyles.headerContainer}>
        <div>
          <h1 className={invoicesStyles.headerTitle}>Invoice Management</h1>
          <p className={invoicesStyles.headerSubtitle}>
            Search, filter, and manage your invoices with powerful AI tools
          </p>
        </div>

        <div className={invoicesStyles.headerActions}>
          <button
            onClick={() => setShowExportModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export Rekapan
          </button>
          <button
            type="button"
            onClick={() => navigate("/app/create-invoice")}
            className={invoicesStyles.createButton}
          >
            <PlusIcon className="w-4 h-4" />
            Create Invoice
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          style={{
            padding: 12,
            background: "#fff4f4",
            color: "#7f1d1d",
            borderRadius: 6,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>{error}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => fetchInvoices()}
                style={{
                  padding: "6px 10px",
                  background: "#efefef",
                  borderRadius: 4,
                }}
              >
                Retry
              </button>
              {String(error).toLowerCase().includes("unauthorized") && (
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  style={{
                    padding: "6px 10px",
                    background: "#111827",
                    color: "white",
                    borderRadius: 4,
                  }}
                >
                  Sign in
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className={invoicesStyles.statsGrid}>
        <div className={invoicesStyles.statCard}>
          <div className={invoicesStyles.statValue}>{allInvoices.length}</div>
          <div className={invoicesStyles.statLabel}>Total Invoices</div>
        </div>
        <div className={invoicesStyles.statCard}>
          <div className={invoicesStyles.statValue}>
            {
              allInvoices.filter(
                (inv) => (inv.status || "").toString().toLowerCase() === "paid",
              ).length
            }
          </div>
          <div className={invoicesStyles.statLabel}>Paid</div>
        </div>
        <div className={invoicesStyles.statCard}>
          <div className={invoicesStyles.statValue}>
            {
              allInvoices.filter((inv) =>
                ["unpaid", "overdue"].includes(
                  (inv.status || "").toString().toLowerCase(),
                ),
              ).length
            }
          </div>
          <div className={invoicesStyles.statLabel}>Unpaid</div>
        </div>
        <div className={invoicesStyles.statCard}>
          <div className={invoicesStyles.statValue}>
            {
              allInvoices.filter(
                (inv) =>
                  (inv.status || "").toString().toLowerCase() === "draft",
              ).length
            }
          </div>
          <div className={invoicesStyles.statLabel}>Drafts</div>
        </div>
      </div>

      {/* Filters */}
      <div className={invoicesStyles.filtersCard}>
        <div className={invoicesStyles.filtersHeader}>
          <div className={invoicesStyles.filtersHeaderLeft}>
            <div className={invoicesStyles.filtersIconContainer}>
              <FilterIcon className="w-5 h-5" />
            </div>
            <h2 className={invoicesStyles.filtersTitle}>Filters & Search</h2>
          </div>
          <div className={invoicesStyles.filtersCount}>
            Showing{" "}
            <span className={invoicesStyles.filtersCountNumber}>
              {filtered.length}
            </span>{" "}
            of {allInvoices.length} invoices
          </div>
        </div>

        <div className={invoicesStyles.filtersGrid}>
          <div className={invoicesStyles.searchContainer}>
            <label
              htmlFor="invoice-search"
              className={invoicesStyles.filterLabel}
            >
              Search Invoices
            </label>
            <div className={invoicesStyles.searchInputContainer}>
              <div className={invoicesStyles.searchIcon}>
                <SearchIcon className="w-5 h-5 text-gray-400" />
              </div>
              <input
                id="invoice-search"
                name="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                onKeyDown={(e) => e.key === "Enter" && setPage(1)}
                placeholder="Search by client, invoice ID, email..."
                className={invoicesStyles.searchInput}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="status-filter"
              className={invoicesStyles.filterLabel}
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
              className={invoicesStyles.selectInput}
            >
              <option value="all">All Status</option>
              <option value="Paid">Paid</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Overdue">Overdue</option>
              <option value="Draft">Draft</option>
            </select>
          </div>

          <div className={invoicesStyles.dateRangeContainer}>
            <label className={invoicesStyles.filterLabel}>Date Range</label>
            <div className={invoicesStyles.dateRangeFlex}>
              <input
                id="from-date"
                name="from"
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
                className={invoicesStyles.dateInput}
                aria-label="Start date"
              />
              <div className={invoicesStyles.dateSeparator}>
                <span className={invoicesStyles.dateSeparatorText}>to</span>
              </div>
              <input
                id="to-date"
                name="to"
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
                className={invoicesStyles.dateInput}
                aria-label="End date"
              />
            </div>
          </div>
        </div>

        <div className={invoicesStyles.filtersFooter}>
          <div className={invoicesStyles.perPageContainer}>
            <label htmlFor="per-page" className={invoicesStyles.perPageLabel}>
              Show
            </label>
            <select
              id="per-page"
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setPage(1);
              }}
              className={invoicesStyles.perPageSelect}
            >
              <option value={6}>6 per page</option>
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatus("all");
                setFrom("");
                setTo("");
                setPage(1);
              }}
              className={invoicesStyles.resetButton}
            >
              <ResetIcon className="w-4 h-4" /> Reset Filters
            </button>
            <button
              type="button"
              onClick={() => fetchInvoices()}
              className={invoicesStyles.resetButton}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className={invoicesStyles.tableCard}>
        <div className={invoicesStyles.tableHeader}>
          <div className={invoicesStyles.tableHeaderContent}>
            <div>
              <h3 className={invoicesStyles.tableTitle}>All Invoices</h3>
              <p className={invoicesStyles.tableSubtitle}>
                Sorted by{" "}
                <span className={invoicesStyles.tableSubtitleBold}>
                  {sortBy.key}
                </span>{" "}
                ·{" "}
                <span className={invoicesStyles.tableSubtitleBold}>
                  {sortBy.dir === "asc" ? "Ascending" : "Descending"}
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className={invoicesStyles.tableContainer}>
          <table className={invoicesStyles.table}>
            <thead>
              <tr className={invoicesStyles.tableHead}>
                <th
                  onClick={() => handleSort("client")}
                  className={invoicesStyles.tableHeaderCell}
                >
                  <div className={invoicesStyles.tableHeaderContent}>
                    Client{" "}
                    <SortIcon
                      direction={sortBy.key === "client" ? sortBy.dir : "asc"}
                    />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("amount")}
                  className={invoicesStyles.tableHeaderCell}
                >
                  <div className={invoicesStyles.tableHeaderContent}>
                    Amount{" "}
                    <SortIcon
                      direction={sortBy.key === "amount" ? sortBy.dir : "asc"}
                    />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("status")}
                  className={invoicesStyles.tableHeaderCell}
                >
                  <div className={invoicesStyles.tableHeaderContent}>
                    Status{" "}
                    <SortIcon
                      direction={sortBy.key === "status" ? sortBy.dir : "asc"}
                    />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("dueDate")}
                  className={invoicesStyles.tableHeaderCell}
                >
                  <div className={invoicesStyles.tableHeaderContent}>
                    Due Date{" "}
                    <SortIcon
                      direction={sortBy.key === "dueDate" ? sortBy.dir : "asc"}
                    />
                  </div>
                </th>
                <th className={invoicesStyles.tableHeaderCellRight}>Actions</th>
              </tr>
            </thead>
            <tbody className={invoicesStyles.tableBody}>
              {pageData.map((inv) => {
                const client = normalizeClient(inv.client);
                const clientInitial = getClientInitial(inv.client);
                return (
                  <tr key={inv.id} className={invoicesStyles.tableRow}>
                    <td className={invoicesStyles.clientCell}>
                      <div className={invoicesStyles.clientContainer}>
                        <div className={invoicesStyles.clientAvatar}>
                          {clientInitial}
                        </div>
                        <div>
                          <div className={invoicesStyles.clientInfo}>
                            {client.name || inv.company || inv.id}
                          </div>
                          <div className={invoicesStyles.clientId}>
                            {inv.id}
                          </div>
                          <div className={invoicesStyles.clientEmail}>
                            {client.email || inv.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={invoicesStyles.amountCell}>
                      {formatCurrency(inv.amount || 0, inv.currency)}
                    </td>
                    <td className={invoicesStyles.statusCell}>
                      <StatusBadge
                        status={inv.status}
                        size="default"
                        showIcon
                      />
                    </td>
                    <td className={invoicesStyles.dateCell}>
                      {inv.dueDate ? formatDate(inv.dueDate) : "—"}
                    </td>
                    <td className={invoicesStyles.actionsCell}>
                      <div className={invoicesStyles.actionsContainer}>
                        <button
                          type="button"
                          onClick={() => openInvoice(inv)}
                          className={invoicesStyles.viewButton}
                        >
                          <EyeIcon className={invoicesStyles.buttonIcon} /> View
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteInvoice(inv)}
                          className={invoicesStyles.sendButton}
                          title="Delete invoice"
                          style={{
                            background: "#ffefef",
                            color: "#b91c1c",
                            borderColor: "#fca5a5",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pageData.length === 0 && !loading && (
                <tr>
                  <td colSpan="5" className={invoicesStyles.emptyState}>
                    <div className={invoicesStyles.emptyStateText}>
                      <div className={invoicesStyles.emptyStateIconContainer}>
                        <SearchIcon className={invoicesStyles.emptyStateIcon} />
                      </div>
                      <div className={invoicesStyles.emptyStateTitle}>
                        No invoices found
                      </div>
                      <p className={invoicesStyles.emptyStateMessage}>
                        Try adjusting your search filters or create a new
                        invoice to get started.
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate("/app/create-invoice")}
                        className={invoicesStyles.emptyStateAction}
                      >
                        Create your first invoice
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan="5" style={{ padding: 40, textAlign: "center" }}>
                    Loading invoices...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pageData.length > 0 && (
          <div className={invoicesStyles.paginationContainer}>
            <Pagination
              page={page}
              totalPages={totalPages}
              onChange={(p) => setPage(p)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
