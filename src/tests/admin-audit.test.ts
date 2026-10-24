import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { resetDBConnection, getLocalDB } from "@/lib/offline/db";
import {
  recordAdminAuditLog,
  getAdminAuditLogs,
} from "@/lib/services/auditLogService";
import {
  approvePaymentProof,
  rejectPaymentProof,
  submitPaymentProof,
} from "@/lib/services/cryptoPaymentService";
import { toggleUserBlockedStatus } from "@/lib/services/adminService";
import { updatePlatformSettings } from "@/lib/services/platformSettingsService";
import { UserProfile } from "@/types";
import fs from "fs";
import path from "path";

describe("Platform Admin Audit Trail & PWA Compliance", () => {
  const superAdmin = { uid: "admin_super_1", email: "mdilshadm282@gmail.com", isSuperAdmin: true };
  const standardUser = { uid: "user_regular_1", email: "shopkeeper@example.com", isSuperAdmin: false };

  beforeEach(async () => {
    resetDBConnection();
    const db = await getLocalDB();
    await db.clear("admin_audit_logs");
    await db.clear("payment_proofs");
    await db.clear("payment_history");
    await db.clear("all_users");
  });

  describe("Audit Log Service Access Control & Recording", () => {
    it("should allow recording and querying of audit logs by super admin", async () => {
      const record = await recordAdminAuditLog({
        adminUid: superAdmin.uid,
        adminEmail: superAdmin.email,
        action: "update_platform_settings",
        targetType: "platform_settings",
        targetId: "default",
        details: { updatedKeys: ["whatsappNumber", "trc20WalletAddress"] },
      });

      expect(record.id).toBeDefined();
      expect(record.adminEmail).toBe(superAdmin.email);
      expect(record.action).toBe("update_platform_settings");

      const logs = await getAdminAuditLogs(superAdmin);
      expect(logs.length).toBe(1);
      expect(logs[0].id).toBe(record.id);
      expect(logs[0].targetId).toBe("default");
    });

    it("should reject non-admin users attempting to view platform audit logs", async () => {
      await expect(getAdminAuditLogs(standardUser)).rejects.toThrow(
        /Platform Administrator privileges required/
      );
      await expect(getAdminAuditLogs(null)).rejects.toThrow(
        /Platform Administrator privileges required/
      );
    });
  });

  describe("Automatic Audit Logging on Sensitive Admin Operations", () => {
    it("should automatically log an audit entry when approving a payment proof", async () => {
      const testHash = "9999999999888888888877777777776666666666555555555544444444443333";

      const proof = await submitPaymentProof({
        workspaceId: "ws_audit_test",
        workspaceName: "Audit Test Shop",
        userUid: "user_buyer",
        userEmail: "buyer@shop.com",
        planId: "growth_2m",
        amountUSD: 5,
        network: "TRC20",
        txHash: testHash,
      });

      // Super admin approves the payment
      await approvePaymentProof({
        proofId: proof.id,
        adminUser: superAdmin,
        adminNotes: "Tx confirmed on TronScan with 25 confirmations.",
      });

      // Verify audit log was recorded
      const logs = await getAdminAuditLogs(superAdmin);
      const approveLog = logs.find((l) => l.action === "approve_payment");

      expect(approveLog).toBeDefined();
      expect(approveLog?.targetId).toBe(proof.id);
      expect(approveLog?.adminEmail).toBe(superAdmin.email);
      expect((approveLog?.details as any).amountUSD).toBe(5);
      expect((approveLog?.details as any).adminNotes).toContain("TronScan");
    });

    it("should automatically log an audit entry when rejecting a payment proof", async () => {
      const testHash = "aaaaaaaabbbbbbbbccccccccddddddddeeeeeeeeffffffff1111111122222222";

      const proof = await submitPaymentProof({
        workspaceId: "ws_reject_audit",
        workspaceName: "Reject Test Shop",
        userUid: "user_buyer_2",
        userEmail: "buyer2@shop.com",
        planId: "pro_6m",
        amountUSD: 8,
        network: "TRC20",
        txHash: testHash,
      });

      // Super admin rejects payment
      await rejectPaymentProof({
        proofId: proof.id,
        adminUser: superAdmin,
        rejectionReason: "Tx hash not found on TronScan explorer.",
      });

      const logs = await getAdminAuditLogs(superAdmin);
      const rejectLog = logs.find((l) => l.action === "reject_payment");

      expect(rejectLog).toBeDefined();
      expect(rejectLog?.targetId).toBe(proof.id);
      expect((rejectLog?.details as any).rejectionReason).toContain("not found on TronScan");
    });

    it("should automatically log an audit entry when blocking and unblocking accounts", async () => {
      const targetUser: UserProfile = {
        uid: "user_fraudulent_44",
        email: "fraud@fake.com",
        displayName: "Fraudulent User",
        photoURL: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const db = await getLocalDB();
      await db.put("all_users", targetUser);

      // Block user
      await toggleUserBlockedStatus({
        targetUid: targetUser.uid,
        isBlocked: true,
        blockedReason: "Suspicious fraudulent transaction submissions",
        adminUser: superAdmin,
      });

      let logs = await getAdminAuditLogs(superAdmin);
      const blockLog = logs.find((l) => l.action === "block_user");
      expect(blockLog).toBeDefined();
      expect(blockLog?.targetId).toBe(targetUser.uid);
      expect((blockLog?.details as any).blockedReason).toContain("Suspicious fraudulent");

      // Unblock user
      await toggleUserBlockedStatus({
        targetUid: targetUser.uid,
        isBlocked: false,
        adminUser: superAdmin,
      });

      logs = await getAdminAuditLogs(superAdmin);
      const unblockLog = logs.find((l) => l.action === "unblock_user");
      expect(unblockLog).toBeDefined();
      expect(unblockLog?.targetId).toBe(targetUser.uid);
    });

    it("should automatically log an audit entry when modifying platform settings", async () => {
      await updatePlatformSettings(
        { whatsappNumber: "+923009999999" },
        superAdmin.uid
      );

      const logs = await getAdminAuditLogs(superAdmin);
      const settingsLog = logs.find((l) => l.action === "update_platform_settings");
      expect(settingsLog).toBeDefined();
      expect(settingsLog?.targetId).toBe("default");
    });
  });

  describe("PWA Assets & Manifest Invariants", () => {
    it("should have a valid web app manifest with standalone display and icons", () => {
      const manifestPath = path.resolve(process.cwd(), "public/manifest.json");
      expect(fs.existsSync(manifestPath)).toBe(true);

      const manifestContent = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      expect(manifestContent.name).toBeDefined();
      expect(manifestContent.short_name).toBeDefined();
      expect(manifestContent.start_url).toBe("/dashboard");
      expect(manifestContent.display).toBe("standalone");
      expect(manifestContent.theme_color).toBeDefined();
      expect(manifestContent.icons.length).toBeGreaterThanOrEqual(2);
    });

    it("should have a service worker script with cache fallbacks for offline support", () => {
      const swPath = path.resolve(process.cwd(), "public/sw.js");
      expect(fs.existsSync(swPath)).toBe(true);

      const swContent = fs.readFileSync(swPath, "utf-8");
      expect(swContent).toContain("CACHE_NAME");
      expect(swContent).toContain("install");
      expect(swContent).toContain("activate");
      expect(swContent).toContain("fetch");
    });
  });
});
