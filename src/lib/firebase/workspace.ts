import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./config";
import {
  Workspace,
  WorkspaceMembership,
  WorkspaceSubscription,
  UserProfile,
  BusinessCategoryKey,
} from "@/types";
import { getCategoryByKey } from "@/lib/config/categories";
import { createDefaultFreeSubscription } from "@/lib/config/pricing";

export interface OnboardingParams {
  userId: string;
  userEmail: string | null;
  userDisplayName?: string | null;
  businessName: string;
  category: BusinessCategoryKey;
  country: string;
  currency: string;
  currencySymbol: string;
  phone?: string;
  address?: string;
}

/**
 * Creates a new business workspace, owner membership, and initial free subscription.
 * Implements idempotency to prevent duplicate creation on repeated submissions.
 */
export async function createWorkspaceAndOnboard(
  params: OnboardingParams
): Promise<{ workspace: Workspace; subscription: WorkspaceSubscription }> {
  const now = Date.now();
  const categoryInfo = getCategoryByKey(params.category);
  const workspaceId = `ws_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const newWorkspace: Workspace = {
    id: workspaceId,
    name: params.businessName.trim(),
    category: params.category,
    categoryLabel: categoryInfo.label,
    country: params.country,
    currency: params.currency,
    currencySymbol: params.currencySymbol,
    phone: params.phone?.trim() || undefined,
    address: params.address?.trim() || undefined,
    ownerUid: params.userId,
    status: "active",
    settings: {
      taxRatePercent: categoryInfo.suggestedTaxRate || 0,
      invoicePrefix: "INV-",
      receiptFooterMessage: "Thank you for your business!",
      enableLowStockAlerts: true,
      lowStockThreshold: 5,
      allowNegativeInventory: false,
      dateFormat: "DD/MM/YYYY",
    },
    createdAt: now,
    updatedAt: now,
  };

  const membershipId = `mem_${workspaceId}_${params.userId}`;
  const ownerMembership: WorkspaceMembership = {
    id: membershipId,
    workspaceId: workspaceId,
    userId: params.userId,
    userEmail: params.userEmail,
    userDisplayName: params.userDisplayName || null,
    role: "owner",
    status: "active",
    permissions: ["*"], // All permissions for owner
    createdAt: now,
    updatedAt: now,
  };

  const subscription = createDefaultFreeSubscription(workspaceId);

  // If real Firebase is configured, persist directly to Firestore
  if (isFirebaseConfigured && db) {
    // 1. Check if user already owns an active workspace with exact same name to prevent duplicates
    const membershipsRef = collection(db, "memberships");
    const q = query(
      membershipsRef,
      where("userId", "==", params.userId),
      where("role", "==", "owner")
    );
    const existing = await getDocs(q);

    for (const d of existing.docs) {
      const mem = d.data() as WorkspaceMembership;
      const wsDoc = await getDoc(doc(db, "workspaces", mem.workspaceId));
      if (wsDoc.exists()) {
        const ws = wsDoc.data() as Workspace;
        if (ws.name.toLowerCase() === params.businessName.trim().toLowerCase()) {
          // Already created, return existing
          const subDoc = await getDoc(doc(db, "subscriptions", `sub_${ws.id}`));
          const sub = subDoc.exists()
            ? (subDoc.data() as WorkspaceSubscription)
            : createDefaultFreeSubscription(ws.id);
          return { workspace: ws, subscription: sub };
        }
      }
    }

    // 2. Write workspace
    await setDoc(doc(db, "workspaces", workspaceId), newWorkspace);

    // 3. Write owner membership
    await setDoc(doc(db, "memberships", membershipId), ownerMembership);

    // 4. Write initial free subscription
    await setDoc(doc(db, "subscriptions", subscription.id), subscription);

    // 5. Update user's currentWorkspaceId
    const userRef = doc(db, "users", params.userId);
    await updateDoc(userRef, {
      currentWorkspaceId: workspaceId,
      updatedAt: now,
    });
  } else {
    // Fallback in-memory/localStorage cache for local testing without active Firebase keys
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(`ws_${params.userId}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          return parsed;
        } catch {}
      }
      localStorage.setItem(
        `ws_${params.userId}`,
        JSON.stringify({ workspace: newWorkspace, subscription })
      );
    }
  }

  return { workspace: newWorkspace, subscription };
}

/**
 * Fetch all workspace memberships for a user.
 */
export async function getUserMemberships(
  userId: string
): Promise<WorkspaceMembership[]> {
  if (isFirebaseConfigured && db) {
    const membershipsRef = collection(db, "memberships");
    const q = query(membershipsRef, where("userId", "==", userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as WorkspaceMembership);
  }

  // Local fallback
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(`ws_${userId}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return [
          {
            id: `mem_${parsed.workspace.id}_${userId}`,
            workspaceId: parsed.workspace.id,
            userId,
            userEmail: "",
            role: "owner",
            status: "active",
            permissions: ["*"],
            createdAt: parsed.workspace.createdAt,
            updatedAt: parsed.workspace.updatedAt,
          },
        ];
      } catch {}
    }
  }

  return [];
}

/**
 * Get workspace details by workspaceId.
 */
export async function getWorkspace(
  workspaceId: string
): Promise<Workspace | null> {
  if (isFirebaseConfigured && db) {
    const docRef = doc(db, "workspaces", workspaceId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as Workspace;
    }
    return null;
  }

  if (typeof window !== "undefined") {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("ws_")) {
        const item = localStorage.getItem(key);
        if (item) {
          try {
            const parsed = JSON.parse(item);
            if (parsed.workspace?.id === workspaceId) {
              return parsed.workspace;
            }
          } catch {}
        }
      }
    }
  }

  return null;
}

/**
 * Get workspace subscription.
 */
export async function getWorkspaceSubscription(
  workspaceId: string
): Promise<WorkspaceSubscription | null> {
  if (isFirebaseConfigured && db) {
    const docRef = doc(db, "subscriptions", `sub_${workspaceId}`);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as WorkspaceSubscription;
    }
    return createDefaultFreeSubscription(workspaceId);
  }

  return createDefaultFreeSubscription(workspaceId);
}

/**
 * Sync user profile doc upon login.
 */
export async function syncUserProfile(user: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}): Promise<UserProfile> {
  const now = Date.now();
  const profile: UserProfile = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    createdAt: now,
    updatedAt: now,
  };

  if (isFirebaseConfigured && db) {
    const userRef = doc(db, "users", user.uid);
    const existing = await getDoc(userRef);
    if (existing.exists()) {
      const data = existing.data() as UserProfile;
      await updateDoc(userRef, {
        displayName: user.displayName,
        photoURL: user.photoURL,
        updatedAt: now,
      });
      return { ...data, displayName: user.displayName, photoURL: user.photoURL, updatedAt: now };
    } else {
      await setDoc(userRef, profile);
      return profile;
    }
  }

  return profile;
}
