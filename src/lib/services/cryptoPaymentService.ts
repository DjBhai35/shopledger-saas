import { getLocalDB } from "@/lib/offline/db";
import {
  CryptoNetwork,
  PaymentProof,
  PaymentProofStatus,
  PaymentHistoryRecord,
  SubscriptionPlanId,
  WorkspaceSubscription,
  UserProfile,
} from "@/types";
import { getPlanById } from "@/lib/config/pricing";
import { getPlatformSettings, isUserAdmin } from "./platformSettingsService";
import { syncManager } from "@/lib/offline/sync-manager";
import { firestoreDb, isFirebaseConfigured } from "@/lib/firebase/config";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { recordAdminAuditLog } from "./auditLogService";

export interface SubmitPaymentProofInput {
  workspaceId: string;
  workspaceName: string;
  userUid: string;
  userEmail: string | null;
  userDisplayName?: string | null;
  planId: SubscriptionPlanId;
  amountUSD: number;
  network: CryptoNetwork;
  txHash: string;
  userNotes?: string;
}

/**
 * Validates a cryptocurrency transaction hash format based on network standards.
 */
export function validateTxHash(
  txHash: string,
  network: CryptoNetwork
): { valid: boolean; error?: string } {
  if (!txHash || !txHash.trim()) {
    return { valid: false, error: "Transaction hash (TxID) is required." };
  }

  const clean = txHash.trim();

  // Basic length sanity check (TRON and BSC tx hashes are typically 64-66 hex chars)
  if (clean.length < 32 || clean.length > 100) {
    return {
      valid: false,
      error: `Invalid transaction hash length (${clean.length}). Hashes must be 64-66 hex characters.`,
    };
  }

  // Hexadecimal character check
  const hexPattern = network === "BEP20" ? /^(0x)?[a-fA-F0-9]{64}$/ : /^[a-fA-F0-9]{64}$/;

  if (!hexPattern.test(clean)) {
    return {
      valid: false,
      error:
        network === "BEP20"
          ? "Invalid BEP20 TxHash. Must be a 64-character hex string (optionally prefixed with '0x')."
          : "Invalid TRC20 TxHash. Must be a 64-character hexadecimal transaction string.",
    };
  }

  return { valid: true };
}

/**
 * Normalizes a transaction hash for collision and duplicate checking.
 */
export function normalizeTxHash(txHash: string): string {
  let clean = txHash.trim().toLowerCase();
  if (clean.startsWith("0x")) {
    clean = clean.substring(2);
  }
  return clean;
}

/**
 * Checks if a transaction hash has already been submitted anywhere across the platform.
 * Prevents replay attacks or reusing the same transaction proof.
 */
