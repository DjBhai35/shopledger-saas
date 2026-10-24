import { getLocalDB } from "@/lib/offline/db";
import {
  UserProfile,
  PricingPlan,
  PlatformConfiguredPlan,
  PlatformConfiguredCategory,
  BusinessCategoryKey,
  SubscriptionPlanId,
} from "@/types";
import { PRICING_PLANS } from "@/lib/config/pricing";
import { BUSINESS_CATEGORIES } from "@/lib/config/categories";
import { isUserAdmin } from "./platformSettingsService";
import { doc, getDoc, setDoc, collection, getDocs, updateDoc } from "firebase/firestore";
import { firestoreDb, isFirebaseConfigured } from "@/lib/firebase/config";
import { recordAdminAuditLog } from "./auditLogService";

/**
 * List all registered user profiles across the platform.
 * Restricted to Platform Admins.
 */
export async function getAllUsers(
  adminUser: { uid?: string; email?: string | null; isSuperAdmin?: boolean } | null,
  searchQuery?: string
): Promise<UserProfile[]> {
  if (!isUserAdmin(adminUser)) {
    throw new Error("Unauthorized: Platform Administrator privileges required.");
  }

  const db = await getLocalDB();
  let users: UserProfile[] = [];

  try {
    users = await db.getAll("all_users");
  } catch {
    users = [];
  }

  // If online and Firestore configured, pull fresh users
  if (isFirebaseConfigured && firestoreDb) {
    try {
      const snap = await getDocs(collection(firestoreDb, "users"));
      const remoteUsers: UserProfile[] = [];
      for (const d of snap.docs) {
        const u = d.data() as UserProfile;
        remoteUsers.push(u);
        await db.put("all_users", u);
      }
      if (remoteUsers.length > 0) {
        users = remoteUsers;
      }
    } catch {
      // Use cached offline users
    }
  }

  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    users = users.filter(
      (u) =>
        u.email?.toLowerCase().includes(q) ||
        u.displayName?.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q)
    );
  }

  return users.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Block or unblock a user account.
 * Blocked users cannot access dashboard or perform actions.
 * Restricted to Platform Admins.
 */
export async function toggleUserBlockedStatus(params: {
  targetUid: string;
  isBlocked: boolean;
  blockedReason?: string;
  adminUser: { uid: string; email?: string | null; isSuperAdmin?: boolean };
}): Promise<UserProfile> {
  if (!isUserAdmin(params.adminUser)) {
    throw new Error("Unauthorized: Only platform administrators can block or unblock accounts.");
  }

  // Prevent admin from blocking themselves
  if (params.targetUid === params.adminUser.uid) {
    throw new Error("Action prohibited: You cannot block your own administrator account.");
  }

  const db = await getLocalDB();
  let user = await db.get("all_users", params.targetUid);

  if (!user && isFirebaseConfigured && firestoreDb) {
    const snap = await getDoc(doc(firestoreDb, "users", params.targetUid));
    if (snap.exists()) {
      user = snap.data() as UserProfile;
    }
  }

  if (!user) {
    // If not yet in cache, create a placeholder record
    user = {
      uid: params.targetUid,
      email: null,
      displayName: null,
      photoURL: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  const now = Date.now();
  const updated: UserProfile = {
    ...user,
    isBlocked: params.isBlocked,
    blockedReason: params.isBlocked ? params.blockedReason?.trim() || "Account suspended by administrator" : undefined,
    blockedAt: params.isBlocked ? now : undefined,
    updatedAt: now,
  };

  await db.put("all_users", updated);

  if (isFirebaseConfigured && firestoreDb) {
    try {
      await updateDoc(doc(firestoreDb, "users", params.targetUid), {
        isBlocked: updated.isBlocked,
        blockedReason: updated.blockedReason ?? null,
        blockedAt: updated.blockedAt ?? null,
        updatedAt: now,
      });
    } catch {
      // Offline fallback
    }
  }

  await recordAdminAuditLog({
    adminUid: params.adminUser.uid,
    adminEmail: params.adminUser.email || "admin@shopledger.app",
    action: params.isBlocked ? "block_user" : "unblock_user",
    targetType: "user",
    targetId: params.targetUid,
    details: {
      isBlocked: params.isBlocked,
      blockedReason: updated.blockedReason,
    },
  });

  return updated;
}

/**
 * Get active platform pricing plans, incorporating admin overrides if present.
 */
export async function getConfiguredPricingPlans(): Promise<PlatformConfiguredPlan[]> {
  const db = await getLocalDB();
  const cached = await db.get("cache_store", "platform_configured_plans");

  if (cached && Array.isArray(cached.data)) {
    return cached.data as PlatformConfiguredPlan[];
  }

  if (isFirebaseConfigured && firestoreDb) {
    try {
      const snap = await getDoc(doc(firestoreDb, "platform_config", "pricing"));
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.plans)) {
          await db.put("cache_store", {
            key: "platform_configured_plans",
            data: data.plans,
            updatedAt: Date.now(),
          });
          return data.plans as PlatformConfiguredPlan[];
        }
      }
    } catch {
      // Fallback to default
    }
  }

  // Return base plans mapped as active
  return PRICING_PLANS.map((p) => ({
    ...p,
    isActive: true,
  }));
}

