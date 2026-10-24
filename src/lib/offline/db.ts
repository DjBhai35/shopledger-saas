import { openDB, DBSchema, IDBPDatabase } from "idb";
import {
  SyncQueueItem,
  LocalAuditNote,
  Workspace,
  Product,
  StockMovement,
  Customer,
  Supplier,
  Sale,
  Purchase,
  CustomerLedgerEntry,
  SupplierLedgerEntry,
  Expense,
  OperationJournalRecord,
  PaymentProof,
  PaymentHistoryRecord,
  AppPlatformSettings,
  UserProfile,
  AdminAuditLog,
} from "@/types";

const DB_NAME = "shopledger_local_db";
const DB_VERSION = 4;

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
  products: {
    key: string;
    value: Product;
    indexes: {
      by_workspace: string;
      by_sku: string;
      by_barcode: string;
    };
  };
  stock_movements: {
    key: string;
    value: StockMovement;
    indexes: {
      by_workspace: string;
      by_product: string;
      by_created: number;
    };
  };
  customers: {
    key: string;
    value: Customer;
    indexes: {
      by_workspace: string;
    };
  };
  suppliers: {
    key: string;
    value: Supplier;
    indexes: {
      by_workspace: string;
    };
  };
  sales: {
    key: string;
    value: Sale;
    indexes: {
      by_workspace: string;
      by_created: number;
    };
  };
  purchases: {
    key: string;
    value: Purchase;
    indexes: {
      by_workspace: string;
      by_created: number;
    };
  };
  customer_ledger: {
    key: string;
    value: CustomerLedgerEntry;
    indexes: {
      by_workspace: string;
      by_customer: string;
      by_date: number;
    };
  };
  supplier_ledger: {
    key: string;
    value: SupplierLedgerEntry;
    indexes: {
      by_workspace: string;
      by_supplier: string;
      by_date: number;
    };
  };
  expenses: {
    key: string;
    value: Expense;
    indexes: {
      by_workspace: string;
      by_date: number;
    };
  };
  operation_journal: {
    key: string;
    value: OperationJournalRecord;
    indexes: {
      by_workspace: string;
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
  payment_proofs: {
    key: string;
    value: PaymentProof;
    indexes: {
      by_workspace: string;
      by_status: string;
      by_txhash: string;
    };
  };
  payment_history: {
    key: string;
    value: PaymentHistoryRecord;
    indexes: {
      by_workspace: string;
      by_created: number;
    };
  };
  platform_settings: {
    key: string;
    value: AppPlatformSettings;
  };
  all_users: {
    key: string;
    value: UserProfile;
    indexes: {
      by_email: string;
    };
  };
  admin_audit_logs: {
    key: string;
    value: AdminAuditLog;
    indexes: {
      by_admin: string;
      by_action: string;
      by_timestamp: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<ShopLedgerDBSchema>> | null = null;

export function getLocalDB(): Promise<IDBPDatabase<ShopLedgerDBSchema>> {
  if (typeof window === "undefined" && typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is only accessible in browser environment"));
  }

  if (!dbPromise) {
    dbPromise = openDB<ShopLedgerDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
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
        }

        // Version 2 stores
        if (!db.objectStoreNames.contains("products")) {
          const store = db.createObjectStore("products", { keyPath: "id" });
          store.createIndex("by_workspace", "workspaceId");
          store.createIndex("by_sku", "sku");
          store.createIndex("by_barcode", "barcode");
        }

        if (!db.objectStoreNames.contains("stock_movements")) {
          const store = db.createObjectStore("stock_movements", { keyPath: "id" });
          store.createIndex("by_workspace", "workspaceId");
          store.createIndex("by_product", "productId");
          store.createIndex("by_created", "createdAt");
        }

        if (!db.objectStoreNames.contains("customers")) {
          const store = db.createObjectStore("customers", { keyPath: "id" });
          store.createIndex("by_workspace", "workspaceId");
        }

        if (!db.objectStoreNames.contains("suppliers")) {
          const store = db.createObjectStore("suppliers", { keyPath: "id" });
          store.createIndex("by_workspace", "workspaceId");
        }

        if (!db.objectStoreNames.contains("sales")) {
          const store = db.createObjectStore("sales", { keyPath: "id" });
          store.createIndex("by_workspace", "workspaceId");
          store.createIndex("by_created", "createdAt");
        }

        if (!db.objectStoreNames.contains("purchases")) {
          const store = db.createObjectStore("purchases", { keyPath: "id" });
          store.createIndex("by_workspace", "workspaceId");
          store.createIndex("by_created", "createdAt");
        }

        if (!db.objectStoreNames.contains("customer_ledger")) {
          const store = db.createObjectStore("customer_ledger", { keyPath: "id" });
          store.createIndex("by_workspace", "workspaceId");
          store.createIndex("by_customer", "customerId");
          store.createIndex("by_date", "date");
        }

        if (!db.objectStoreNames.contains("supplier_ledger")) {
          const store = db.createObjectStore("supplier_ledger", { keyPath: "id" });
          store.createIndex("by_workspace", "workspaceId");
          store.createIndex("by_supplier", "supplierId");
          store.createIndex("by_date", "date");
        }

        if (!db.objectStoreNames.contains("expenses")) {
          const store = db.createObjectStore("expenses", { keyPath: "id" });
          store.createIndex("by_workspace", "workspaceId");
          store.createIndex("by_date", "date");
        }

        if (!db.objectStoreNames.contains("operation_journal")) {
          const store = db.createObjectStore("operation_journal", { keyPath: "id" });
          store.createIndex("by_workspace", "workspaceId");
        }

        // Version 3 stores (USDT Crypto Payments, Admin Platform)
        if (!db.objectStoreNames.contains("payment_proofs")) {
          const store = db.createObjectStore("payment_proofs", { keyPath: "id" });
          store.createIndex("by_workspace", "workspaceId");
          store.createIndex("by_status", "status");
          store.createIndex("by_txhash", "txHash");
        }

        if (!db.objectStoreNames.contains("payment_history")) {
          const store = db.createObjectStore("payment_history", { keyPath: "id" });
          store.createIndex("by_workspace", "workspaceId");
          store.createIndex("by_created", "recordedAt");
        }

        if (!db.objectStoreNames.contains("platform_settings")) {
          db.createObjectStore("platform_settings", { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains("all_users")) {
          const store = db.createObjectStore("all_users", { keyPath: "uid" });
          store.createIndex("by_email", "email");
        }

        // Version 4 stores (Admin Audit Logging)
        if (!db.objectStoreNames.contains("admin_audit_logs")) {
          const store = db.createObjectStore("admin_audit_logs", { keyPath: "id" });
          store.createIndex("by_admin", "adminUid");
          store.createIndex("by_action", "action");
          store.createIndex("by_timestamp", "timestamp");
        }
      },
    });
  }

  return dbPromise;
}

export function resetDBConnection(): void {
  dbPromise = null;
}