export async function isTxHashDuplicate(txHash: string): Promise<boolean> {
  const normalized = normalizeTxHash(txHash);
  const db = await getLocalDB();

  try {
    const all = await db.getAll("payment_proofs");
    const exists = all.some((p) => normalizeTxHash(p.txHash) === normalized);
    if (exists) return true;

    // Check remote Firestore if online
    if (isFirebaseConfigured && firestoreDb) {
      const snap = await getDoc(doc(firestoreDb, "payment_tx_hashes", normalized));
      if (snap.exists()) return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Submits a payment proof for admin review.
 * IMPORTANT: NEVER activates a subscription upon submission!
 * Status is set strictly to 'pending'.
 */
export async function submitPaymentProof(
  input: SubmitPaymentProofInput
): Promise<PaymentProof> {
  // 1. Validate network
  if (input.network !== "TRC20" && input.network !== "BEP20") {
    throw new Error("Invalid network. Supported networks are TRC20 and BEP20.");
  }

  // 2. Validate TxHash
  const txValidation = validateTxHash(input.txHash, input.network);
  if (!txValidation.valid) {
    throw new Error(txValidation.error);
  }

  // 3. Validate Plan and Amount
  const plan = getPlanById(input.planId);
  if (plan.id === "free") {
    throw new Error("Free Starter plan does not require a cryptocurrency payment.");
  }

  if (Number(input.amountUSD) !== plan.priceUSD) {
    throw new Error(
      `Payment amount ($${input.amountUSD}) does not match the official price for ${plan.name} ($${plan.priceUSD}).`
    );
  }

  // 4. Check for duplicate TxHash
  const duplicate = await isTxHashDuplicate(input.txHash);
  if (duplicate) {
    throw new Error(
      "This transaction hash has already been submitted. Re-submitting an existing transaction is not allowed."
    );
  }

  // 5. Retrieve current deposit address from platform settings
  const settings = await getPlatformSettings();
  const depositAddress =
    input.network === "TRC20" ? settings.trc20WalletAddress : settings.bep20WalletAddress;

  const db = await getLocalDB();
  const now = Date.now();
  const proofId = `proof_${now}_${Math.random().toString(36).substring(2, 7)}`;

  const paymentProof: PaymentProof = {
    id: proofId,
    workspaceId: input.workspaceId,
    workspaceName: input.workspaceName,
    userUid: input.userUid,
    userEmail: input.userEmail,
    userDisplayName: input.userDisplayName,
    planId: input.planId,
    planName: plan.name,
    amountUSD: plan.priceUSD,
    network: input.network,
    txHash: input.txHash.trim(),
    depositAddress,
    status: "pending", // CRITICAL: NEVER APPROVED BY DEFAULT
    userNotes: input.userNotes?.trim() || undefined,
    submittedAt: now,
  };

  // 6. Save locally in IndexedDB
  await db.put("payment_proofs", paymentProof);

  // 7. Save normalized hash to prevent immediate local duplicate
  const normalizedHash = normalizeTxHash(input.txHash);

  if (isFirebaseConfigured && firestoreDb) {
    try {
      await setDoc(doc(firestoreDb, "payment_proofs", paymentProof.id), paymentProof);
      await setDoc(doc(firestoreDb, "payment_tx_hashes", normalizedHash), {
        txHash: input.txHash.trim(),
        proofId: paymentProof.id,
        workspaceId: input.workspaceId,
        createdAt: now,
      });
    } catch {
      // Offline fallback will be handled by sync queue
    }
  }

  // 8. Enqueue offline sync
  await syncManager.enqueueOperation({
    workspaceId: input.workspaceId,
    operation: "create",
    entityType: "payment_proof",
    entityId: paymentProof.id,
    payload: paymentProof as unknown as Record<string, unknown>,
  });

  return paymentProof;
}

/**
 * Get payment proofs submitted by a workspace.
 */
export async function getPaymentProofsByWorkspace(
  workspaceId: string
): Promise<PaymentProof[]> {
  const db = await getLocalDB();
  try {
    const all = await db.getAllFromIndex("payment_proofs", "by_workspace", workspaceId);
    return all.sort((a, b) => b.submittedAt - a.submittedAt);
  } catch {
    const all = await db.getAll("payment_proofs");
    return all
      .filter((p) => p.workspaceId === workspaceId)
      .sort((a, b) => b.submittedAt - a.submittedAt);
  }
}

/**
 * Get all payment proofs across all workspaces. Restricted to Platform Admins.
 */
export async function getAllPaymentProofs(
  adminUser: { uid?: string; email?: string | null; isSuperAdmin?: boolean } | null,
  statusFilter?: PaymentProofStatus
): Promise<PaymentProof[]> {
  if (!isUserAdmin(adminUser)) {
    throw new Error("Unauthorized: Platform Administrator privileges required.");
  }

  const db = await getLocalDB();
  let all = await db.getAll("payment_proofs");

  if (statusFilter) {
    all = all.filter((p) => p.status === statusFilter);
  }

  return all.sort((a, b) => b.submittedAt - a.submittedAt);
}

/**
 * Approve a pending payment proof.
 * Restricted to Platform Admins.
 * Atomically updates proof status, activates subscription, logs payment history.
 */
export async function approvePaymentProof(params: {
  proofId: string;
  adminUser: { uid: string; email?: string | null; isSuperAdmin?: boolean };
  adminNotes?: string;
}): Promise<{
  paymentProof: PaymentProof;
  subscription: WorkspaceSubscription;
  paymentHistory: PaymentHistoryRecord;
}> {
  if (!isUserAdmin(params.adminUser)) {
    throw new Error("Unauthorized: Only verified platform administrators can approve payments.");
  }

  const db = await getLocalDB();
  const proof = await db.get("payment_proofs", params.proofId);
  if (!proof) {
    throw new Error("Payment proof record not found.");
  }

  if (proof.status === "approved") {
    throw new Error("This payment has already been approved.");
  }

  const now = Date.now();
  const plan = getPlanById(proof.planId);
  const durationMonths = plan.durationMonths;
  const durationMs = durationMonths * 30 * 24 * 60 * 60 * 1000;

  // 1. Get or initialize workspace subscription
  let currentSub: WorkspaceSubscription | undefined;
  const subKey = `sub_${proof.workspaceId}`;

  // Try to load cached or remote subscription
  const cachedSub = await db.get("cache_store", `subscription_${proof.workspaceId}`);
  if (cachedSub && cachedSub.data) {
    currentSub = cachedSub.data as WorkspaceSubscription;
  }

  if (!currentSub && isFirebaseConfigured && firestoreDb) {
    try {
      const snap = await getDoc(doc(firestoreDb, "subscriptions", subKey));
      if (snap.exists()) {
        currentSub = snap.data() as WorkspaceSubscription;
      }
    } catch {
      // Continue to fallback
    }
  }

  // 2. Calculate subscription period
  // If subscription is currently active and unexpired, extend from existing expiry date
  let startDate = now;
  let expiryDate = now + durationMs;

  if (
    currentSub &&
    currentSub.status === "active" &&
    currentSub.planId !== "free" &&
    currentSub.expiryDate > now
  ) {
    startDate = currentSub.startDate;
    expiryDate = currentSub.expiryDate + durationMs; // Seamless extension
  }

  const updatedSubscription: WorkspaceSubscription = {
    id: subKey,
    workspaceId: proof.workspaceId,
    planId: proof.planId,
    planName: plan.name,
    status: "active",
    priceUSD: proof.amountUSD,
    durationMonths,
    startDate,
    expiryDate,
    features: { ...plan.features },
    limits: { ...plan.limits },
    autoRenew: false,
    updatedAt: now,
  };

  // 3. Mark payment proof as approved
  const updatedProof: PaymentProof = {
    ...proof,
    status: "approved",
    reviewedAt: now,
    reviewedByUid: params.adminUser.uid,
    reviewedByEmail: params.adminUser.email || undefined,
    adminNotes: params.adminNotes?.trim() || undefined,
  };

  // 4. Log Payment History record
  const paymentHistory: PaymentHistoryRecord = {
    id: `pay_hist_${now}_${Math.random().toString(36).substring(2, 6)}`,
    workspaceId: proof.workspaceId,
    paymentProofId: proof.id,
    planId: proof.planId,
    planName: plan.name,
    amountUSD: proof.amountUSD,
    network: proof.network,
    txHash: proof.txHash,
    periodStart: startDate,
    periodEnd: expiryDate,
    durationMonths,
    status: "completed",
    recordedAt: now,
    approvedByUid: params.adminUser.uid,
  };

  // 5. Persist to IndexedDB
  await db.put("payment_proofs", updatedProof);
  await db.put("payment_history", paymentHistory);
  await db.put("cache_store", {
    key: `subscription_${proof.workspaceId}`,
    data: updatedSubscription,
    updatedAt: now,
  });

  // 6. Persist to Firestore if available
  if (isFirebaseConfigured && firestoreDb) {
    try {
      await setDoc(doc(firestoreDb, "payment_proofs", updatedProof.id), updatedProof, {
        merge: true,
      });
      await setDoc(doc(firestoreDb, "subscriptions", updatedSubscription.id), updatedSubscription);
      await setDoc(doc(firestoreDb, "payment_history", paymentHistory.id), paymentHistory);
    } catch {
      // Offline sync queue handles remote update
    }
  }

  // 7. Enqueue sync
  await syncManager.enqueueOperation({
    workspaceId: proof.workspaceId,
    operation: "update",
    entityType: "payment_proof",
    entityId: updatedProof.id,
    payload: updatedProof as unknown as Record<string, unknown>,
  });

  // 8. Immutable Admin Audit Log
  await recordAdminAuditLog({
    adminUid: params.adminUser.uid,
    adminEmail: params.adminUser.email || "admin@shopledger.app",
    action: "approve_payment",
    targetType: "payment_proof",
    targetId: proof.id,
    details: {
      workspaceId: proof.workspaceId,
      planId: proof.planId,
      amountUSD: proof.amountUSD,
      network: proof.network,
      txHash: proof.txHash,
      startDate,
      expiryDate,
      adminNotes: params.adminNotes,
    },
  });

  return {
    paymentProof: updatedProof,
    subscription: updatedSubscription,
    paymentHistory,
  };
}

/**
 * Reject a payment proof with a specified rejection reason.
 * Restricted to Platform Admins.
 * Does NOT modify or activate workspace subscription.
 */
export async function rejectPaymentProof(params: {
  proofId: string;
  adminUser: { uid: string; email?: string | null; isSuperAdmin?: boolean };
  rejectionReason: string;
}): Promise<PaymentProof> {
  if (!isUserAdmin(params.adminUser)) {
    throw new Error("Unauthorized: Only verified platform administrators can reject payments.");
  }

  if (!params.rejectionReason || !params.rejectionReason.trim()) {
    throw new Error("A clear rejection reason must be provided (e.g. invalid hash, wrong amount).");
  }

  const db = await getLocalDB();
  const proof = await db.get("payment_proofs", params.proofId);
  if (!proof) {
    throw new Error("Payment proof record not found.");
  }

  const now = Date.now();
  const updatedProof: PaymentProof = {
    ...proof,
    status: "rejected",
    rejectionReason: params.rejectionReason.trim(),
    reviewedAt: now,
    reviewedByUid: params.adminUser.uid,
    reviewedByEmail: params.adminUser.email || undefined,
  };

  await db.put("payment_proofs", updatedProof);

  if (isFirebaseConfigured && firestoreDb) {
    try {
      await setDoc(doc(firestoreDb, "payment_proofs", updatedProof.id), updatedProof, {
        merge: true,
      });
    } catch {
      // Offline fallback
    }
  }

  await syncManager.enqueueOperation({
    workspaceId: proof.workspaceId,
    operation: "update",
    entityType: "payment_proof",
    entityId: updatedProof.id,
    payload: updatedProof as unknown as Record<string, unknown>,
  });

  // Immutable Admin Audit Log
  await recordAdminAuditLog({
    adminUid: params.adminUser.uid,
    adminEmail: params.adminUser.email || "admin@shopledger.app",
    action: "reject_payment",
    targetType: "payment_proof",
    targetId: proof.id,
    details: {
      workspaceId: proof.workspaceId,
      planId: proof.planId,
      amountUSD: proof.amountUSD,
      network: proof.network,
      txHash: proof.txHash,
      rejectionReason: params.rejectionReason,
    },
  });

  return updatedProof;
}

/**
 * Get payment history for a workspace.
 */
export async function getPaymentHistory(workspaceId: string): Promise<PaymentHistoryRecord[]> {
  const db = await getLocalDB();
  try {
    const all = await db.getAllFromIndex("payment_history", "by_workspace", workspaceId);
    return all.sort((a, b) => b.recordedAt - a.recordedAt);
  } catch {
    const all = await db.getAll("payment_history");
    return all
      .filter((h) => h.workspaceId === workspaceId)
      .sort((a, b) => b.recordedAt - a.recordedAt);
  }
}
