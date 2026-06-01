"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { FolderKanban, Plus, FileText, Calendar, AlertCircle } from "lucide-react";

interface Category {
  id: string;
  name: string;
  description: string | null;
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

  async function loadCategories() {
    try {
      setLoading(true);
      const data = await api.get("/api/categories");
      setCategories(data);
    } catch (err: any) {
      setError(err.message || "Failed to load categories.");
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
      const data = await api.get("/api/categories");
      setCategories(data);
    } catch (err: any) {
      setError(err.message || "Failed to create category.");
    } finally {
      setSubmitting(false);
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
                    <th className="pb-3 font-semibold">Description</th>
                    <th className="pb-3 font-semibold">Created Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {categories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-slate-800/10 transition-colors">
                      <td className="py-4 font-semibold text-slate-200 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500/20 border border-blue-500/50 shrink-0" />
                        <span>{cat.name}</span>
                      </td>
                      <td className="py-4 text-slate-400 text-xs max-w-xs truncate" title={cat.description || ""}>
                        {cat.description || <span className="italic text-slate-600">No description</span>}
                      </td>
                      <td className="py-4 text-slate-500 text-xs font-mono">
                        {new Date(cat.created_at).toLocaleDateString("vi-VN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
