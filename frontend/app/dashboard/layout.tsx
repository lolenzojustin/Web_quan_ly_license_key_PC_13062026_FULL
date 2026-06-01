"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { isAuthenticated, logout } from "@/lib/auth";
import { 
  LayoutDashboard, 
  Key, 
  FolderKanban, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  ShieldCheck
} from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Auth check
    if (!isAuthenticated()) {
      router.push("/login");
    } else {
      setAuthorized(true);
    }
  }, [router]);

  if (!authorized) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-medium tracking-wide animate-pulse">Checking authorization...</span>
        </div>
      </div>
    );
  }

  const menuItems = [
    { name: "Overview", path: "/dashboard", icon: LayoutDashboard },
    { name: "Licenses", path: "/dashboard/licenses", icon: Key },
    { name: "Categories", path: "/dashboard/categories", icon: FolderKanban },
    { name: "Settings", path: "/dashboard/settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm transition-all"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800/80 flex flex-col justify-between
        transform transition-transform duration-300 lg:transform-none lg:static lg:flex
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        <div>
          {/* Logo Section */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800/60">
            <Link href="/dashboard" className="flex items-center gap-2.5 font-bold text-lg tracking-tight text-slate-100">
              <div className="p-1.5 bg-blue-600/20 border border-blue-500/30 rounded-lg text-blue-500">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span>License Manager</span>
            </Link>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            {menuItems.map((item) => {
              const isActive = pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all group
                    ${isActive 
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/15" 
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"}
                  `}
                >
                  <Icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${isActive ? "text-white" : "text-slate-400 group-hover:text-slate-300"}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800/60">
          <button
            onClick={() => logout()}
            className="flex w-full items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 active:scale-[0.98] transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header (Mobile menu trigger) */}
        <header className="h-16 border-b border-slate-800/60 flex items-center justify-between px-6 lg:px-8 bg-slate-900/30 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
              {pathname === "/dashboard" && "Dashboard Overview"}
              {pathname === "/dashboard/licenses" && "License Keys Management"}
              {pathname === "/dashboard/categories" && "Categories Management"}
              {pathname === "/dashboard/settings" && "Account Settings"}
            </h2>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-full text-xs font-semibold text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Admin Session</span>
            </div>
          </div>
        </header>

        {/* Dynamic page content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-slate-950">
          <div className="max-w-7xl mx-auto space-y-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
