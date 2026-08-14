"use client";

import { useCallback, useEffect, useState } from "react";
import { api, getErrorMessage } from "@/lib/api";
import { AlertCircle, CheckCircle2, Loader2, Play, RefreshCw, Terminal } from "lucide-react";

interface CurrentVersionResponse {
  current_version: string;
}

interface UpdateCheckResponse {
  current_version: string;
  latest_version: string;
  update_available: boolean;
}

interface UpdateStatusResponse {
  running?: boolean;
  status?: string;
  message?: string;
  version?: string;
  log?: string;
}

export default function UpdatesPage() {
  const [currentVersion, setCurrentVersion] = useState("-");
  const [latestVersion, setLatestVersion] = useState("");
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [checked, setChecked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [updateLog, setUpdateLog] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadCurrentVersion = useCallback(async () => {
    try {
      const data = await api.get<CurrentVersionResponse>("/api/system/update/current");
      setCurrentVersion(data.current_version);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load current version."));
    }
  }, []);

  const loadUpdateStatus = useCallback(async () => {
    try {
      const data = await api.get<UpdateStatusResponse>("/api/system/update/status");
      setUpdateLog(data.log || "");

      if (data.status === "completed") {
        const completedVersion = data.version || latestVersion;
        setUpdating(false);
        setUpdateAvailable(false);
        setChecked(false);
        if (completedVersion) {
          setCurrentVersion(completedVersion);
          setMessage(`Đã cập nhật phiên bản ${completedVersion} thành công.`);
        } else {
          setMessage(data.message || "Đã cập nhật phiên bản mới thành công.");
        }
        return;
      }

      if (data.status === "failed") {
        setUpdating(false);
        setError(data.message || "Cập nhật thất bại. Vui lòng xem log bên dưới.");
        return;
      }

      if (data.running || data.status === "running") {
        setUpdating(true);
        setMessage(data.message || "Đang cập nhật hệ thống...");
      }
    } catch {
      if (updating) {
        setMessage("Server đang restart hoặc đang cập nhật. Đang thử kết nối lại...");
      }
    }
  }, [latestVersion, updating]);

  useEffect(() => {
    loadCurrentVersion();
  }, [loadCurrentVersion]);

  useEffect(() => {
    if (!showLog) {
      return;
    }

    loadUpdateStatus();
    const interval = window.setInterval(loadUpdateStatus, 3000);
    return () => window.clearInterval(interval);
  }, [loadUpdateStatus, showLog]);

  const checkVersion = async () => {
    setChecking(true);
    setChecked(false);
    setError("");
    setMessage("");
    setLatestVersion("");
    setUpdateAvailable(false);

    try {
      const data = await api.get<UpdateCheckResponse>("/api/system/update/check");
      setCurrentVersion(data.current_version);
      setLatestVersion(data.latest_version);
      setUpdateAvailable(data.update_available);
      setChecked(true);
      setMessage(
        data.update_available
          ? `Có phiên bản mới ${data.latest_version}.`
          : "Bạn đang dùng phiên bản mới nhất."
      );
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to check version."));
    } finally {
      setChecking(false);
    }
  };

  const runUpdate = async () => {
    const confirmed = window.confirm("Bắt đầu cập nhật phiên bản mới?");
    if (!confirmed) {
      return;
    }

    setUpdating(true);
    setShowLog(true);
    setUpdateLog("");
    setError("");
    setMessage("Đã bắt đầu cập nhật. Đang lấy log từ server...");

    try {
      const data = await api.post<UpdateStatusResponse>("/api/system/update/run");
      setUpdateLog(data.log || "");
      setMessage(data.message || "Đã bắt đầu cập nhật. Server sẽ tự rebuild và restart khi hoàn tất.");
      window.setTimeout(loadUpdateStatus, 1000);
    } catch (err: unknown) {
      setUpdating(false);
      setError(getErrorMessage(err, "Failed to start update."));
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">System Updates</h1>
        <p className="text-slate-400 text-sm mt-1">Kiểm tra và cập nhật phiên bản hệ thống.</p>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="flex items-start gap-2.5 p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{message}</span>
        </div>
      )}

      <section className="max-w-2xl bg-slate-900 border border-slate-800/80 rounded-2xl p-6 lg:p-8 shadow-md">
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Version hiện tại</p>
          <p className="mt-3 text-4xl font-black text-slate-100">{currentVersion}</p>
        </div>

        {checked && updateAvailable && (
          <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
            Phiên bản mới: <span className="font-bold">{latestVersion}</span>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={checkVersion}
            disabled={checking || updating}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-5 py-3 text-xs font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-50 transition-all"
          >
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span>Kiểm tra version</span>
          </button>

          {updateAvailable && (
            <button
              type="button"
              onClick={runUpdate}
              disabled={updating || checking}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-semibold text-white shadow-lg shadow-blue-600/10 hover:bg-blue-500 disabled:opacity-50 transition-all"
            >
              {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              <span>{updating ? "Đang cập nhật..." : "Cập nhật phiên bản mới"}</span>
            </button>
          )}
        </div>
      </section>

      {showLog && (
        <section className="max-w-4xl bg-slate-900 border border-slate-800/80 rounded-2xl p-6 lg:p-8 shadow-md">
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2.5">
            <Terminal className="w-5 h-5 text-blue-500" />
            <span>Log cập nhật</span>
          </h3>
          <pre className="mt-5 max-h-96 overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 whitespace-pre-wrap text-xs leading-relaxed text-slate-300">
            {updateLog || "Đang chờ log cập nhật..."}
          </pre>
        </section>
      )}
    </div>
  );
}
