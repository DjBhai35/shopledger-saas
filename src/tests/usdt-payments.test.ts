import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { resetDBConnection, getLocalDB } from "@/lib/offline/db";
import {
  validateTxHash,
  submitPaymentProof,
  approvePaymentProof,
  rejectPaymentProof,
  getPaymentProofsByWorkspace,
  getAllPaymentProofs,
  getPaymentHistory,
} from "@/lib/services/cryptoPaymentService";
import { WorkspaceSubscription } from "@/types";

describe("USDT Crypto Payments Engine (TRC20 & BEP20)", () => {
  const ws1 = "ws_crypto_shop_1";
  const ws2 = "ws_crypto_shop_2";
  const normalUser = { uid: "user_normal", email: "shopkeeper@example.com" };
  const adminUser = { uid: "admin_super", email: "mdilshadm282@gmail.com", isSuperAdmin: true };

  const hexTron1 = "1111111111111111111111111111111111111111111111111111111111111111";
  const hexTron2 = "2222222222222222222222222222222222222222222222222222222222222222";
  const hexTron3 = "3333333333333333333333333333333333333333333333333333333333333333";
  const hexTron4 = "4444444444444444444444444444444444444444444444444444444444444444";
  const hexBsc1 = "0x5555555555555555555555555555555555555555555555555555555555555555";
  const hexBsc2 = "0x6666666666666666666666666666666666666666666666666666666666666666";
  const hexBsc3 = "0x7777777777777777777777777777777777777777777777777777777777777777";

  beforeEach(async () => {
    resetDBConnection();
    try {
      const db = await getLocalDB();
      await db.clear("payment_proofs");
      await db.clear("payment_history");
      await db.clear("cache_store");
    } catch {
      // Ignored
    }
  });

  describe("Transaction Hash Validation", () => {
    it("should validate valid TRC20 and BEP20 hashes", () => {
      expect(validateTxHash(hexTron1, "TRC20").valid).toBe(true);
      expect(validateTxHash(hexBsc1, "BEP20").valid).toBe(true);
      // BEP20 without 0x prefix should also pass
      expect(validateTxHash(hexBsc1.substring(2), "BEP20").valid).toBe(true);
    });

    it("should reject invalid hash formats and lengths", () => {
      expect(validateTxHash("", "TRC20").valid).toBe(false);
      expect(validateTxHash("too_short_hash", "TRC20").valid).toBe(false);
      expect(validateTxHash("invalid_characters_xyz_!", "TRC20").valid).toBe(false);
      expect(validateTxHash("0x" + hexTron1, "TRC20").valid).toBe(false); // TRC20 does not use 0x
    });
  });

  describe("Payment Submission & Idempotency", () => {
    it("should submit payment proof with status 'pending' and NEVER activate subscription automatically", async () => {
      const proof = await submitPaymentProof({
        workspaceId: ws1,
        workspaceName: "Smart Electronics",
        userUid: normalUser.uid,
        userEmail: normalUser.email,
        planId: "growth_2m",
        amountUSD: 5,
        network: "TRC20",
        txHash: hexTron1,
        userNotes: "Sent from TrustWallet",
      });

      expect(proof.id).toBeDefined();
      expect(proof.status).toBe("pending");
      expect(proof.amountUSD).toBe(5);
      expect(proof.planId).toBe("growth_2m");
      expect(proof.depositAddress).toBeDefined();

      // Ensure proof exists in workspace history as pending
      const history = await getPaymentProofsByWorkspace(ws1);
      expect(history.length).toBe(1);
      expect(history[0].status).toBe("pending");

      // Verify subscription is NOT activated in cache
      const db = await getLocalDB();
      const cachedSub = await db.get("cache_store", `subscription_${ws1}`);
      expect(cachedSub).toBeUndefined();
    });

    it("should prevent duplicate transaction hash submissions across different workspaces", async () => {
      // First submission in ws1
      await submitPaymentProof({
        workspaceId: ws1,
        workspaceName: "Shop One",
        userUid: normalUser.uid,
        userEmail: normalUser.email,
        planId: "pro_6m",
        amountUSD: 8,
        network: "BEP20",
        txHash: hexBsc1,
      });

      // Attempting to reuse the exact same TxHash in ws2 must fail
      await expect(
        submitPaymentProof({
          workspaceId: ws2,
          workspaceName: "Shop Two",
          userUid: "user_fraudulent",
          userEmail: "another@example.com",
          planId: "pro_6m",
          amountUSD: 8,
          network: "BEP20",
          txHash: hexBsc1, // Reused hash
        })
      ).rejects.toThrow(/already been submitted/);
    });

    it("should reject submissions where amount does not match plan price", async () => {
      await expect(
        submitPaymentProof({
          workspaceId: ws1,
          workspaceName: "Shop One",
          userUid: normalUser.uid,
          userEmail: normalUser.email,
          planId: "pro_6m", // Price is $8
          amountUSD: 5, // Underpaying
          network: "TRC20",
          txHash: hexTron2,
        })
      ).rejects.toThrow(/does not match the official price/);
    });
  });

  describe("Admin Review: Approval & Rejection Lifecycle", () => {
    it("should block non-admin users from reviewing or approving payments", async () => {
      const proof = await submitPaymentProof({
        workspaceId: ws1,
        workspaceName: "Shop One",
        userUid: normalUser.uid,
        userEmail: normalUser.email,
        planId: "growth_2m",
        amountUSD: 5,
        network: "TRC20",
        txHash: hexTron3,
      });

      // Normal user attempts approval
      await expect(
        approvePaymentProof({
          proofId: proof.id,
          adminUser: normalUser as any,
        })
      ).rejects.toThrow(/Unauthorized/);

      // Normal user attempts rejection
      await expect(
        rejectPaymentProof({
          proofId: proof.id,
          adminUser: normalUser as any,
          rejectionReason: "Test reason",
        })
      ).rejects.toThrow(/Unauthorized/);
    });

    it("should approve payment, activate subscription, set correct term dates, and record payment history", async () => {
      const proof = await submitPaymentProof({
        workspaceId: ws1,
        workspaceName: "Al-Rehman Mobiles",
        userUid: normalUser.uid,
        userEmail: normalUser.email,
        planId: "pro_6m", // 6 months, $8
        amountUSD: 8,
        network: "TRC20",
        txHash: hexTron4,
      });

      const { paymentProof, subscription, paymentHistory } = await approvePaymentProof({
        proofId: proof.id,
        adminUser,
        adminNotes: "Tx confirmed on TronScan with 40 confirmations.",
      });

      // 1. Proof status updated
      expect(paymentProof.status).toBe("approved");
      expect(paymentProof.reviewedByUid).toBe(adminUser.uid);
      expect(paymentProof.adminNotes).toContain("TronScan");

      // 2. Subscription activated with 6 months duration
      expect(subscription.status).toBe("active");
      expect(subscription.planId).toBe("pro_6m");
      expect(subscription.durationMonths).toBe(6);
      expect(subscription.limits.maxProducts).toBe(5000);
      expect(subscription.limits.maxMonthlyInvoices).toBe(5000);
      expect(subscription.expiryDate).toBeGreaterThan(Date.now() + 5 * 30 * 24 * 60 * 60 * 1000);

      // 3. Payment history recorded
      expect(paymentHistory.status).toBe("completed");
      expect(paymentHistory.amountUSD).toBe(8);
      expect(paymentHistory.txHash).toBe(hexTron4);

      const hist = await getPaymentHistory(ws1);
      expect(hist.length).toBe(1);
      expect(hist[0].id).toBe(paymentHistory.id);
    });

    it("should reject payment proof with recorded reason and leave subscription unchanged", async () => {
      const proof = await submitPaymentProof({
        workspaceId: ws1,
        workspaceName: "Tech Hub",
        userUid: normalUser.uid,
        userEmail: normalUser.email,
        planId: "enterprise_12m", // $15
        amountUSD: 15,
        network: "BEP20",
        txHash: hexBsc2,
      });

      const rejected = await rejectPaymentProof({
        proofId: proof.id,
        adminUser,
        rejectionReason: "Transaction hash not found on BSC mainnet. Likely testnet transaction.",
      });

      expect(rejected.status).toBe("rejected");
      expect(rejected.rejectionReason).toContain("not found on BSC mainnet");

      // Verify subscription was NOT activated
      const db = await getLocalDB();
      const cached = await db.get("cache_store", `subscription_${ws1}`);
      expect(cached).toBeUndefined();
    });
  });
});
