"use client";

import React, { useEffect, useState } from "react";
import { syncManager, SyncStatusListener } from "@/lib/offline/sync-manager";
import { Wifi, WifiOff, RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";

export function OfflineStatusIndicator({ workspaceId }: { workspaceId?: string }) {
  const [status, setStatus] = useState({
    total: 0,
    waiting: 0,
    syncing: 0,
    synced: 0,
    failed: 0,
    conflict: 0,
    isOnline: true,
  });
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  useEffect(() => {
    const unsubscribe = syncManager.subscribe((summary) => {
      setStatus(summary);
    });

    return () => unsubscribe();
  }, [workspaceId]);

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    try {
      await syncManager.processQueue(workspaceId);
    } finally {
      setIsManualSyncing(false);
    }
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      {/* Online/Offline status pill */}
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium transition-colors ${
          status.isOnline
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : "bg-amber-50 text-amber-700 border border-amber-200"
        }`}
        title={status.isOnline ? "Device is connected to the internet" : "Device is currently offline"}
      >
        {status.isOnline ? (
          <>
            <Wifi className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>Online</span>
          </>
        ) : (
          <>
            <WifiOff className="w-3.5 h-3.5 text-amber-600" />
            <span>Offline Mode</span>
          </>
        )}
      </div>

      {/* Sync Queue status pill */}
      {status.syncing > 0 || isManualSyncing ? (
        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
          <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
          <span>Syncing...</span>
        </div>
      ) : status.waiting > 0 ? (
        <button
          onClick={handleManualSync}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors"
          title="Click to force synchronization"
        >
          <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
          <span>{status.waiting} waiting to sync</span>
        </button>
      ) : status.failed > 0 ? (
        <button
          onClick={handleManualSync}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
          title="Click to retry failed operations"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          <span>{status.failed} failed sync</span>
        </button>
      ) : (
        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-200">
          <CheckCircle className="w-3.5 h-3.5 text-slate-500" />
          <span>All changes synced</span>
        </div>
      )}
    </div>
  );
}
