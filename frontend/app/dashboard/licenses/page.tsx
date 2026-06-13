"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { 
  Key, 
  Search, 
  Filter, 
  RotateCcw, 
  Trash2, 
  Eye, 
  Plus, 
  X, 
  Laptop, 
  ChevronLeft, 
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

interface License {
  id: string;
  key: string;
  category_id: string;
  category_name: string | null;
  duration_type: string;
  duration_value: number | null;
  max_devices: number;
  activated_at: string | null;
  expires_at: string | null;
  is_lifetime: boolean;
  status: string;
  created_at: string;
  devices_count: number;
}

interface Category {
  id: string;
  name: string;
}

interface Activation {
  id: string;
  device_id: string;
  device_name: string | null;
  os_info: string | null;
  app_version: string | null;
  activated_at: string;
  last_checked_at: string | null;
}

interface LicenseListResponse {
  items: License[];
  total: number;
}


function translateError(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  if (err instanceof ApiError) {
    return msg || `Máy chủ xử lý yêu cầu thất bại (HTTP ${err.status}).`;
  }
  if (msg === "Failed to fetch" || msg.toLowerCase().includes("failed to fetch")) {
    return "Không thể kết nối đến máy chủ. Vui lòng kiểm tra backend đang chạy.";
  }
  if (msg.includes("NetworkError") || msg.toLowerCase().includes("network")) {
    return "Lỗi mạng. Vui lòng kiểm tra kết nối.";
  }
  return msg || "Đã xảy ra lỗi không xác định.";
}

