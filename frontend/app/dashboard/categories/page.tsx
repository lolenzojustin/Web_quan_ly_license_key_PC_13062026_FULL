"use client";

import { useEffect, useState } from "react";
import { api, getErrorMessage } from "@/lib/api";
import { FolderKanban, Plus, AlertCircle, Pencil, Trash2, X, ExternalLink } from "lucide-react";

interface Category {
  id: string;
  name: string;
  description: string | null;
  version: string | null;
  update_url: string | null;
  created_at: string;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modal state
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editVersion, setEditVersion] = useState("");
  const [editUpdateUrl, setEditUpdateUrl] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");

  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [deleteAuthCode, setDeleteAuthCode] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function loadCategories() {
    try {
      setLoading(true);
      const data = await api.get<Category[]>("/api/categories");
      setCategories(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load categories."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      await api.post("/api/categories", {
        name,
        description: description || null,
      });
      setSuccess(`Category "${name}" created successfully.`);
      setName("");
      setDescription("");
      // Reload categories list
      const data = await api.get<Category[]>("/api/categories");
      setCategories(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to create category."));
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setEditVersion(cat.version || "");
    setEditUpdateUrl(cat.update_url || "");
    setEditError("");
  };

  const closeEditModal = () => {
    setEditingCategory(null);
    setEditVersion("");
    setEditUpdateUrl("");
    setEditError("");
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    setEditError("");
    setEditSubmitting(true);

    try {
      await api.patch(`/api/categories/${editingCategory.id}/version`, {
        version: editVersion,
        update_url: editUpdateUrl || null,
      });
      // Reload categories list
      const data = await api.get<Category[]>("/api/categories");
      setCategories(data);
      closeEditModal();
    } catch (err: unknown) {
      setEditError(getErrorMessage(err, "Failed to update version."));
    } finally {
      setEditSubmitting(false);
    }
  };

  const openDeleteModal = (cat: Category) => {
    setDeletingCategory(cat);
    setDeleteAuthCode("");
    setDeleteError("");
  };

  const closeDeleteModal = () => {
    setDeletingCategory(null);
    setDeleteAuthCode("");
    setDeleteError("");
  };

  const handleDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingCategory) return;
    setDeleteError("");
    setDeleteSubmitting(true);

    try {
      await api.delete(`/api/categories/${deletingCategory.id}?auth_code=${encodeURIComponent(deleteAuthCode)}`);
      // Reload categories list
      const data = await api.get<Category[]>("/api/categories");
      setCategories(data);
      closeDeleteModal();
    } catch (err: unknown) {
      setDeleteError(getErrorMessage(err, "Failed to delete category."));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Intro section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">Category Profiles</h1>
          <p className="text-slate-400 text-sm mt-1">Manage and segregate license keys under products or pricing tiers.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Create category card */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-md h-fit">
          <h3 className="text-lg font-bold text-slate-100 mb-5 flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-500" />
            <span>Create Category</span>
          </h3>

          {error && (
            <div className="mb-4 flex items-start gap-2.5 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 flex items-start gap-2.5 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="cat-name" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Category Name
              </label>
              <input
                id="cat-name"
                type="text"
                required
                placeholder="e.g. Photoshop Plugin Premium"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="block w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all text-sm"
              />
            </div>

            <div>
              <label htmlFor="cat-desc" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Description
              </label>
              <textarea
                id="cat-desc"
                rows={3}
                placeholder="Brief description of the product or features unlocked by keys in this tier."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="block w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all text-sm resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Creating...</span>
                </>
              ) : (
                <span>Add Category</span>
              )}
            </button>
          </form>
        </div>

        {/* Categories list table */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 lg:col-span-2 shadow-md">
          <h3 className="text-lg font-bold text-slate-100 mb-5 flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-blue-500" />
            <span>Category Profiles</span>
          </h3>

          {loading ? (
            <div className="space-y-4 animate-pulse">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 bg-slate-950 border border-slate-800/50 rounded-xl" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-2 border border-dashed border-slate-800 rounded-xl">
              <FolderKanban className="w-8 h-8 opacity-40 text-slate-400" />
              <span className="text-xs">No categories created yet. Fill the form to create your first category.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="pb-3 font-semibold">Category Name</th>
                    <th className="pb-3 font-semibold">Category ID</th>
                    <th className="pb-3 font-semibold">Description</th>
                    <th className="pb-3 font-semibold">Version</th>
                    <th className="pb-3 font-semibold">Created Date</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {categories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-slate-800/10 transition-colors group">
                      <td className="py-4 font-semibold text-slate-200 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500/20 border border-blue-500/50 shrink-0" />
                        <span>{cat.name}</span>
                      </td>
                      <td className="py-4 font-mono text-xs text-slate-500 select-all truncate max-w-[140px]" title={cat.id}>
                        {cat.id}
                      </td>
                      <td className="py-4 text-slate-400 text-xs max-w-xs truncate" title={cat.description || ""}>
                        {cat.description || <span className="italic text-slate-600">No description</span>}
                      </td>
                      <td className="py-4">
                        {cat.version ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-semibold">
                              v{cat.version}
                            </span>
                            {cat.update_url && (
                              <a
                                href={cat.update_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={cat.update_url}
                                className="text-blue-400 hover:text-blue-300 transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-600 text-xs italic">—</span>
                        )}
                      </td>
                      <td className="py-4 text-slate-500 text-xs font-mono">
                        {new Date(cat.created_at).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(cat)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-lg transition-all opacity-60 group-hover:opacity-100"
                            title="Edit version & update URL"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => openDeleteModal(cat)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-400 bg-slate-800 hover:bg-rose-950/30 border border-slate-700 hover:border-rose-900/50 rounded-lg transition-all opacity-60 group-hover:opacity-100"
                            title="Delete category"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit Version Modal */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeEditModal}
          />

          {/* Modal */}
          <div className="relative w-full max-w-md mx-4 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-0">
              <div>
                <h3 className="text-lg font-bold text-slate-100">Edit Version</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Update version & download URL for <span className="font-semibold text-slate-300">{editingCategory.name}</span>
                </p>
              </div>
              <button
                onClick={closeEditModal}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleEditSubmit} className="p-6 space-y-5">
              {editError && (
                <div className="flex items-start gap-2.5 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{editError}</span>
                </div>
              )}

              <div>
                <label htmlFor="edit-version" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Version
                </label>
                <input
                  id="edit-version"
                  type="text"
                  required
                  placeholder="e.g. 1.0.0"
                  value={editVersion}
                  onChange={(e) => setEditVersion(e.target.value)}
                  className="block w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all text-sm font-mono"
                />
              </div>

              <div>
                <label htmlFor="edit-url" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Update URL
                </label>
                <input
                  id="edit-url"
                  type="url"
                  placeholder="https://example.com/download/tool-v1.0.0.zip"
                  value={editUpdateUrl}
                  onChange={(e) => setEditUpdateUrl(e.target.value)}
                  className="block w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all text-sm"
                />
                <p className="text-xs text-slate-500 mt-1.5">Link download cho phiên bản này (tùy chọn)</p>
              </div>

              {/* Footer buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2 text-xs font-medium text-slate-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting || !editVersion.trim()}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-2"
                >
                  {editSubmitting ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Category Modal */}
      {deletingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeDeleteModal}
          />

          {/* Modal */}
          <div className="relative w-full max-w-md mx-4 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-0">
              <div>
                <h3 className="text-lg font-bold text-rose-500">Delete Category</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Are you sure you want to delete <span className="font-semibold text-slate-300">{deletingCategory.name}</span>?
                </p>
              </div>
              <button
                onClick={closeDeleteModal}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleDeleteSubmit} className="p-6 space-y-5">
              {deleteError && (
                <div className="flex items-start gap-2.5 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{deleteError}</span>
                </div>
              )}

              <div>
                <label htmlFor="delete-auth-code" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Security Code / Mã Thay Đổi Mật Khẩu
                </label>
                <input
                  id="delete-auth-code"
                  type="password"
                  required
                  placeholder="Enter security code to confirm"
                  value={deleteAuthCode}
                  onChange={(e) => setDeleteAuthCode(e.target.value)}
                  className="block w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-600 focus:border-transparent transition-all text-sm"
                />
              </div>

              {/* Footer buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  className="px-4 py-2 text-xs font-medium text-slate-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleteSubmitting || !deleteAuthCode}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 active:scale-[0.98] disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-2"
                >
                  {deleteSubmitting ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Delete Category</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
