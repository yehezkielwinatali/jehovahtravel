import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  FileText,
  DollarSign,
  Clock,
  Eye,
  Plus,
  Building2,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertTriangle,
  CircleDashed,
  TimerReset,
  Inbox,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_REACT_APP_BACKEND_URL;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function capitalize(s) {
  if (!s) return s;
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

function currencyFmt(amount = 0) {
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(Number(amount || 0));
  } catch {
    return `Rp ${amount}`;
  }
}

function formatDate(dateInput) {
  if (!dateInput) return "—";
  const d = dateInput instanceof Date ? dateInput : new Date(String(dateInput));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getClientName(inv) {
  if (!inv) return "";
  if (typeof inv.client === "string") return inv.client;
  if (typeof inv.client === "object")
    return inv.client?.name || inv.client?.company || inv.company || "";
  return inv.company || "Client";
}

const STATUS_STYLES = {
  Paid: {
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    ring: "ring-emerald-200",
    icon: CheckCircle2,
  },
  Unpaid: {
    text: "text-amber-700",
    bg: "bg-amber-50",
    ring: "ring-amber-200",
    icon: TimerReset,
  },
  Overdue: {
    text: "text-rose-700",
    bg: "bg-rose-50",
    ring: "ring-rose-200",
    icon: AlertTriangle,
  },
  Draft: {
    text: "text-slate-600",
    bg: "bg-slate-100",
    ring: "ring-slate-200",
    icon: CircleDashed,
  },
};

function StatusBadge({ status }) {
  const cfg = STATUS_STYLES[status] || STATUS_STYLES.Draft;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${cfg.text} ${cfg.bg} ${cfg.ring}`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
      {status}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* KPI card                                                            */
/* ------------------------------------------------------------------ */

function KpiCard({ label, value, hint, trend, icon: Icon, accent }) {
  const positive = trend >= 0;
  const accentMap = {
    indigo: {
      iconBg: "bg-indigo-50",
      iconRing: "ring-indigo-100",
      iconText: "text-indigo-600",
    },
    emerald: {
      iconBg: "bg-emerald-50",
      iconRing: "ring-emerald-100",
      iconText: "text-emerald-600",
    },
    amber: {
      iconBg: "bg-amber-50",
      iconRing: "ring-amber-100",
      iconText: "text-amber-600",
    },
  };
  const a = accentMap[accent] || accentMap.indigo;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
        </div>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${a.iconBg} ring-1 ring-inset ${a.iconRing}`}
        >
          <Icon className={`h-5 w-5 ${a.iconText}`} strokeWidth={2} />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-xs text-slate-500">{hint}</span>
        <span
          className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
            positive ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          {positive ? (
            <ArrowUpRight className="h-3.5 w-3.5" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5" />
          )}
          {Math.abs(trend)}%
        </span>
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
            <div className="h-3 w-28 rounded bg-slate-100 animate-pulse" />
            <div className="h-2.5 w-16 rounded bg-slate-100 animate-pulse" />
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
        <div className="ml-auto h-7 w-14 rounded-lg bg-slate-100 animate-pulse" />
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

const Dashboard = () => {
  const navigate = useNavigate();
  const { getToken, isSignedIn } = useAuth();

  const obtainToken = useCallback(async () => {
    if (typeof getToken !== "function") return null;
    try {
      let token = await getToken({ template: "default" }).catch(() => null);
      if (!token)
        token = await getToken({ forceRefresh: true }).catch(() => null);
      return token || null;
    } catch {
      return null;
    }
  }, [getToken]);

  const [storedInvoices, setStoredInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const fire = (msg) => setToast(msg);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  // fetch invoices from backend
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
        console.warn("Session expired or unauthorized");
        setError("Sesi berakhir, silakan masuk kembali.");
        return;
      }

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const json = await res.json();
      const raw = json?.data || [];

      const mapped = raw.map((inv) => {
        const amountVal = Number(inv.total ?? inv.amount ?? 0);
        return {
          ...inv,
          id: inv.invoiceNumber || inv._id || String(inv._id || ""),
          amount: amountVal,
          status:
            typeof inv.status === "string" ? capitalize(inv.status) : "Draft",
        };
      });

      setStoredInvoices(mapped);
      setError(null);
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Gagal memuat data invoice.");
    } finally {
      setLoading(false);
    }
  }, [obtainToken, isSignedIn]);

  useEffect(() => {
    fetchInvoices();

    const onFocus = () => fetchInvoices();
    window.addEventListener("focus", onFocus);

    function onStorage(e) {
      if (e.key === "invoices_v1") fetchInvoices();
    }
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchInvoices]);

  const kpis = useMemo(() => {
    let totalPaid = 0,
      totalUnpaid = 0,
      paidCount = 0;

    storedInvoices.forEach((inv) => {
      const rawAmount =
        typeof inv.amount === "number"
          ? inv.amount
          : Number(inv.total ?? inv.amount ?? 0);
      if (inv.status === "Paid") {
        totalPaid += rawAmount;
        paidCount++;
      }
      if (inv.status === "Unpaid" || inv.status === "Overdue")
        totalUnpaid += rawAmount;
    });

    const totalAmount = totalPaid + totalUnpaid;

    return {
      totalInvoices: storedInvoices.length,
      totalPaid,
      totalUnpaid,
      paidRate:
        storedInvoices.length > 0
          ? (paidCount / storedInvoices.length) * 100
          : 0,
      avg: storedInvoices.length > 0 ? totalAmount / storedInvoices.length : 0,
    };
  }, [storedInvoices]);

  const recent = useMemo(() => {
    return storedInvoices
      .slice()
      .sort(
        (a, b) =>
          (Date.parse(b.issueDate || 0) || 0) -
          (Date.parse(a.issueDate || 0) || 0),
      )
      .slice(0, 5);
  }, [storedInvoices]);

  function openInvoice(invRow) {
    navigate(`/app/invoices/${invRow.id}`, { state: { invoice: invRow } });
  }

  return (
    <div className="w-full font-[Inter] text-slate-700">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');`}</style>

      {/* header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-600 ring-1 ring-inset ring-indigo-100">
            Overview
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Ringkasan aktivitas invoice Anda
          </p>
        </div>
      </div>

      {/* error banner */}
      {error && (
        <div className="mb-5 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <div className="flex gap-2">
            <button
              onClick={fetchInvoices}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
            >
              Retry
            </button>
            {error.toLowerCase().includes("sesi") && (
              <button
                onClick={() => navigate("/login")}
                className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      )}

      {/* KPI grid */}
      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <KpiCard
          label="Total Invoices"
          value={loading ? "—" : kpis.totalInvoices}
          hint="Active invoices"
          trend={8.5}
          icon={FileText}
          accent="indigo"
        />
        <KpiCard
          label="Belum Dibayar"
          value={loading ? "—" : currencyFmt(kpis.totalUnpaid)}
          hint="Outstanding balance"
          trend={-3.1}
          icon={Clock}
          accent="amber"
        />
      </div>

      {/* main grid */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        {/* sidebar */}
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">
              Quick Actions
            </h3>
            <div className="mt-4 space-y-2">
              <button
                onClick={() => navigate("/app/create-invoice")}
                className="group flex w-full items-center gap-3 rounded-lg border border-indigo-100 bg-indigo-50 px-3.5 py-2.5 text-left text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-100">
                  <Plus className="h-4 w-4 text-indigo-600" />
                </span>
                Create Invoice
                <ArrowRight className="ml-auto h-3.5 w-3.5 text-indigo-400 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>

              <button
                onClick={() => navigate("/app/invoices")}
                className="group flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100">
                  <FileText className="h-4 w-4 text-slate-500" />
                </span>
                View All Invoices
                <ArrowRight className="ml-auto h-3.5 w-3.5 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            </div>
          </div>
        </div>

        {/* content: recent invoices */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Recent Invoices
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                5 invoice terbaru berdasarkan tanggal penerbitan
              </p>
            </div>
            <button
              onClick={() => navigate("/app/invoices")}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            >
              View All <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Client &amp; ID</th>
                  <th className="px-5 py-3 font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Due Date</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonRow key={i} />
                  ))}

                {!loading &&
                  recent.map((inv) => {
                    const clientName = getClientName(inv);
                    return (
                      <tr
                        key={inv.id}
                        onClick={() => openInvoice(inv)}
                        className="group cursor-pointer border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600 ring-1 ring-inset ring-indigo-100">
                              {clientName
                                ? clientName.charAt(0).toUpperCase()
                                : "C"}
                            </div>
                            <div>
                              <div className="font-medium text-slate-900">
                                {clientName}
                              </div>
                              <div className="text-xs text-slate-400">
                                {inv.id}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 font-medium text-slate-700">
                          {currencyFmt(inv.amount)}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={inv.status} />
                        </td>
                        <td className="px-5 py-4 text-slate-500">
                          {inv.dueDate ? formatDate(inv.dueDate) : "—"}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openInvoice(inv);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 opacity-0 transition-all group-hover:opacity-100 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                            >
                              <Eye className="h-3.5 w-3.5" /> View
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                {!loading && recent.length === 0 && !error && (
                  <tr>
                    <td colSpan={5} className="px-6 py-16">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                          <Inbox className="h-5 w-5 text-slate-400" />
                        </div>
                        <p className="mt-4 text-sm font-medium text-slate-700">
                          Belum ada invoice
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Buat invoice pertama Anda untuk mulai melacak
                          pembayaran.
                        </p>
                        <button
                          onClick={() => navigate("/app/create-invoice")}
                          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                        >
                          <Plus className="h-3.5 w-3.5" /> Buat Invoice Disini
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* toast */}
      <div
        className={`pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center transition-all duration-300 ${
          toast ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        }`}
      >
        <div className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-700 shadow-lg">
          {toast}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
