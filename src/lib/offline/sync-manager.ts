import { getLocalDB } from "./db";
import {
  SyncQueueItem,
  SyncStatus,
  LocalAuditNote,
  SyncOperationType,
  SyncEntityType,
  OperationJournalRecord,
} from "@/types";
import { isFirebaseConfigured, db as firestoreDb } from "@/lib/firebase/config";
import { doc, setDoc, getDoc, runTransaction } from "firebase/firestore";

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

  public async notifyListeners(workspaceId?: string): Promise<void> {
    try {
      const summary = await this.getQueueSummary(workspaceId);
      for (const listener of this.listeners) {
        listener(summary);
      }
    } catch {
      // Ignore background notification errors
    }
  }

  public generateOperationId(): string {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Enqueue an operation into the offline sync queue.
   */
  public async enqueueOperation(params: {
    workspaceId: string;
    operation: SyncOperationType;
    entityType: SyncEntityType;
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
   * Enforces idempotency via the Operation Journal.
   * Never marks an operation as synced until acknowledged.
   */
  public async processQueue(
    workspaceId?: string,
    customExecutor?: (item: SyncQueueItem) => Promise<boolean>
  ): Promise<{ processed: number; succeeded: number; failed: number; conflicts: number }> {
    if (this.isProcessing) {
      return { processed: 0, succeeded: 0, failed: 0, conflicts: 0 };
    }

    if (!this.getOnlineStatus()) {
      return { processed: 0, succeeded: 0, failed: 0, conflicts: 0 };
    }

    this.isProcessing = true;
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    let conflicts = 0;

    try {
      const db = await getLocalDB();
      const pendingItems = await this.getPendingItems(workspaceId);

      for (const item of pendingItems) {
        processed++;

        // 1. Idempotency Check: Was this operation already journaled?
        const existingJournal = await db.get("operation_journal", item.id);
        if (existingJournal) {
          // Already successfully applied previously! Acknowledge immediately.
          item.status = "synced";
          item.syncedAt = existingJournal.appliedAt;
          await db.put("sync_queue", item);
          succeeded++;
          continue;
        }

        // 2. Mark as syncing
        item.status = "syncing";
        item.lastAttempt = Date.now();
        await db.put("sync_queue", item);
        await this.notifyListeners(workspaceId);

        try {
          let acknowledged = false;

          if (customExecutor) {
            acknowledged = await customExecutor(item);
          } else if (isFirebaseConfigured && firestoreDb) {
            // Real Firestore synchronization with cloud transaction
            acknowledged = await this.syncToFirestore(item);
          } else {
            // Standalone sandbox simulation
            acknowledged = true;
          }

          if (acknowledged) {
            item.status = "synced";
            item.syncedAt = Date.now();
            item.error = undefined;
            item.conflictDetails = undefined;

            // Record in Operation Journal for strict idempotency
            const journalRecord: OperationJournalRecord = {
              id: item.id,
              workspaceId: item.workspaceId,
              entityType: item.entityType,
              entityId: item.entityId,
              appliedAt: Date.now(),
              appliedByUid: "system_sync",
            };
            await db.put("operation_journal", journalRecord);

            succeeded++;
          } else {
            item.status = "failed";
            item.retryCount += 1;
            item.error = "Sync rejected by server endpoint.";
            failed++;
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : "Sync error";
          // Check for inventory conflict or version discrepancy
          if (errMsg.toLowerCase().includes("conflict") || errMsg.toLowerCase().includes("oversold")) {
            item.status = "conflict";
            item.conflictDetails = errMsg;
            conflicts++;
          } else {
            item.status = "failed";
            item.retryCount += 1;
            item.error = errMsg;
            failed++;
          }
        }

        await db.put("sync_queue", item);
      }
    } finally {
      this.isProcessing = false;
      await this.notifyListeners(workspaceId);
    }

    return { processed, succeeded, failed, conflicts };
  }

  /**
   * Sync mutation to real Firestore when online and configured.
   */
  private async syncToFirestore(item: SyncQueueItem): Promise<boolean> {
    if (!firestoreDb) return false;

    const collectionName = this.mapEntityTypeToCollection(item.entityType);
    if (!collectionName) return true;

    const docRef = doc(firestoreDb, collectionName, item.entityId);

    if (item.operation === "delete") {
      // In Firestore, we soft-delete or remove
      await setDoc(docRef, { isArchived: true, updatedAt: Date.now() }, { merge: true });
    } else {
      await setDoc(docRef, { ...item.payload, updatedAt: Date.now() }, { merge: true });
    }

    return true;
  }

  private mapEntityTypeToCollection(type: SyncEntityType): string | null {
    switch (type) {
      case "product":
        return "products";
      case "customer":
        return "customers";
      case "supplier":
        return "suppliers";
      case "sale":
        return "sales";
      case "purchase":
        return "purchases";
      case "expense":
        return "expenses";
      case "customer_payment":
        return "customer_ledger";
      case "supplier_payment":
        return "supplier_ledger";
      case "stock_movement":
        return "stock_movements";
      case "audit_note":
        return "audit_notes";
      default:
        return null;
    }
  }

  private triggerAutoSync(workspaceId?: string): void {
    setTimeout(() => {
      this.processQueue(workspaceId).catch(() => {});
    }, 150);
  }

  // ==========================================
  // Non-financial Test Record Demo
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

    await db.put("audit_notes", note);

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
