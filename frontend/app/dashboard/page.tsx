"use client";

import { useEffect, useState } from "react";
import { api, getErrorMessage } from "@/lib/api";
import { 
  Key, 
  CheckCircle2, 
  Clock, 
  AlertOctagon, 
  Laptop, 
  FilePlus, 
  Compass,
  ArrowUpRight
} from "lucide-react";
import Link from "next/link";

interface DashboardStats {
  total: number;
  new: number;
  active: number;
  expired: number;
  revoked: number;
  total_activations: number;
}

interface RecentLicense {
  id: string;
  key: string;
  category_name: string | null;
  devices_count: number;
  max_devices: number;
  status: string;
}

export default function DashboardOverview() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recentLicenses, setRecentLicenses] = useState<RecentLicense[]>([]);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        // Load stats
        const statsData = await api.get<DashboardStats>("/api/licenses/stats");
        setStats(statsData);
        
        // Load recent licenses
        const licensesData = await api.get<{ items: RecentLicense[] }>("/api/licenses", { page: 1, page_size: 5 });
        setRecentLicenses(licensesData.items || []);
      } catch (err: unknown) {
        setError(getErrorMessage(err, "Failed to load dashboard data."));
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-slate-900 border border-slate-800 rounded-2xl" />
          ))}
        </div>
        <div className="h-64 bg-slate-900 border border-slate-800 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400">
        <h3 className="text-lg font-bold mb-2">Error Loading Dashboard</h3>
        <p className="text-sm">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const statCards = [
    {
      title: "Total License Keys",
      value: stats?.total || 0,
      icon: Key,
      color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
      gradient: "from-blue-600/5 to-transparent"
    },
    {
      title: "Activated Keys",
      value: stats?.active || 0,
      icon: CheckCircle2,
      color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
      gradient: "from-emerald-600/5 to-transparent"
    },
    {
      title: "Unactivated Keys (New)",
      value: stats?.new || 0,
      icon: Compass,
      color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
      gradient: "from-indigo-600/5 to-transparent"
    },
    {
      title: "Expired Keys",
      value: stats?.expired || 0,
      icon: Clock,
      color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
      gradient: "from-amber-600/5 to-transparent"
    },
    {
      title: "Revoked Keys",
      value: stats?.revoked || 0,
      icon: AlertOctagon,
      color: "text-slate-500 bg-slate-500/10 border-slate-500/20",
      gradient: "from-slate-600/5 to-transparent"
    },
    {
      title: "Total Active Devices",
      value: stats?.total_activations || 0,
      icon: Laptop,
      color: "text-violet-500 bg-violet-500/10 border-violet-500/20",
      gradient: "from-violet-600/5 to-transparent"
    }
  ];

  return (
    <div className="space-y-8">
      {/* Welcome banner */}
      <div className="relative rounded-2xl bg-gradient-to-r from-blue-900/40 to-slate-900 border border-blue-950 p-6 lg:p-8 overflow-hidden shadow-xl">
        <div className="absolute top-[-50%] right-[-10%] w-[400px] h-[400px] rounded-full bg-blue-600/10 blur-[80px] pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-100 tracking-tight">System Status Overview</h1>
          <p className="text-slate-400 mt-2 text-sm lg:text-base leading-relaxed">
            Welcome back. Monitor activated clients, generate new licenses, extend subscription periods, and manage category metadata from this console.
          </p>
          <div className="flex flex-wrap gap-3 mt-5">
            <Link 
              href="/dashboard/licenses" 
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-blue-600/20"
            >
              <FilePlus className="w-4 h-4" />
              <span>Generate License Keys</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Grid of stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div 
              key={idx} 
              className={`bg-gradient-to-br ${card.gradient} bg-slate-900 border border-slate-800/80 rounded-2xl p-6 flex justify-between items-center relative overflow-hidden shadow-md group hover:border-slate-700 transition-all duration-300`}
            >
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{card.title}</span>
                <div className="text-3xl font-extrabold text-slate-100 tracking-tight group-hover:scale-[1.02] origin-left transition-transform">
                  {card.value}
                </div>
              </div>
              <div className={`p-3 rounded-xl border ${card.color} transition-all duration-300 group-hover:scale-110`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Licenses table & quick settings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Table of recent keys */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 lg:col-span-2 shadow-md">
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-100">Recently Generated Keys</h3>
              <p className="text-xs text-slate-400">Review status of your latest license batches</p>
            </div>
            <Link 
              href="/dashboard/licenses" 
              className="text-xs text-blue-500 hover:text-blue-400 font-semibold flex items-center gap-1 transition-colors"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="pb-3 font-semibold">License Key</th>
                  <th className="pb-3 font-semibold">Category</th>
                  <th className="pb-3 font-semibold">Devices</th>
                  <th className="pb-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {recentLicenses.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500 text-xs">
                      No license keys generated yet. Click &quot;Generate License Keys&quot; to start.
                    </td>
                  </tr>
                ) : (
                  recentLicenses.map((lic) => (
                    <tr key={lic.id} className="group hover:bg-slate-800/20 transition-colors">
                      <td className="py-3.5 font-mono font-bold text-slate-300 select-all">{lic.key}</td>
                      <td className="py-3.5 text-slate-400 text-xs">{lic.category_name || "N/A"}</td>
                      <td className="py-3.5 text-slate-400 text-xs">{lic.devices_count} / {lic.max_devices}</td>
                      <td className="py-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border
                          ${lic.status === "new" && "text-blue-500 bg-blue-500/10 border-blue-500/20"}
                          ${lic.status === "active" && "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"}
                          ${lic.status === "expired" && "text-rose-500 bg-rose-500/10 border-rose-500/20"}
                          ${lic.status === "revoked" && "text-slate-500 bg-slate-500/10 border-slate-500/20"}
                        `}>
                          {lic.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Guide card */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between shadow-md relative overflow-hidden">
          <div className="absolute top-[-30%] left-[-20%] w-64 h-64 rounded-full bg-emerald-600/5 blur-[50px] pointer-events-none" />
          <div className="space-y-4 relative z-10">
            <h3 className="text-lg font-bold text-slate-100">Operational Checklist</h3>
            <ul className="space-y-3.5 text-xs text-slate-400">
              <li className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                <span>Create category profiles under <b>Categories</b> before generating licensing keys.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                <span>Admin seed default credentials should be updated in <b>Settings</b> for security.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                <span>Clients trigger activation automatically on their first boot. Time offsets are set in Vietnam local time.</span>
              </li>
            </ul>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-800/60 text-[10px] text-slate-500 text-center">
            System time: {new Date().toLocaleDateString("vi-VN")} GMT+7
          </div>
        </div>
      </div>
    </div>
  );
}