export default function LicensesPage() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Table / Query State
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [loading, setLoading] = useState(true);

  // Modals State
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const [isDevicesOpen, setIsDevicesOpen] = useState(false);
  const [isRevokeOpen, setIsRevokeOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Focus Items State
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null);
  const [activations, setActivations] = useState<Activation[]>([]);
  const [loadingActivations, setLoadingActivations] = useState(false);

  // Form State (Generate)
  const [genQuantity, setGenQuantity] = useState(1);
  const [genCategoryId, setGenCategoryId] = useState("");
  const [genDurationType, setGenDurationType] = useState("months");
  const [genDurationValue, setGenDurationValue] = useState(1);
  const [genMaxDevices, setGenMaxDevices] = useState(1);
  const [submittingGen, setSubmittingGen] = useState(false);

  // Form State (Renew)
  const [renewDurationType, setRenewDurationType] = useState("months");
  const [renewDurationValue, setRenewDurationValue] = useState(3);
  const [submittingRenew, setSubmittingRenew] = useState(false);

  // Form State (Revoke)
  const [submittingRevoke, setSubmittingRevoke] = useState(false);
  const [submittingDelete, setSubmittingDelete] = useState(false);


  // General Notification alerts
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const showFeedback = (type: "success" | "error", msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 7000);
  };

  // Load Categories & Licenses
  async function loadCategories() {
    try {
      const data = await api.get<Category[]>("/api/categories");
      setCategories(data);
      if (data.length > 0 && !genCategoryId) {
        setGenCategoryId(data[0].id);
      }
    } catch (err) {
      console.error("Failed to load categories", err);
    }
  }

  async function loadLicenses(showError = true) {
    try {
      setLoading(true);
      const params = {
        page,
        page_size: pageSize,
        search: search || undefined,
        category_id: selectedCategory || undefined,
        status: selectedStatus || undefined
      };
      const data = await api.get<LicenseListResponse>("/api/licenses", params);
      setLicenses(data.items || []);
      setTotal(data.total || 0);
    } catch (err: unknown) {
      if (showError) {
        showFeedback("error", translateError(err));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
    // Initial category load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadLicenses();
    // Query changes are represented by the dependencies below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, selectedCategory, selectedStatus]);

  // Handle Search submit
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadLicenses();
  };

  // Actions: Generate Keys
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genCategoryId) {
      showFeedback("error", "Vui lòng chọn Category trước.");
      return;
    }
    setSubmittingGen(true);
    try {
      const requestedQuantity = Number(genQuantity);
      const createdLicenses = await api.post<License[]>("/api/licenses", {
        quantity: Number(genQuantity),
        duration_type: genDurationType,
        duration_value: genDurationType === "lifetime" ? null : Number(genDurationValue),
        max_devices: Number(genMaxDevices),
        category_id: genCategoryId
      });

      if (!Array.isArray(createdLicenses) || createdLicenses.length !== requestedQuantity) {
        throw new Error("Máy chủ không xác nhận đủ số lượng license key đã yêu cầu.");
      }

      showFeedback("success", `Tạo thành công ${createdLicenses.length} license key!`);
      setIsGenerateOpen(false);
      setPage(1);
      await loadLicenses(false);
    } catch (err: unknown) {
      showFeedback("error", `Tạo license key thất bại: ${translateError(err)}`);
    } finally {
      setSubmittingGen(false);
    }
  };

  // Actions: Load Activations
  const handleViewDevices = async (license: License) => {
    setSelectedLicense(license);
    setIsDevicesOpen(true);
    setLoadingActivations(true);
    try {
      const data = await api.get<Activation[]>(`/api/licenses/${license.id}/activations`);
      setActivations(data);
    } catch (err: unknown) {
      showFeedback("error", translateError(err));
    } finally {
      setLoadingActivations(false);
    }
  };

  // Actions: Renew License
  const handleRenewClick = (license: License) => {
    setSelectedLicense(license);
    setRenewDurationType(license.duration_type === "lifetime" ? "months" : license.duration_type);
    setRenewDurationValue(license.duration_value || 3);
    setIsRenewOpen(true);
  };

  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLicense) return;
    setSubmittingRenew(true);
    let success = false;
    try {
      await api.patch(`/api/licenses/${selectedLicense.id}/renew`, {
        duration_type: renewDurationType,
        duration_value: renewDurationType === "lifetime" ? null : Number(renewDurationValue)
      });
      success = true;
    } catch (err: unknown) {
      showFeedback("error", translateError(err));
    } finally {
      setSubmittingRenew(false);
    }
    if (success) {
      showFeedback("success", "✅ Gia hạn license key thành công!");
      setIsRenewOpen(false);
      try { await loadLicenses(); } catch { /* ignore */ }
    }
  };

  // Actions: Revoke/Delete
  const handleRevokeClick = (license: License) => {
    setSelectedLicense(license);
    setIsRevokeOpen(true);
  };

  const handleRevokeSubmit = async () => {
    if (!selectedLicense) return;
    setSubmittingRevoke(true);
    let success = false;
    try {
      await api.delete(`/api/licenses/${selectedLicense.id}`);
      success = true;
    } catch (err: unknown) {
      showFeedback("error", translateError(err));
    } finally {
      setSubmittingRevoke(false);
    }
    if (success) {
      showFeedback("success", "✅ Đã thu hồi license key thành công!");
      setIsRevokeOpen(false);
      try { await loadLicenses(); } catch { /* ignore */ }
    }
  };

  const handleDeleteClick = (license: License) => {
    setSelectedLicense(license);
    setIsDeleteOpen(true);
  };

  const handleDeleteSubmit = async () => {
    if (!selectedLicense || selectedLicense.status !== "revoked") return;
    setSubmittingDelete(true);
    try {
      await api.delete(`/api/licenses/${selectedLicense.id}/permanent`);
      showFeedback("success", "Đã xóa vĩnh viễn license key khỏi danh sách!");
      setIsDeleteOpen(false);
      setSelectedLicense(null);
      if (licenses.length === 1 && page > 1) {
        setPage((currentPage) => currentPage - 1);
      } else {
        await loadLicenses(false);
      }
    } catch (err: unknown) {
      showFeedback("error", `Xóa license key thất bại: ${translateError(err)}`);
    } finally {
      setSubmittingDelete(false);
    }
  };


  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* Feedback banner */}
      {feedback && (
        <div className={`fixed top-4 right-4 z-[9999] flex items-start gap-2.5 p-4 rounded-xl border shadow-xl max-w-md animate-in slide-in-from-top-4 duration-300
          ${feedback.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"}`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span className="text-sm font-semibold">{feedback.msg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">License Keys</h1>
          <p className="text-slate-400 text-sm mt-1">Review active clients, renew subscriptions, and generate new keys.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsGenerateOpen(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/10"
          >
            <Plus className="w-4.5 h-4.5" />
            <span>Generate Keys</span>
          </button>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center">
        {/* Search */}
        <form onSubmit={handleSearch} className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search license key..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-transparent transition-all text-xs"
          />
        </form>

        <div className="flex flex-wrap gap-3 items-center w-full md:w-auto md:ml-auto">
          {/* Category Filter */}
          <div className="relative flex items-center">
            <Filter className="w-3.5 h-3.5 text-slate-500 absolute left-3 pointer-events-none" />
            <select
              value={selectedCategory}
              onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
              className="pl-8 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:outline-none text-xs appearance-none cursor-pointer"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="relative flex items-center">
            <Filter className="w-3.5 h-3.5 text-slate-500 absolute left-3 pointer-events-none" />
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
              className="pl-8 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:outline-none text-xs appearance-none cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="new">New</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="lifetime">Lifetime</option>
              <option value="revoked">Revoked</option>
            </select>
          </div>
        </div>
      </div>

      {/* Licenses Table */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl shadow-md overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4 animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-slate-950 border border-slate-800/50 rounded-xl" />
            ))}
          </div>
        ) : licenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-2 border border-dashed border-slate-800/50 rounded-2xl m-4">
            <Key className="w-10 h-10 opacity-30 text-slate-400" />
            <span className="text-xs">No license keys found. Modify filters or click &quot;Generate Keys&quot;.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase tracking-wider bg-slate-950/20">
                  <th className="p-4">STT</th>
                  <th className="p-4">License Key</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Devices</th>
                  <th className="p-4">Duration</th>
                  <th className="p-4">Created</th>
                  <th className="p-4">Activated</th>
                  <th className="p-4">Expiration</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {licenses.map((lic, index) => (
                  <tr key={lic.id} className="hover:bg-slate-800/10 transition-colors">
                    <td className="p-4 text-xs text-slate-500 font-mono">
                      {(page - 1) * pageSize + index + 1}
                    </td>
                    <td className="p-4 font-mono font-bold text-slate-200 select-all">{lic.key}</td>
                    <td className="p-4 text-xs text-slate-400">{lic.category_name || "N/A"}</td>
                    <td className="p-4">
                      <button 
                        onClick={() => handleViewDevices(lic)}
                        className="text-xs text-slate-300 hover:text-blue-400 flex items-center gap-1.5 transition-colors"
                        title="View activated devices"
                      >
                        <Laptop className="w-3.5 h-3.5 text-slate-500" />
                        <span>{lic.devices_count} / {lic.max_devices}</span>
                      </button>
                    </td>
                    <td className="p-4 text-xs text-slate-400">
                      {lic.is_lifetime ? (
                        <span className="text-blue-400 font-medium">Lifetime</span>
                      ) : (
                        <span>{lic.duration_value} {lic.duration_type}</span>
                      )}
                    </td>
                    <td className="p-4 text-xs text-slate-500 font-mono whitespace-nowrap">
                      {new Date(lic.created_at).toLocaleString("vi-VN")}
                    </td>
                    <td className="p-4 text-xs text-slate-500 font-mono whitespace-nowrap">
                      {lic.activated_at ? new Date(lic.activated_at).toLocaleString("vi-VN") : (
                        <span className="text-slate-600 italic">Not activated</span>
                      )}
                    </td>
                    <td className="p-4 text-xs text-slate-500 font-mono">
                      {lic.is_lifetime ? (
                        <span className="text-blue-400 font-medium">Lifetime</span>
                      ) : lic.expires_at ? (
                        new Date(lic.expires_at).toLocaleString("vi-VN")
                      ) : (
                        <span className="text-slate-600 italic">Not activated</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border
                        ${lic.status === "new" && "text-blue-400 bg-blue-500/10 border-blue-500/20"}
                        ${lic.status === "active" && "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"}
                        ${lic.status === "expired" && "text-rose-400 bg-rose-500/10 border-rose-500/20"}
                        ${lic.status === "revoked" && "text-slate-500 bg-slate-500/10 border-slate-500/20"}
                      `}>
                        {lic.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleViewDevices(lic)}
                          className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
                          title="View activated devices"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {lic.status !== "revoked" && (
                          <>
                            <button
                              onClick={() => handleRenewClick(lic)}
                              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-blue-400 rounded-lg transition-colors"
                              title="Renew Key"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRevokeClick(lic)}
                              className="p-1.5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                              title="Revoke Key"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {lic.status === "revoked" && (
                          <button
                            onClick={() => handleDeleteClick(lic)}
                            className="p-1.5 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded-lg transition-colors"
                            title="Xóa vĩnh viễn khỏi danh sách"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="px-6 py-4 bg-slate-950/20 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span>Showing page {page} of {totalPages} ({total} total keys)</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="p-2 border border-slate-800 hover:bg-slate-800 disabled:opacity-30 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className="p-2 border border-slate-800 hover:bg-slate-800 disabled:opacity-30 rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* MODAL: Generate Keys */}
      {isGenerateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl relative">
            <div className="h-14 flex items-center justify-between px-6 border-b border-slate-800/80">
              <h3 className="text-base font-bold text-slate-100">Generate New License Keys</h3>
              <button 
                onClick={() => setIsGenerateOpen(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleGenerate} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Category Tier
                  </label>
                  <select
                    value={genCategoryId}
                    onChange={(e) => setGenCategoryId(e.target.value)}
                    className="block w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:outline-none text-xs"
                    required
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Quantity (1 - 100)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={genQuantity}
                    onChange={(e) => setGenQuantity(Number(e.target.value))}
                    className="block w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Duration Period
                  </label>
                  <select
                    value={genDurationType}
                    onChange={(e) => setGenDurationType(e.target.value)}
                    className="block w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:outline-none text-xs"
                  >
                    <option value="days">Days</option>
                    <option value="months">Months</option>
                    <option value="years">Years</option>
                    <option value="lifetime">Lifetime (Vô thời hạn)</option>
                  </select>
                </div>

                {genDurationType !== "lifetime" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Duration Value
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={genDurationValue}
                      onChange={(e) => setGenDurationValue(Number(e.target.value))}
                      className="block w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none text-xs"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Max Devices Limit (Per Key)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={genMaxDevices}
                  onChange={(e) => setGenMaxDevices(Number(e.target.value))}
                  className="block w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none text-xs"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setIsGenerateOpen(false)}
                  className="px-4 py-2 border border-slate-800 text-slate-300 hover:bg-slate-800 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingGen}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-blue-600/10 flex items-center gap-1.5"
                >
                  {submittingGen ? "Generating..." : "Generate Batch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Renew License */}
      {isRenewOpen && selectedLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl relative">
            <div className="h-14 flex items-center justify-between px-6 border-b border-slate-800/80">
              <h3 className="text-base font-bold text-slate-100">Renew License Key</h3>
              <button 
                onClick={() => setIsRenewOpen(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRenewSubmit} className="p-6 space-y-4">
              <div className="p-3 bg-slate-950 border border-slate-850 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">License Key</span>
                <div className="font-mono font-bold text-sm text-slate-300 select-all">{selectedLicense.key}</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Renew Period Type
                </label>
                <select
                  value={renewDurationType}
                  onChange={(e) => setRenewDurationType(e.target.value)}
                  className="block w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:outline-none text-xs"
                >
                  <option value="days">Days</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                  <option value="lifetime">Lifetime (Vô thời hạn)</option>
                </select>
              </div>

              {renewDurationType !== "lifetime" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Duration Value
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={renewDurationValue}
                    onChange={(e) => setRenewDurationValue(Number(e.target.value))}
                    className="block w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none text-xs"
                  />
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setIsRenewOpen(false)}
                  className="px-4 py-2 border border-slate-800 text-slate-300 hover:bg-slate-800 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRenew}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-blue-600/10"
                >
                  {submittingRenew ? "Renewing..." : "Extend License"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: View Activated Devices */}
      {isDevicesOpen && selectedLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl relative">
            <div className="h-14 flex items-center justify-between px-6 border-b border-slate-800/80">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-slate-100">Activated Devices List</h3>
                <p className="text-[10px] text-slate-400 font-mono select-all">Key: {selectedLicense.key}</p>
              </div>
              <button 
                onClick={() => setIsDevicesOpen(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 max-h-[400px] overflow-y-auto">
              {loadingActivations ? (
                <div className="space-y-4 animate-pulse">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="h-16 bg-slate-950 border border-slate-850 rounded-xl" />
                  ))}
                </div>
              ) : activations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-500 gap-1.5">
                  <Laptop className="w-8 h-8 opacity-30 text-slate-400" />
                  <span className="text-xs">No devices have activated this key yet.</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {activations.map((act) => (
                    <div key={act.id} className="bg-slate-950 border border-slate-850 rounded-xl p-4 space-y-3 shadow-inner hover:border-slate-800 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>{act.device_name || "PC Device"}</span>
                          </h4>
                          <span className="text-[10px] text-slate-500 font-mono block select-all">Fingerprint: {act.device_id}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 bg-slate-900 border border-slate-850 px-2 py-0.5 rounded-full font-mono">
                          {act.app_version ? `v${act.app_version}` : "v1.0.0"}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-[10px] text-slate-400 pt-2 border-t border-slate-900/80">
                        <div>
                          <span className="text-slate-500 uppercase block font-semibold">Client OS</span>
                          <span className="text-slate-300 font-medium">{act.os_info || "Windows / Linux"}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 uppercase block font-semibold">Activated Date</span>
                          <span className="text-slate-300 font-medium font-mono">{new Date(act.activated_at).toLocaleString("vi-VN")}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-500 uppercase block font-semibold">Last Checked Date</span>
                          <span className="text-slate-300 font-medium font-mono">
                            {act.last_checked_at ? new Date(act.last_checked_at).toLocaleString("vi-VN") : "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-slate-800/80 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDevicesOpen(false)}
                className="px-4 py-2 border border-slate-800 text-slate-300 hover:bg-slate-800 rounded-xl text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirm Revoke */}
      {isRevokeOpen && selectedLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl relative">
            <div className="h-14 flex items-center justify-between px-6 border-b border-slate-800/80">
              <h3 className="text-base font-bold text-slate-100">Revoke License Key</h3>
              <button 
                onClick={() => setIsRevokeOpen(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
                <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider">Warning Action Required</h4>
                  <p className="text-xs leading-relaxed text-rose-400/90">
                    Revoking this key blocks any further activation. Active client computers using this key will show <b>revoked</b> status on their next check-in. This action is irreversible.
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">License Key</span>
                <div className="font-mono font-bold text-sm text-slate-300 select-all">{selectedLicense.key}</div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setIsRevokeOpen(false)}
                  className="px-4 py-2 border border-slate-800 text-slate-300 hover:bg-slate-800 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRevokeSubmit}
                  disabled={submittingRevoke}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-rose-600/10"
                >
                  {submittingRevoke ? "Revoking..." : "Revoke Key"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirm Permanent Delete */}
      {isDeleteOpen && selectedLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-rose-500/20 rounded-2xl w-full max-w-md shadow-2xl relative">
            <div className="h-14 flex items-center justify-between px-6 border-b border-slate-800/80">
              <h3 className="text-base font-bold text-slate-100">Xóa License Key</h3>
              <button
                onClick={() => setIsDeleteOpen(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
                <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed">
                  License key này sẽ bị xóa vĩnh viễn khỏi danh sách và không thể khôi phục.
                </p>
              </div>

              <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">License Key</span>
                <div className="font-mono font-bold text-sm text-slate-300 select-all">{selectedLicense.key}</div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setIsDeleteOpen(false)}
                  className="px-4 py-2 border border-slate-800 text-slate-300 hover:bg-slate-800 rounded-xl text-xs font-semibold transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSubmit}
                  disabled={submittingDelete}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all"
                >
                  {submittingDelete ? "Đang xóa..." : "Xóa vĩnh viễn"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
