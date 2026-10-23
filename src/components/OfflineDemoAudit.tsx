"use client";

import React, { useState, useEffect } from "react";
import { syncManager } from "@/lib/offline/sync-manager";
import { LocalAuditNote, SyncQueueItem } from "@/types";
import { useAuth } from "@/lib/firebase/auth-context";
import {
  FileText,
  PlusCircle,
  Database,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Wifi,
  WifiOff,
} from "lucide-react";

export function OfflineDemoAudit() {
  const { workspace, userProfile } = useAuth();
  const [notes, setNotes] = useState<LocalAuditNote[]>([]);
  const [queueItems, setQueueItems] = useState<SyncQueueItem[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(false);
  const [activeTab, setActiveTab] = useState<"notes" | "queue">("notes");

  const loadData = async () => {
    if (!workspace) return;
    try {
      const localNotes = await syncManager.getAuditNotes(workspace.id);
      const queue = await syncManager.getAllQueueItems(workspace.id);
      setNotes(localNotes);
      setQueueItems(queue.sort((a, b) => b.createdAt - a.createdAt));
    } catch (e) {
      console.error("Error loading offline audit records:", e);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = syncManager.subscribe(() => {
      loadData();
    });
    return () => unsub();
  }, [workspace]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !title.trim() || !content.trim()) return;

    setIsSubmitting(true);
    try {
      await syncManager.saveLocalAuditNote({
        workspaceId: workspace.id,
        title: title.trim(),
        content: content.trim(),
        authorUid: userProfile?.uid || "local_user",
        authorEmail: userProfile?.email || "owner@shop.local",
      });

      setTitle("");
      setContent("");
      await loadData();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleOfflineSimulator = () => {
    const nextState = !isSimulatedOffline;
    setIsSimulatedOffline(nextState);
    syncManager.setOnlineStatusForTesting(!nextState);
  };

  const handleManualProcess = async () => {
    if (!workspace) return;
    await syncManager.processQueue(workspace.id);
    await loadData();
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-900 text-lg">
              Offline Data & Sync Engine Test Lab
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Demonstrating real IndexedDB storage, atomic operation queues, and idempotent synchronization states.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Offline Simulator Switch */}
          <button
            type="button"
            onClick={handleToggleOfflineSimulator}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isSimulatedOffline
                ? "bg-amber-100 text-amber-800 border-amber-300"
                : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
            }`}
          >
            {isSimulatedOffline ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-700" />
                <span>Simulating Offline</span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                <span>Simulate Offline</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleManualProcess}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Process Queue</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        {/* Form: Create local audit record */}
        <div className="lg:col-span-5 bg-slate-50/80 p-5 rounded-xl border border-slate-200">
          <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-3">
            <PlusCircle className="w-4 h-4 text-indigo-600" />
            Create Local Store Audit Note
          </h4>
          <p className="text-xs text-slate-500 mb-4">
            Notes are saved instantly to IndexedDB and pushed to the sync queue with an idempotent UUID.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Note / Activity Title
              </label>
              <input
                type="text"
                placeholder="e.g. Stock count verify shelf 3"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Operational Details / Observations
              </label>
              <textarea
                placeholder="Enter non-financial audit note, physical check findings, or shopkeeper memo..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={3}
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !title || !content}
              className="w-full py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium disabled:opacity-50 transition-colors shadow-sm"
            >
              {isSubmitting ? "Persisting Locally..." : "Save Record (IndexedDB + Queue)"}
            </button>
          </form>
        </div>

        {/* Records & Queue inspection */}
        <div className="lg:col-span-7">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-4">
            <button
              onClick={() => setActiveTab("notes")}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                activeTab === "notes"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 hover:text-slate-900 bg-slate-100"
              }`}
            >
              Stored Records ({notes.length})
            </button>
            <button
              onClick={() => setActiveTab("queue")}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                activeTab === "queue"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 hover:text-slate-900 bg-slate-100"
              }`}
            >
              Sync Queue ({queueItems.length})
            </button>
          </div>

          {activeTab === "notes" ? (
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {notes.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-slate-400 text-xs">
                  No local audit notes yet. Create one on the left to test offline persistence!
                </div>
              ) : (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm text-xs hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-center justify-between font-medium text-slate-800">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="font-semibold">{note.title}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(note.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-slate-600 mt-1 text-[11px] leading-relaxed">
                      {note.content}
                    </p>
                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100 text-[10px] text-slate-400">
                      <span>ID: {note.id}</span>
                      <span className="text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">
                        Persisted in IndexedDB
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {queueItems.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-slate-400 text-xs">
                  Sync queue is currently empty.
                </div>
              ) : (
                queueItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-semibold text-slate-700">
                        {item.operation.toUpperCase()} {item.entityType} ({item.entityId})
                      </span>
                      {item.status === "synced" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Synced
                        </span>
                      ) : item.status === "syncing" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                          <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" /> Syncing
                        </span>
                      ) : item.status === "waiting_to_sync" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3 text-amber-600" /> Waiting to Sync
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
                          <AlertCircle className="w-3 h-3 text-rose-600" /> {item.status}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 font-mono truncate">
                      Op UUID: {item.id}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
