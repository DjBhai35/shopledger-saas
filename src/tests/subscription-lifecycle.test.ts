import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { resetDBConnection, getLocalDB } from "@/lib/offline/db";
import {
  getEffectiveSubscription,
  checkProductLimit,
  checkMonthlyInvoiceLimit,
} from "@/lib/services/subscriptionLimitService";
import {
  submitPaymentProof,
  approvePaymentProof,
} from "@/lib/services/cryptoPaymentService";
import { WorkspaceSubscription, Product } from "@/types";
import { PRICING_PLANS } from "@/lib/config/pricing";

describe("Subscription Lifecycle, Expiry & Renewals", () => {
  const wsId = "ws_lifecycle_test";
  const adminUser = { uid: "admin_super", email: "mdilshadm282@gmail.com", isSuperAdmin: true };

  beforeEach(() => {
    resetDBConnection();
  });

  describe("Effective State & Expiration Calculations", () => {
    it("should treat Free plan as perpetual and unexpired", () => {
      const state = getEffectiveSubscription(null);
      expect(state.isExpired).toBe(false);
      expect(state.planId).toBe("free");
      expect(state.limits.maxProducts).toBe(100);
      expect(state.limits.maxMonthlyInvoices).toBe(150);
    });

    it("should recognize active unexpired paid subscription and retain higher limits", () => {
      const now = Date.now();
      const sub: WorkspaceSubscription = {
        id: `sub_${wsId}`,
        workspaceId: wsId,
        planId: "pro_6m",
        planName: "Pro (6 Months)",
        status: "active",
        priceUSD: 8,
        durationMonths: 6,
        startDate: now - 30 * 24 * 60 * 60 * 1000, // 30 days ago
        expiryDate: now + 150 * 24 * 60 * 60 * 1000, // 150 days in future
        features: PRICING_PLANS[2].features,
        limits: PRICING_PLANS[2].limits, // 5000 products
        autoRenew: false,
        updatedAt: now,
      };

      const state = getEffectiveSubscription(sub);
      expect(state.isExpired).toBe(false);
      expect(state.status).toBe("active");
      expect(state.daysRemaining).toBe(150);
      expect(state.limits.maxProducts).toBe(5000);
    });

    it("should automatically downgrade limits to Free Tier when paid subscription expires", () => {
      const now = Date.now();
      const expiredSub: WorkspaceSubscription = {
        id: `sub_${wsId}`,
        workspaceId: wsId,
        planId: "growth_2m",
        planName: "Growth (2 Months)",
        status: "active",
        priceUSD: 5,
        durationMonths: 2,
        startDate: now - 90 * 24 * 60 * 60 * 1000, // 90 days ago
        expiryDate: now - 30 * 24 * 60 * 60 * 1000, // expired 30 days ago
        features: PRICING_PLANS[1].features,
        limits: PRICING_PLANS[1].limits, // 1000 products
        autoRenew: false,
        updatedAt: now,
      };

      const state = getEffectiveSubscription(expiredSub);
      expect(state.isExpired).toBe(true);
      expect(state.status).toBe("expired");
      expect(state.daysRemaining).toBe(0);
      // Limits must fall back to Free Tier limits (100 products, 150 invoices)
      expect(state.limits.maxProducts).toBe(100);
      expect(state.limits.maxMonthlyInvoices).toBe(150);
    });
  });

  describe("Enforcement on Expired Subscriptions", () => {
    it("should block adding products beyond Free limit when subscription is expired", async () => {
      const db = await getLocalDB();
      const now = Date.now();

      const expiredSub: WorkspaceSubscription = {
        id: `sub_${wsId}`,
        workspaceId: wsId,
        planId: "pro_6m",
        planName: "Pro",
        status: "active",
        priceUSD: 8,
        durationMonths: 6,
        startDate: now - 200 * 24 * 60 * 60 * 1000,
        expiryDate: now - 20 * 24 * 60 * 60 * 1000, // Expired 20 days ago
        features: PRICING_PLANS[2].features,
        limits: PRICING_PLANS[2].limits,
        autoRenew: false,
        updatedAt: now,
      };

      // Seed 100 products in IndexedDB
      for (let i = 0; i < 100; i++) {
        await db.put("products", {
          id: `prod_${i}`,
          workspaceId: wsId,
          name: `Item ${i}`,
          sku: `SKU-${i}`,
          category: "General",
          costPrice: 5,
          sellingPrice: 10,
          quantity: 1,
          minStockAlert: 1,
          unit: "pcs",
          isArchived: false,
          createdAt: now,
          updatedAt: now,
        });
      }

      // Check product limit on expired sub: should be blocked because limit downgraded to 100!
      const check = await checkProductLimit(wsId, expiredSub);
      expect(check.allowed).toBe(false);
      expect(check.current).toBe(100);
      expect(check.max).toBe(100);
      expect(check.reason).toContain("subscription has expired");
    });
  });

  describe("Subscription Renewal Flow", () => {
    it("should seamlessly extend period when renewing an active subscription", async () => {
      const db = await getLocalDB();
      const now = Date.now();
      const initialExpiry = now + 40 * 24 * 60 * 60 * 1000; // 40 days in future

      // Seed active subscription into DB cache
      const currentSub: WorkspaceSubscription = {
        id: `sub_${wsId}`,
        workspaceId: wsId,
        planId: "growth_2m",
        planName: "Growth (2 Months)",
        status: "active",
        priceUSD: 5,
        durationMonths: 2,
        startDate: now - 20 * 24 * 60 * 60 * 1000,
        expiryDate: initialExpiry,
        features: PRICING_PLANS[1].features,
        limits: PRICING_PLANS[1].limits,
        autoRenew: false,
        updatedAt: now,
      };
      await db.put("cache_store", {
        key: `subscription_${wsId}`,
        data: currentSub,
        updatedAt: now,
      });

      // User submits payment for Pro (6 months, $8)
      const validHash = "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd";
      const proof = await submitPaymentProof({
        workspaceId: wsId,
        workspaceName: "My Shop",
        userUid: "user_owner",
        userEmail: "owner@shop.com",
        planId: "pro_6m",
        amountUSD: 8,
        network: "TRC20",
        txHash: validHash,
      });

      // Admin approves renewal
      const { subscription: renewedSub } = await approvePaymentProof({
        proofId: proof.id,
        adminUser,
      });

      // Expiry date must extend from initialExpiry, NOT from now!
      const expectedDurationMs = 6 * 30 * 24 * 60 * 60 * 1000;
      expect(renewedSub.expiryDate).toBe(initialExpiry + expectedDurationMs);
      expect(renewedSub.planId).toBe("pro_6m");
      expect(renewedSub.status).toBe("active");
    });
  });
});
