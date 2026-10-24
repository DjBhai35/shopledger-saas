import { getLocalDB } from "@/lib/offline/db";
import { AdminAuditLog, AdminAuditAction } from "@/types";
import { isUserAdmin } from "./platformSettingsService";
import { syncManager } from "@/lib/offline/sync-manager";
import { firestoreDb, isFirebaseConfigured } from "@/lib/firebase/config";
import { doc, setDoc, collection, getDocs, query, orderBy, limit } from "firebase/firestore";

export interface RecordAuditLogParams {
  adminUid: string;
  adminEmail: string;
  action: AdminAuditAction;
  targetType: "payment_proof" | "user" | "platform_settings" | "pricing_plans" | "categories";
  targetId: string;
  details: Record<string, unknown>;
}

/**
 * Record an immutable audit log for any sensitive platform administrator action.
 */
export async function recordAdminAuditLog(params: RecordAuditLogParams): Promise<AdminAuditLog> {
  const now = Date.now();
  const id = `audit_${now}_${Math.random().toString(36).substring(2, 7)}`;
  const log: AdminAuditLog = {
    id,
    adminUid: params.adminUid,
    adminEmail: params.adminEmail,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    details: params.details,
    timestamp: now,
  };

  const db = await getLocalDB();
  await db.put("admin_audit_logs", log);

  if (isFirebaseConfigured && firestoreDb) {
    try {
      await setDoc(doc(firestoreDb, "admin_audit_logs", id), log);
    } catch {
      // Offline fallback
    }
  }

  await syncManager.enqueueOperation({
    workspaceId: "platform",
    operation: "create",
    entityType: "admin_audit_log",
    entityId: id,
    payload: log as unknown as Record<string, unknown>,
  });

  return log;
}

/**
 * Fetch platform administrator audit logs.
 * Restricted strictly to verified Platform Administrators.
 */
export async function getAdminAuditLogs(
  adminUser: { uid?: string; email?: string | null; isSuperAdmin?: boolean } | null,
  limitCount: number = 100
): Promise<AdminAuditLog[]> {
  if (!isUserAdmin(adminUser)) {
    throw new Error("Unauthorized: Platform Administrator privileges required to view audit logs.");
  }

  const db = await getLocalDB();
  let logs: AdminAuditLog[] = [];

  try {
    logs = await db.getAll("admin_audit_logs");
  } catch {
    logs = [];
  }

  if (isFirebaseConfigured && firestoreDb) {
    try {
      const q = query(
        collection(firestoreDb, "admin_audit_logs"),
        orderBy("timestamp", "desc"),
        limit(limitCount)
      );
      const snap = await getDocs(q);
      const remoteLogs: AdminAuditLog[] = [];
      for (const d of snap.docs) {
        const item = d.data() as AdminAuditLog;
        remoteLogs.push(item);
        await db.put("admin_audit_logs", item);
      }
      if (remoteLogs.length > 0) {
        logs = remoteLogs;
      }
    } catch {
      // Offline fallback
    }
  }

  return logs.sort((a, b) => b.timestamp - a.timestamp).slice(0, limitCount);
}
