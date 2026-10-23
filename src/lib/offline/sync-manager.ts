import { getLocalDB } from "./db";
import { SyncQueueItem, SyncStatus, LocalAuditNote, SyncOperationType } from "@/types";

export type SyncStatusListener = (queueSummary: {
  total: number;
  waiting: number;
  syncing: number;
  synced: number;
  failed: number;
  conflict: number;
  isOnline: boolean;
}) => void;

class OfflineSyncService {
  private listeners: Set<SyncStatusListener> = new Set();
  private isProcessing = false;
  private simulatedOnline: boolean | null = null;
  private isOnline =
    typeof window !== "undefined" && typeof navigator !== "undefined" && typeof navigator.onLine === "boolean"
      ? navigator.onLine
      : true;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        this.isOnline = true;
        this.notifyListeners();
        this.triggerAutoSync();
      });

      window.addEventListener("offline", () => {
        this.isOnline = false;
        this.notifyListeners();
      });
    }
  }

  public getOnlineStatus(): boolean {
    if (this.simulatedOnline !== null) {
      return this.simulatedOnline;
    }
    if (typeof window !== "undefined" && typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
      return navigator.onLine;
    }
    return this.isOnline;
  }

  public setOnlineStatusForTesting(online: boolean | null): void {
    this.simulatedOnline = online;
    this.notifyListeners();
  }

  public subscribe(listener: SyncStatusListener): () => void {
    this.listeners.add(listener);
    this.notifyListeners();
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async notifyListeners(workspaceId?: string): Promise<void> {
    try {
      const summary = await this.getQueueSummary(workspaceId);
      for (const listener of this.listeners) {
        listener(summary);
      }
    } catch {
      // Ignore background notification errors
    }
  }

  /**
   * Generates a collision-resistant UUID for idempotent operations.
   */
  public generateOperationId(): string {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Enqueue an operation into the offline sync queue.
   * State transitions: saved_locally -> waiting_to_sync
   */
  public async enqueueOperation(params: {
    workspaceId: string;
    operation: SyncOperationType;
    entityType: SyncQueueItem["entityType"];
    entityId: string;
    payload: Record<string, unknown>;
  }): Promise<SyncQueueItem> {
    const db = await getLocalDB();
    const id = this.generateOperationId();
    const now = Date.now();

    const queueItem: SyncQueueItem = {
      id,
      workspaceId: params.workspaceId,
      operation: params.operation,
      entityType: params.entityType,
      entityId: params.entityId,
      payload: params.payload,
      status: "waiting_to_sync",
      retryCount: 0,
      createdAt: now,
    };

    // Save to IndexedDB
    await db.put("sync_queue", queueItem);
    await this.notifyListeners(params.workspaceId);

    // If online, trigger processing in background
    if (this.getOnlineStatus()) {
      this.triggerAutoSync(params.workspaceId);
    }

    return queueItem;
  }

  public async getQueueSummary(workspaceId?: string): Promise<{
    total: number;
    waiting: number;
    syncing: number;
    synced: number;
    failed: number;
    conflict: number;
    isOnline: boolean;
  }> {
    try {
      const db = await getLocalDB();
      const allItems = await db.getAll("sync_queue");
      const filtered = workspaceId
        ? allItems.filter((item) => item.workspaceId === workspaceId)
        : allItems;

      let waiting = 0;
      let syncing = 0;
      let synced = 0;
      let failed = 0;
      let conflict = 0;

      for (const item of filtered) {
        if (item.status === "waiting_to_sync" || item.status === "saved_locally") waiting++;
        else if (item.status === "syncing") syncing++;
        else if (item.status === "synced") synced++;
        else if (item.status === "failed") failed++;
        else if (item.status === "conflict") conflict++;
      }

      return {
        total: filtered.length,
        waiting,
        syncing,
        synced,
        failed,
        conflict,
        isOnline: this.getOnlineStatus(),
      };
    } catch {
      return {
        total: 0,
        waiting: 0,
        syncing: 0,
        synced: 0,
        failed: 0,
        conflict: 0,
        isOnline: this.getOnlineStatus(),
      };
    }
  }

  public async getPendingItems(workspaceId?: string): Promise<SyncQueueItem[]> {
    const db = await getLocalDB();
    const all = await db.getAll("sync_queue");
    return all.filter(
      (item) =>
        (!workspaceId || item.workspaceId === workspaceId) &&
        (item.status === "waiting_to_sync" || item.status === "failed")
    );
  }

  public async getAllQueueItems(workspaceId?: string): Promise<SyncQueueItem[]> {
    const db = await getLocalDB();
    const all = await db.getAll("sync_queue");
    return workspaceId ? all.filter((item) => item.workspaceId === workspaceId) : all;
  }

  /**
   * Process pending queue items.
   * Uses an executor function or simulated sync if no custom executor is provided.
   */
  public async processQueue(
    workspaceId?: string,
    executor?: (item: SyncQueueItem) => Promise<boolean>
  ): Promise<{ processed: number; succeeded: number; failed: number }> {
    if (this.isProcessing) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    if (!this.getOnlineStatus()) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    this.isProcessing = true;
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    try {
      const db = await getLocalDB();
      const pendingItems = await this.getPendingItems(workspaceId);

      for (const item of pendingItems) {
        processed++;

        // Mark as syncing
        item.status = "syncing";
        item.lastAttempt = Date.now();
        await db.put("sync_queue", item);
        await this.notifyListeners(workspaceId);

        try {
          let success = false;
          if (executor) {
            success = await executor(item);
          } else {
            // Default sync simulation/acknowledgement for standalone testing
            success = true;
          }

          if (success) {
            item.status = "synced";
            item.syncedAt = Date.now();
            item.error = undefined;
            succeeded++;
          } else {
            item.status = "failed";
            item.retryCount += 1;
            item.error = "Sync executor returned false";
            failed++;
          }
        } catch (err: unknown) {
          item.status = "failed";
          item.retryCount += 1;
          item.error = err instanceof Error ? err.message : "Sync error";
          failed++;
        }

        await db.put("sync_queue", item);
      }
    } finally {
      this.isProcessing = false;
      await this.notifyListeners(workspaceId);
    }

    return { processed, succeeded, failed };
  }

  private triggerAutoSync(workspaceId?: string): void {
    setTimeout(() => {
      this.processQueue(workspaceId).catch(() => {});
    }, 100);
  }

  // ==========================================
  // Non-financial Test Record Demo (Part 8)
  // Demonstrates Local Persistence & Sync Queue
  // ==========================================

  public async saveLocalAuditNote(noteData: {
    workspaceId: string;
    title: string;
    content: string;
    authorUid: string;
    authorEmail: string;
  }): Promise<LocalAuditNote> {
    const db = await getLocalDB();
    const noteId = `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();

    const note: LocalAuditNote = {
      id: noteId,
      workspaceId: noteData.workspaceId,
      title: noteData.title,
      content: noteData.content,
      authorUid: noteData.authorUid,
      authorEmail: noteData.authorEmail,
      createdAt: now,
      synced: false,
    };

    // 1. Save locally in IndexedDB
    await db.put("audit_notes", note);

    // 2. Enqueue in sync queue
    await this.enqueueOperation({
      workspaceId: noteData.workspaceId,
      operation: "create",
      entityType: "audit_note",
      entityId: noteId,
      payload: {
        title: note.title,
        content: note.content,
        authorUid: note.authorUid,
        authorEmail: note.authorEmail,
        createdAt: note.createdAt,
      },
    });

    return note;
  }

  public async getAuditNotes(workspaceId: string): Promise<LocalAuditNote[]> {
    const db = await getLocalDB();
    const allNotes = await db.getAll("audit_notes");
    return allNotes
      .filter((n) => n.workspaceId === workspaceId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }
}

export const syncManager = new OfflineSyncService();