/**
 * Update pricing plans configuration.
 * Restricted to Platform Admins.
 */
export async function updateConfiguredPricingPlans(params: {
  plans: PlatformConfiguredPlan[];
  adminUser: { uid: string; email?: string | null; isSuperAdmin?: boolean };
}): Promise<PlatformConfiguredPlan[]> {
  if (!isUserAdmin(params.adminUser)) {
    throw new Error("Unauthorized: Only platform administrators can modify pricing configuration.");
  }

  const db = await getLocalDB();
  const now = Date.now();

  await db.put("cache_store", {
    key: "platform_configured_plans",
    data: params.plans,
    updatedAt: now,
  });

  if (isFirebaseConfigured && firestoreDb) {
    try {
      await setDoc(doc(firestoreDb, "platform_config", "pricing"), {
        plans: params.plans,
        updatedAt: now,
        updatedByUid: params.adminUser.uid,
      });
    } catch {
      // Offline fallback
    }
  }

  await recordAdminAuditLog({
    adminUid: params.adminUser.uid,
    adminEmail: params.adminUser.email || "admin@shopledger.app",
    action: "update_plans",
    targetType: "pricing_plans",
    targetId: "pricing",
    details: {
      plansCount: params.plans.length,
      planIds: params.plans.map((p) => p.id),
    },
  });

  return params.plans;
}

/**
 * Get configured shop categories, incorporating admin enable/disable status.
 */
export async function getConfiguredCategories(): Promise<PlatformConfiguredCategory[]> {
  const db = await getLocalDB();
  const cached = await db.get("cache_store", "platform_configured_categories");

  if (cached && Array.isArray(cached.data)) {
    return cached.data as PlatformConfiguredCategory[];
  }

  if (isFirebaseConfigured && firestoreDb) {
    try {
      const snap = await getDoc(doc(firestoreDb, "platform_config", "categories"));
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.categories)) {
          await db.put("cache_store", {
            key: "platform_configured_categories",
            data: data.categories,
            updatedAt: Date.now(),
          });
          return data.categories as PlatformConfiguredCategory[];
        }
      }
    } catch {
      // Fallback to default
    }
  }

  return BUSINESS_CATEGORIES.map((cat) => ({
    ...cat,
    isEnabled: true,
  }));
}

/**
 * Update category availability.
 * Restricted to Platform Admins.
 */
export async function updateConfiguredCategories(params: {
  categories: PlatformConfiguredCategory[];
  adminUser: { uid: string; email?: string | null; isSuperAdmin?: boolean };
}): Promise<PlatformConfiguredCategory[]> {
  if (!isUserAdmin(params.adminUser)) {
    throw new Error("Unauthorized: Only platform administrators can modify shop categories.");
  }

  const db = await getLocalDB();
  const now = Date.now();

  await db.put("cache_store", {
    key: "platform_configured_categories",
    data: params.categories,
    updatedAt: now,
  });

  if (isFirebaseConfigured && firestoreDb) {
    try {
      await setDoc(doc(firestoreDb, "platform_config", "categories"), {
        categories: params.categories,
        updatedAt: now,
        updatedByUid: params.adminUser.uid,
      });
    } catch {
      // Offline fallback
    }
  }

  await recordAdminAuditLog({
    adminUid: params.adminUser.uid,
    adminEmail: params.adminUser.email || "admin@shopledger.app",
    action: "update_categories",
    targetType: "categories",
    targetId: "categories",
    details: {
      categoriesCount: params.categories.length,
      enabledCount: params.categories.filter((c) => c.isEnabled).length,
    },
  });

  return params.categories;
}
