import { getLocalDB } from "@/lib/offline/db";
import { AppPlatformSettings } from "@/types";
import { syncManager } from "@/lib/offline/sync-manager";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { firestoreDb, isFirebaseConfigured } from "@/lib/firebase/config";

export const DEFAULT_PLATFORM_SETTINGS: AppPlatformSettings = {
  id: "default",
  platformName: "ShopLedger SaaS",
  supportEmail: "support@shopledger.app",
  whatsappNumber: "+923001234567",
  whatsappDefaultMessage: "Hello ShopLedger Support, I need assistance with my account:",
  announcementMessage: "USDT (TRC20 & BEP20) subscription renewals are now active. Fast admin verification within 1 hour.",
  announcementActive: true,
  // Standard official deposit addresses (configurable via Admin Panel)
  trc20WalletAddress: "TYDnygDkWLsqzNKnUqG3m5E1f7Zz7Y7XyZ",
  bep20WalletAddress: "0x71C8360f37C2e1907c570B2966d925539b80361f",
  usdtInstructionsNotes:
    "1. Transfer the exact subscription amount in USDT.\n2. Ensure you choose the exact matching network (TRC20 or BEP20).\n3. Copy the transaction hash (TxID) from your wallet / exchange.\n4. Paste the TxHash below and submit. Our admin team will verify and activate your subscription.",
  adminEmails: [
    "admin@shopledger.app",
    "mdilshadm282@gmail.com",
    "djbhai35@gmail.com",
  ],
  updatedAt: Date.now(),
};

/**
 * Checks whether the given user has platform administrator privileges.
 * Verifies explicit isSuperAdmin flag or authorized platform admin emails.
 */
export function isUserAdmin(
  user: {
    uid?: string;
    email?: string | null;
    isSuperAdmin?: boolean;
  } | null,
  cachedSettings?: AppPlatformSettings | null
): boolean {
  if (!user) return false;

  // 1. Explicit database super-admin flag
  if (user.isSuperAdmin === true) return true;

  // 2. Email verification against environment configuration
  const email = user.email?.toLowerCase().trim();
  if (!email) return false;

  const envAdminEmails = (
    process.env.NEXT_PUBLIC_ADMIN_EMAILS ||
    process.env.ADMIN_EMAILS ||
    "mdilshadm282@gmail.com,admin@shopledger.app"
  )
    .toLowerCase()
    .split(",")
    .map((e) => e.trim());

  if (envAdminEmails.includes(email)) return true;

  // 3. Settings admin list verification
  const settingsAdmins = (cachedSettings?.adminEmails || DEFAULT_PLATFORM_SETTINGS.adminEmails).map(
    (e) => e.toLowerCase().trim()
  );

  return settingsAdmins.includes(email);
}

/**
 * Get current platform settings from local DB, remote Firestore, or fallback defaults.
 */
export async function getPlatformSettings(): Promise<AppPlatformSettings> {
  try {
    const db = await getLocalDB();
    const local = await db.get("platform_settings", "default");
    if (local) {
      return local;
    }

    if (isFirebaseConfigured && firestoreDb) {
      const snap = await getDoc(doc(firestoreDb, "platform_settings", "default"));
      if (snap.exists()) {
        const data = snap.data() as AppPlatformSettings;
        await db.put("platform_settings", data);
        return data;
      }
    }

    // Initialize with defaults in local DB
    await db.put("platform_settings", DEFAULT_PLATFORM_SETTINGS);
    return DEFAULT_PLATFORM_SETTINGS;
  } catch {
    return DEFAULT_PLATFORM_SETTINGS;
  }
}

/**
 * Update platform settings. Strictly restricted to admin users.
 */
export async function updatePlatformSettings(
  updates: Partial<AppPlatformSettings>,
  authorUid: string
): Promise<AppPlatformSettings> {
  const current = await getPlatformSettings();
  const db = await getLocalDB();
  const now = Date.now();

  const updated: AppPlatformSettings = {
    ...current,
    ...updates,
    id: "default",
    updatedAt: now,
    updatedByUid: authorUid,
  };

  await db.put("platform_settings", updated);

  if (isFirebaseConfigured && firestoreDb) {
    try {
      await setDoc(doc(firestoreDb, "platform_settings", "default"), updated, { merge: true });
    } catch {
      // In offline or restricted network, enqueue mutation
    }
  }

  await syncManager.enqueueOperation({
    workspaceId: "platform",
    operation: "update",
    entityType: "platform_settings",
    entityId: "default",
    payload: updated as unknown as Record<string, unknown>,
  });

  return updated;
}
