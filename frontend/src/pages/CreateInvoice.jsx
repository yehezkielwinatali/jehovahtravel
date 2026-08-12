import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import StatusBadge from "../components/StatusBadge";
import {
  Eye,
  Save,
  Plus,
  PenTool,
  FileText,
  User,
  ListChecks,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
} from "lucide-react";

/* ---------- API BASE ---------- */
const API_BASE = import.meta.env.VITE_REACT_APP_BACKEND_URL;

/* ---------- helpers (unchanged logic) ---------- */

function resolveImageUrl(url) {
  if (!url) return null;

  const s = String(url).trim();

  if (s.startsWith("data:") || s.startsWith("blob:")) {
    return s;
  }

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

function readJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function writeJSON(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

function getStoredInvoices() {
  return readJSON("invoices_v1", []) || [];
}
function saveStoredInvoices(arr) {
  writeJSON("invoices_v1", arr);
}

function uid() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID)
      return crypto.randomUUID();
  } catch {}
  return Math.random().toString(36).slice(2, 9);
}

function currencyFmt(amount = 0, currency = "IDR") {
  try {
    if (currency === "IDR") {
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
        .format(amount)
        .replace(/(\s)/g, "");
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

function computeTotals(items = [], downPayment = 0) {
  const safe = Array.isArray(items) ? items.filter(Boolean) : [];
  const subtotal = safe.reduce(
    (s, it) => s + Number(it.qty || 0) * Number(it.unitPrice || 0),
    0,
  );
  const totalNta = safe.reduce(
    (s, it) => s + Number(it.qty || 0) * Number(it.nta || 0),
    0,
  );
  const dp = Number(downPayment || 0);
  const total = subtotal - dp;
  const profit = subtotal - totalNta;
  return { subtotal, downPayment: dp, total, totalNta, profit };
}

function dataURLtoFile(dataurl, filename = "file") {
  if (!dataurl || dataurl.indexOf(",") === -1) return null;
  const arr = dataurl.split(",");
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  try {
    return new File([u8arr], filename, { type: mime });
  } catch {
    const blob = new Blob([u8arr], { type: mime });
    blob.name = filename;
    return blob;
  }
}

/* ------------------------------------------------------------------ */
/* Small presentational pieces */
/* ------------------------------------------------------------------ */

function Card({ icon: Icon, title, subtitle, right, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      {(Icon || title) && (
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {Icon && (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 ring-1 ring-inset ring-indigo-100">
                <Icon className="h-4 w-4 text-indigo-600" />
              </div>
            )}
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
              {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
            </div>
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

function Field({ label, htmlFor, children }) {
  return (
    <div>
      {label && (
        <label
          htmlFor={htmlFor}
          className="mb-1.5 block text-xs font-medium text-slate-500"
        >
          {label}
        </label>
      )}
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300";

const TOAST_STYLES = {
  success: {
    icon: CheckCircle2,
    iconText: "text-emerald-600",
    iconBg: "bg-emerald-50",
    bar: "bg-emerald-500",
  },
  error: {
    icon: AlertTriangle,
    iconText: "text-rose-600",
    iconBg: "bg-rose-50",
    bar: "bg-rose-500",
  },
  info: {
    icon: Info,
    iconText: "text-indigo-600",
    iconBg: "bg-indigo-50",
    bar: "bg-indigo-500",
  },
};

function Toast({ toast, onClose }) {
  const cfg = TOAST_STYLES[toast?.type] || TOAST_STYLES.info;
  const Icon = cfg.icon;
  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-6 z-[9999] flex justify-center px-4 transition-all duration-300 ${
        toast ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      }`}
    >
      {toast && (
        <div className="pointer-events-auto relative flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-3.5 pl-4 shadow-xl">
          <span className={`absolute inset-y-0 left-0 w-1 ${cfg.bar}`} />
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cfg.iconBg}`}
          >
            <Icon className={`h-4 w-4 ${cfg.iconText}`} />
          </div>
          <p className="flex-1 pt-1 text-sm text-slate-700">{toast.message}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss notification"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Component (Create / Edit Invoice) ---------- */
export default function CreateInvoice() {
  const navigate = useNavigate();
  const { id } = useParams();
  const loc = useLocation();
  const invoiceFromState =
    loc.state && loc.state.invoice ? loc.state.invoice : null;
  const isEditing = Boolean(id && id !== "new");

  const { getToken, isSignedIn } = useAuth();

  const obtainToken = useCallback(async () => {
    if (typeof getToken !== "function") return null;
    try {
      let token = await getToken({ template: "default" }).catch(() => null);
      if (!token)
        token = await getToken({ forceRefresh: true }).catch(() => null);
      return token;
    } catch (err) {
      return null;
    }
  }, [getToken]);

  function getTodayLocal() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function buildDefaultInvoice() {
    const localId = uid();
    return {
      id: localId,
      invoiceNumber: "",
      issueDate: getTodayLocal(),
      dueDate: "",
      fromBusinessName: "",
      fromEmail: "",
      fromAddress: "",
      fromPhone: "",
      fromGst: "",
      client: { name: "", email: "", address: "", phone: "" },
      items: [
        {
          id: uid(),
          name: "",
          description: "",
          qty: 1,
          unitPrice: 0,
          nta: 0,
          supplier: "",
        },
      ],
      currency: "IDR",
      status: "draft",
      downPayment: 0,
      stampDataUrl: null,
      signatureDataUrl: null,
      logoDataUrl: null,
      signatureName: "",
      signatureTitle: "",
    };
  }

  const [invoice, setInvoice] = useState(() => buildDefaultInvoice());
  const [items, setItems] = useState(invoice.items || []);

  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [toast, setToast] = useState(null);
  const [itemErrors, setItemErrors] = useState({});

  const notify = useCallback((type, message) => {
    setToast({ type, message, key: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  function updateInvoiceField(field, value) {
    setInvoice((inv) => (inv ? { ...inv, [field]: value } : inv));
  }
  function updateClient(field, value) {
    setInvoice((inv) =>
      inv ? { ...inv, client: { ...(inv.client || {}), [field]: value } } : inv,
    );
  }

  function updateItem(idx, key, value) {
    setItems((arr) => {
      const copy = [...arr];
      const it = { ...(copy[idx] || {}) };
      if (key === "description" || key === "name" || key === "supplier") {
        it[key] = value;
      } else {
        it[key] = Number(value) || 0;
      }
      copy[idx] = it;
      setInvoice((inv) => (inv ? { ...inv, items: copy } : inv));
      return copy;
    });
  }
  function addItem() {
    const it = {
      id: uid(),
      name: "",
      description: "",
      qty: 1,
      unitPrice: 0,
      nta: 0,
      supplier: "",
    };
    setItems((arr) => {
      const next = [...arr, it];
      setInvoice((inv) => (inv ? { ...inv, items: next } : inv));
      return next;
    });
  }
  function removeItem(idx) {
    setItems((arr) => {
      const next = arr.filter((_, i) => i !== idx);
      const safeNext =
        next.length > 0
          ? next
          : [
              {
                id: uid(),
                name: "",
                description: "",
                qty: 1,
                unitPrice: 0,
                nta: 0,
                supplier: "",
              },
            ];
      setInvoice((inv) => (inv ? { ...inv, items: safeNext } : inv));
      return safeNext;
    });
  }

  function handleStatusChange(newStatus) {
    setInvoice((inv) => (inv ? { ...inv, status: newStatus } : inv));
  }
  function handleCurrencyChange(newCurrency) {
    setInvoice((inv) => (inv ? { ...inv, currency: newCurrency } : inv));
  }

  function handleImageUpload(file, kind = "logo") {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setInvoice((inv) =>
        inv
          ? {
              ...inv,
              [`${kind}DataUrl`]: dataUrl,
              ...(kind === "logo" ? { logoDataUrl: dataUrl } : {}),
            }
          : inv,
      );
    };
    reader.readAsDataURL(file);
  }
  function removeImage(kind = "logo") {
    setInvoice((inv) =>
      inv
        ? {
            ...inv,
            [`${kind}DataUrl`]: null,
            ...(kind === "logo" ? { logoDataUrl: null } : {}),
          }
        : inv,
    );
  }

  useEffect(() => {
    let mounted = true;

    async function prepare() {
      if (invoiceFromState) {
        const base = { ...buildDefaultInvoice(), ...invoiceFromState };
        base.logoDataUrl =
          resolveImageUrl(base.logoDataUrl ?? base.logoUrl ?? base.logo) ||
          null;
        base.stampDataUrl =
          resolveImageUrl(base.stampDataUrl ?? base.stampUrl ?? base.stamp) ||
          null;
        base.signatureDataUrl =
          resolveImageUrl(
            base.signatureDataUrl ?? base.signatureUrl ?? base.signature,
          ) || null;

        setInvoice(base);
        setItems(
          Array.isArray(invoiceFromState.items)
            ? invoiceFromState.items.slice()
            : invoiceFromState.items
              ? [...invoiceFromState.items]
              : buildDefaultInvoice().items,
        );
        return;
      }

      if (isEditing && !invoiceFromState) {
        setLoading(true);
        try {
          const token = await obtainToken();
          const headers = { Accept: "application/json" };
          if (token) headers["Authorization"] = `Bearer ${token}`;

          const res = await fetch(`${API_BASE}/api/invoice/${id}`, {
            method: "GET",
            headers,
          });
          if (res.ok) {
            const json = await res.json().catch(() => null);
            const data = json?.data || json || null;
            if (data && mounted) {
              const merged = {
                ...buildDefaultInvoice(),
                ...data,
                issueDate: toDateInputValue(data.issueDate),
                dueDate: toDateInputValue(data.dueDate),
              };
              merged.id = data._id ?? data.id ?? merged.id;
              merged.invoiceNumber = data.invoiceNumber ?? merged.invoiceNumber;

              merged.logoDataUrl =
                resolveImageUrl(
                  data.logoDataUrl ?? data.logoUrl ?? data.logo,
                ) ||
                merged.logoDataUrl ||
                null;
              merged.stampDataUrl =
                resolveImageUrl(
                  data.stampDataUrl ?? data.stampUrl ?? data.stamp,
                ) ||
                merged.stampDataUrl ||
                null;
              merged.signatureDataUrl =
                resolveImageUrl(
                  data.signatureDataUrl ?? data.signatureUrl ?? data.signature,
                ) ||
                merged.signatureDataUrl ||
                null;

              setInvoice(merged);
              setItems(
                Array.isArray(data.items) ? data.items.slice() : merged.items,
              );
              setLoading(false);
              return;
            }
          }
        } catch (err) {
          console.warn(
            "Server invoice fetch failed, will fallback to local:",
            err,
          );
        } finally {
          setLoading(false);
        }

        const all = getStoredInvoices();
        const found = all.find(
          (x) => x && (x.id === id || x._id === id || x.invoiceNumber === id),
        );
        if (found && mounted) {
          const fixed = { ...buildDefaultInvoice(), ...found };
          fixed.logoDataUrl =
            resolveImageUrl(found.logoDataUrl ?? found.logoUrl ?? found.logo) ||
            fixed.logoDataUrl ||
            null;
          fixed.stampDataUrl =
            resolveImageUrl(
              found.stampDataUrl ?? found.stampUrl ?? found.stamp,
            ) ||
            fixed.stampDataUrl ||
            null;
          fixed.signatureDataUrl =
            resolveImageUrl(
              found.signatureDataUrl ?? found.signatureUrl ?? found.signature,
            ) ||
            fixed.signatureDataUrl ||
            null;

          setInvoice(fixed);
          setItems(
            Array.isArray(found.items)
              ? found.items.slice()
              : buildDefaultInvoice().items,
          );
        }
        return;
      }

      const defaultInvoice = buildDefaultInvoice();

      setInvoice((prev) => ({
        ...defaultInvoice,
        ...prev,
      }));

      setItems(defaultInvoice.items);
    }

    prepare();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, invoiceFromState, isEditing, obtainToken]);

  async function handleSave() {
    if (!invoice) return;
    const errors = {};

    items.forEach((item, index) => {
      if (!String(item.description || "").trim()) {
        errors[index] = {
          ...(errors[index] || {}),
          description: true,
        };
      }
    });

    if (Object.keys(errors).length > 0) {
      setItemErrors(errors);

      notify("error", "Description wajib diisi.");
      return;
    }

    setItemErrors({});

    setLoading(true);
    try {
      const totals = computeTotals(items, invoice.downPayment);

      const prepared = {
        issueDate: invoice.issueDate || "",
        dueDate: invoice.dueDate || "",
        fromBusinessName: invoice.fromBusinessName || "",
        fromEmail: invoice.fromEmail || "",
        fromAddress: invoice.fromAddress || "",
        fromPhone: invoice.fromPhone || "",
        fromGst: invoice.fromGst || "",
        client: invoice.client || {},
        items: items || [],
        currency: invoice.currency || "IDR",
        status: invoice.status || "draft",
        subtotal: totals.subtotal,
        downPayment: totals.downPayment,
        total: totals.total,
        logoDataUrl: invoice.logoDataUrl || null,
        stampDataUrl: invoice.stampDataUrl || null,
        signatureDataUrl: invoice.signatureDataUrl || null,
        signatureName: invoice.signatureName || "",
        signatureTitle: invoice.signatureTitle || "",
        localId: invoice.id,
      };

      if (isEditing && invoice.invoiceNumber) {
        prepared.invoiceNumber = invoice.invoiceNumber.trim();
      }

      const endpoint =
        isEditing && invoice.id
          ? `${API_BASE}/api/invoice/${invoice.id}`
          : `${API_BASE}/api/invoice`;
      const method = isEditing && invoice.id ? "PUT" : "POST";

      const token = await obtainToken();
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(endpoint, {
        method,
        headers,
        body: JSON.stringify(prepared),
      });

      if (res.status === 409) {
        const json = await res.json().catch(() => null);
        const message = json?.message || "Invoice number already exists.";
        throw new Error(message);
      }

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = json?.message || `Save failed (${res.status})`;

        const error = new Error(msg);
        error.status = res.status;

        throw error;
      }

      const saved = json?.data || json || null;
      const savedId = saved?._id ?? saved?.id ?? invoice.id;

      const merged = {
        ...prepared,
        id: savedId,
        invoiceNumber:
          saved?.invoiceNumber ??
          prepared.invoiceNumber ??
          invoice.invoiceNumber,
        subtotal: saved?.subtotal ?? prepared.subtotal,
        total: saved?.total ?? prepared.total,
      };

      setInvoice((inv) => ({ ...inv, ...merged }));
      setItems(Array.isArray(saved?.items) ? saved.items : items);

      const all = getStoredInvoices();
      if (isEditing) {
        const idx = all.findIndex(
          (x) =>
            x &&
            (x.id === invoice.id ||
              x._id === invoice.id ||
              x.invoiceNumber === invoice.invoiceNumber),
        );
        if (idx >= 0) all[idx] = merged;
        else all.unshift(merged);
      } else {
        all.unshift(merged);
      }
      saveStoredInvoices(all);

      notify(
        "success",
        `Invoice ${isEditing ? "updated" : "created"} successfully.`,
      );
      setTimeout(() => navigate("/app/invoices"), 900);
    } catch (err) {
      console.error("Failed to save invoice to server:", err);

      if (err.status === 400) {
        notify("error", err.message || "Invoice data is invalid.");
        return;
      }

      if (
        err.status === 409 ||
        String(err?.message || "")
          .toLowerCase()
          .includes("invoice number")
      ) {
        notify("error", err.message || "Invoice number already exists.");
        return;
      }

      // Jangan anggap berhasil kalau server gagal
      notify(
        "error",
        err?.message || "Failed to save invoice. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handlePreview() {
    const prepared = {
      ...invoice,
      items,
      subtotal: computeTotals(items, invoice.downPayment).subtotal,
      downPayment: computeTotals(items, invoice.downPayment).downPayment,
      total: computeTotals(items, invoice.downPayment).total,
    };
    navigate(`/app/invoices/${invoice.id}/preview`, {
      state: { invoice: prepared },
    });
  }

  function toDateInputValue(dateValue) {
    if (!dateValue) return "";
    const s = String(dateValue);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const totals = computeTotals(items, invoice?.downPayment || 0);

  const STATUS_OPTIONS = [
    { value: "draft", label: "Draft" },
    { value: "unpaid", label: "Unpaid" },
    { value: "paid", label: "Paid" },
    { value: "overdue", label: "Overdue" },
  ];

  return (
    <div className="w-full font-[Inter] text-slate-700">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');`}</style>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-600 ring-1 ring-inset ring-indigo-100">
            {isEditing ? "Edit" : "New"}
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {isEditing ? "Edit Invoice" : "Create New Invoice"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isEditing
              ? "Update invoice details and items below"
              : "Fill in invoice details, add line items, and configure branding"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          >
            <Save className="h-4 w-4" />
            {loading
              ? "Saving…"
              : isEditing
                ? "Update Invoice"
                : "Create Invoice"}
          </button>
        </div>
      </div>

      {/* Invoice details */}
      <Card
        icon={FileText}
        title="Invoice Details"
        subtitle="Dates, currency, and status"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Invoice Date" htmlFor="issueDate">
            <input
              id="issueDate"
              type="date"
              value={toDateInputValue(invoice.issueDate)}
              onChange={(e) =>
                setInvoice({ ...invoice, issueDate: e.target.value })
              }
              className={inputClass}
            />
          </Field>
          <Field label="Due Date" htmlFor="dueDate">
            <input
              id="dueDate"
              type="date"
              value={toDateInputValue(invoice.dueDate)}
              onChange={(e) =>
                setInvoice({ ...invoice, dueDate: e.target.value })
              }
              className={inputClass}
            />
          </Field>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">
              Currency
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { code: "IDR", symbol: "Rp", name: "Rupiah" },
                { code: "USD", symbol: "$", name: "US Dollar" },
              ].map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => handleCurrencyChange(c.code)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${
                    invoice.currency === c.code
                      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="font-semibold">{c.symbol}</span>
                  <span className="text-xs opacity-80">{c.code}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => handleStatusChange(s.value)}
                  className={`rounded-lg border px-1 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${
                    invoice.status === s.value
                      ? "border-indigo-200 bg-indigo-50"
                      : "border-transparent"
                  }`}
                >
                  <StatusBadge
                    status={s.label}
                    size="default"
                    showIcon={true}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Main grid */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {/* Bill To */}
          <Card
            icon={User}
            title="Kepada"
            subtitle="Client billed on this invoice"
          >
            <Field label="Client Name" htmlFor="clientName">
              <input
                id="clientName"
                value={invoice?.client?.name || ""}
                onChange={(e) => updateClient("name", e.target.value)}
                placeholder="Client Name"
                className={inputClass}
              />
            </Field>
          </Card>

          {/* Items */}
          <Card
            icon={ListChecks}
            title="Items & Services"
            subtitle={`All amounts in ${invoice.currency}`}
          >
            <div className="space-y-4">
              {items.map((it, idx) => {
                const totalValue =
                  Number(it?.qty || 0) * Number(it?.unitPrice || 0);
                const totalLabel = currencyFmt(totalValue, invoice.currency);
                const nilaiProfit =
                  (Number(it?.unitPrice || 0) - Number(it?.nta || 0)) *
                  Number(it?.qty || 0);
                const isRugi = nilaiProfit < 0;

                return (
                  <div
                    key={it?.id ?? idx}
                    className="rounded-lg border border-slate-200 p-4"
                  >
                    <div className="mb-3">
                      <span className="text-xs font-semibold text-slate-400">
                        Item {idx + 1}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="col-span-2 sm:col-span-2">
                        <Field label="Nama Penumpang" htmlFor={`name-${idx}`}>
                          <input
                            id={`name-${idx}`}
                            className={inputClass}
                            value={it?.name ?? ""}
                            onChange={(e) =>
                              updateItem(idx, "name", e.target.value)
                            }
                            placeholder="Nama Penumpang"
                            aria-label={`Item ${idx + 1} name`}
                          />
                        </Field>
                      </div>
                      <div className="col-span-2 sm:col-span-2">
                        <Field label="Description" htmlFor={`desc-${idx}`}>
                          <input
                            id={`desc-${idx}`}
                            className={`${inputClass} ${
                              itemErrors[idx]?.description
                                ? "border-rose-500 focus-visible:ring-rose-300"
                                : ""
                            }`}
                            value={it?.description ?? ""}
                            onChange={(e) =>
                              updateItem(idx, "description", e.target.value)
                            }
                            placeholder="Description"
                            aria-label={`Item ${idx + 1} description`}
                          />
                        </Field>
                      </div>

                      <Field label="Quantity" htmlFor={`qty-${idx}`}>
                        <input
                          id={`qty-${idx}`}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          className={inputClass}
                          value={String(it?.qty ?? "")}
                          onChange={(e) =>
                            updateItem(idx, "qty", e.target.value)
                          }
                          aria-label={`Item ${idx + 1} quantity`}
                        />
                      </Field>

                      <Field label="Harga" htmlFor={`price-${idx}`}>
                        <input
                          id={`price-${idx}`}
                          type="text"
                          inputMode="decimal"
                          className={inputClass}
                          value={String(it?.unitPrice ?? "")}
                          onChange={(e) =>
                            updateItem(idx, "unitPrice", e.target.value)
                          }
                          aria-label={`Item ${idx + 1} unit price`}
                        />
                      </Field>

                      <Field label="NTA" htmlFor={`nta-${idx}`}>
                        <input
                          id={`nta-${idx}`}
                          type="number"
                          value={it.nta}
                          onChange={(e) =>
                            updateItem(idx, "nta", e.target.value)
                          }
                          placeholder="Modal"
                          className={`${inputClass} border-amber-200 focus-visible:ring-amber-300`}
                        />
                      </Field>

                      <Field label="Supplier" htmlFor={`supplier-${idx}`}>
                        <input
                          id={`supplier-${idx}`}
                          className={inputClass}
                          value={it?.supplier ?? ""}
                          onChange={(e) =>
                            updateItem(idx, "supplier", e.target.value)
                          }
                          placeholder="Supplier"
                        />
                      </Field>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                      <span
                        className={`text-xs font-medium ${isRugi ? "text-rose-600" : "text-emerald-600"}`}
                      >
                        {isRugi ? "Rugi" : "Profit"}:{" "}
                        {currencyFmt(nilaiProfit, invoice.currency)}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">
                        {totalLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={addItem}
              className="mt-5 inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            >
              <Plus className="h-4 w-4" /> Add Item
            </button>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Summary */}
          <Card icon={Wallet} title="Ringkasan Pembayaran">
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium text-slate-900">
                  {currencyFmt(totals.subtotal, invoice.currency)}
                </span>
              </div>

              <div className="space-y-3 border-y border-slate-100 py-3">
                <Field label="Uang Muka (DP)" htmlFor="downPayment">
                  <input
                    id="downPayment"
                    type="number"
                    value={invoice.downPayment === 0 ? "" : invoice.downPayment}
                    onChange={(e) =>
                      updateInvoiceField(
                        "downPayment",
                        Number(e.target.value || 0),
                      )
                    }
                    className={`${inputClass} text-center`}
                    placeholder="Masukkan nominal uang muka…"
                  />
                </Field>
                <div className="flex items-center justify-between text-sm">
                  <span className="italic text-slate-500">
                    Potongan Uang Muka
                  </span>
                  <span className="font-medium text-rose-600">
                    - {currencyFmt(invoice.downPayment || 0, invoice.currency)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-indigo-50 px-3 py-3">
                <span className="text-sm font-semibold text-indigo-900">
                  Sisa Tagihan
                </span>
                <span className="text-base font-bold text-indigo-900">
                  {currencyFmt(totals.total, invoice.currency)}
                </span>
              </div>
            </div>
          </Card>

          {/* Signature details */}
          <Card icon={PenTool} title="Signature Details">
            <div className="space-y-4">
              <Field label="Disiapkan Oleh" htmlFor="signatureName">
                <input
                  id="signatureName"
                  value={invoice.signatureName || ""}
                  onChange={(e) =>
                    updateInvoiceField("signatureName", e.target.value)
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Disetujui Oleh" htmlFor="signatureTitle">
                <input
                  id="signatureTitle"
                  value={invoice.signatureTitle || ""}
                  onChange={(e) =>
                    updateInvoiceField("signatureTitle", e.target.value)
                  }
                  className={inputClass}
                />
              </Field>
            </div>
          </Card>
        </div>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
