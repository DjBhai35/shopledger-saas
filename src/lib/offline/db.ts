import { openDB, DBSchema, IDBPDatabase } from "idb";
import { SyncQueueItem, LocalAuditNote, Workspace } from "@/types";

const DB_NAME = "shopledger_local_db";
const DB_VERSION = 1;

export interface ShopLedgerDBSchema extends DBSchema {
  workspaces: {
    key: string;
    value: Workspace;
  };
  sync_queue: {
    key: string;
    value: SyncQueueItem;
    indexes: {
      by_workspace: string;
      by_status: string;
      by_created: number;
    };
  };
  audit_notes: {
    key: string;
    value: LocalAuditNote;
    indexes: {
      by_workspace: string;
      by_created: number;
    };
  };
  cache_store: {
    key: string;
    value: {
      key: string;
      data: unknown;
      updatedAt: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<ShopLedgerDBSchema>> | null = null;

export function getLocalDB(): Promise<IDBPDatabase<ShopLedgerDBSchema>> {
  if (typeof window === "undefined" && typeof indexedDB === "undefined") {
    // Return a dummy promise during SSR
    return Promise.reject(new Error("IndexedDB is only accessible in browser environment"));
  }

  if (!dbPromise) {
    dbPromise = openDB<ShopLedgerDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("workspaces")) {
          db.createObjectStore("workspaces", { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains("sync_queue")) {
          const syncStore = db.createObjectStore("sync_queue", { keyPath: "id" });
          syncStore.createIndex("by_workspace", "workspaceId");
          syncStore.createIndex("by_status", "status");
          syncStore.createIndex("by_created", "createdAt");
        }

        if (!db.objectStoreNames.contains("audit_notes")) {
          const noteStore = db.createObjectStore("audit_notes", { keyPath: "id" });
          noteStore.createIndex("by_workspace", "workspaceId");
          noteStore.createIndex("by_created", "createdAt");
        }

        if (!db.objectStoreNames.contains("cache_store")) {
          db.createObjectStore("cache_store", { keyPath: "key" });
        }
      },
    });
  }

  return dbPromise;
}

/**
 * Cleanly reset connection for tests
 */
export function resetDBConnection(): void {
  dbPromise = null;
}
