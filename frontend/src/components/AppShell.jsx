import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useClerk, useUser } from "@clerk/clerk-react";
import {
  ChevronsLeft,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  PlusCircle,
  X,
} from "lucide-react";

import logo from "../assets/logo.png";

const COLLAPSE_KEY = "appShellCollapsed";

const NAV_ITEMS = [
  { to: "/app/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/app/invoices", icon: FileText, label: "Invoices" },
  { to: "/app/create-invoice", icon: PlusCircle, label: "Create Invoice" },
];

const AppShell = () => {
  const navigate = useNavigate();
  const { signOut } = useClerk();
  const { user } = useUser();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [scrolled, setScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);

      if (mobile) {
        setCollapsed(false);
      }
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);

    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, String(collapsed));
    } catch {
      // Ignore storage errors, such as blocked browser storage.
    }
  }, [collapsed]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);

    handleScroll();
    window.addEventListener("scroll", handleScroll);

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const logout = async () => {
    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      console.warn("Logout failed:", error);
    }
  };

  const displayName = (() => {
    if (!user) return "User";

    const name = user.fullName || user.firstName || user.username || "";
    const email = user.primaryEmailAddress?.emailAddress || "";

    return name.trim() || email.split("@")[0] || "User";
  })();

  const firstName = displayName.split(" ").filter(Boolean)[0] || displayName;

  const initials = (() => {
    const parts = displayName.split(" ").filter(Boolean);

    if (parts.length === 0) return "U";
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();

    return `${parts[0].charAt(0)}${parts.at(-1).charAt(0)}`.toUpperCase();
  })();

  const SidebarLink = ({ to, icon: Icon, children }) => (
    <NavLink
      to={to}
      onClick={() => setMobileOpen(false)}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${
          collapsed ? "justify-center" : ""
        } ${
          isActive
            ? "bg-indigo-50 text-indigo-700"
            : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={`h-5 w-5 shrink-0 ${
              isActive
                ? "text-indigo-600"
                : "text-slate-400 group-hover:text-slate-600"
            }`}
            strokeWidth={2}
          />
          {!collapsed && <span className="truncate">{children}</span>}
          {collapsed && (
            <span className="pointer-events-none absolute left-full z-50 ml-2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              {children}
            </span>
          )}
        </>
      )}
    </NavLink>
  );

  const sidebarWidth = collapsed ? "w-20" : "w-64";
  const email = user?.primaryEmailAddress?.emailAddress;

  return (
    <div className="min-h-screen w-full bg-slate-50 font-sans text-slate-700">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex">
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex ${sidebarWidth} shrink-0 flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <div className="flex h-full flex-col p-4">
            <div
              className={`mb-6 flex items-center gap-2 px-1 ${
                collapsed ? "justify-center" : ""
              }`}
            >
              <Link
                to="/"
                className="flex min-w-0 items-center gap-2"
                onClick={() => setMobileOpen(false)}
              >
                <img
                  src={logo}
                  alt="Logo"
                  className="h-10 w-full max-w-48 shrink-0 rounded-lg object-contain"
                />
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <SidebarLink key={item.to} to={item.to} icon={item.icon}>
                  {item.label}
                </SidebarLink>
              ))}
            </nav>

            <div className="mt-auto space-y-3 pt-4">
              {!isMobile && (
                <button
                  type="button"
                  onClick={() => setCollapsed((current) => !current)}
                  className={`flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${
                    collapsed ? "justify-center" : "justify-between"
                  }`}
                >
                  {!collapsed && <span>Collapse</span>}
                  <ChevronsLeft
                    className={`h-4 w-4 shrink-0 transition-transform duration-300 ${
                      collapsed ? "rotate-180" : ""
                    }`}
                  />
                </button>
              )}

              <div className="border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={logout}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 ${
                    collapsed ? "justify-center" : ""
                  }`}
                >
                  <LogOut className="h-5 w-5 shrink-0" strokeWidth={2} />
                  {!collapsed && <span>Logout</span>}
                </button>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen w-0 flex-1 flex-col">
          <header
            className={`sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3.5 backdrop-blur transition-shadow sm:px-6 ${
              scrolled ? "shadow-sm" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <h2 className="truncate text-sm font-medium text-slate-500 sm:text-base">
              Welcome Back,{" "}
              <span className="font-semibold text-slate-900">{firstName}</span>
            </h2>

            <div className="ml-auto flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/app/create-invoice")}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
              >
                <PlusCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Create Invoice</span>
                <span className="sm:hidden">Create</span>
              </button>

              <div className="hidden items-center gap-3 border-l border-slate-200 pl-3 sm:flex">
                <div className="text-right">
                  <div className="text-sm font-medium text-slate-900">
                    {displayName}
                  </div>
                  {email && (
                    <div className="text-xs text-slate-400">{email}</div>
                  )}
                </div>
                <div className="relative">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600 ring-1 ring-inset ring-indigo-100">
                    {initials}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default AppShell;
