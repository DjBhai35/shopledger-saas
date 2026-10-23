import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { resetDBConnection, getLocalDB } from "@/lib/offline/db";
import {
  checkProductLimit,
  checkMonthlyInvoiceLimit,
} from "@/lib/services/subscriptionLimitService";
import { Product, Sale, WorkspaceSubscription } from "@/types";

describe("Subscription Limits Enforcement Service", () => {
  const wsId = "ws_tier_limits_test";

  beforeEach(() => {
    resetDBConnection();
  });

  it("should permit product creation within free tier limit and enforce maxProducts cap", async () => {
    const db = await getLocalDB();

    // Check with empty DB: should be allowed (0 < 100)
    const initialCheck = await checkProductLimit(wsId, null);
    expect(initialCheck.allowed).toBe(true);
    expect(initialCheck.current).toBe(0);
    expect(initialCheck.max).toBe(100);

    // Seed 100 active products into IndexedDB
    for (let i = 0; i < 100; i++) {
      const prod: Product = {
        id: `p_${i}`,
        workspaceId: wsId,
        name: `Product ${i}`,
        sku: `SKU-${i}`,
        category: "General",
        costPrice: 5,
        sellingPrice: 10,
        quantity: 1,
        minStockAlert: 1,
        unit: "pcs",
        isArchived: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await db.put("products", prod);
    }

    // Now check again: 100 >= 100 => blocked
    const capCheck = await checkProductLimit(wsId, null);
    expect(capCheck.allowed).toBe(false);
    expect(capCheck.current).toBe(100);
    expect(capCheck.reason).toContain("Product limit reached");

    // With a paid subscription having maxProducts = 10000, it should be allowed
    const paidSubscription: WorkspaceSubscription = {
      id: "sub_1",
      workspaceId: wsId,
      tier: "growth",
      status: "active",
      billingCycle: "monthly",
      amountUSD: 5,
      currentPeriodStart: Date.now() - 86400000,
      currentPeriodEnd: Date.now() + 30 * 86400000,
      limits: {
        maxProducts: 10000,
        maxMonthlyInvoices: 5000,
        maxStaffAccounts: 5,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const paidCheck = await checkProductLimit(wsId, paidSubscription);
    expect(paidCheck.allowed).toBe(true);
    expect(paidCheck.max).toBe(10000);
  });

  it("should enforce monthly invoice limit (150 on free tier) and calculate current calendar month correctly", async () => {
    const db = await getLocalDB();

    // 0 invoices: allowed
    const emptyCheck = await checkMonthlyInvoiceLimit(wsId, null);
    expect(emptyCheck.allowed).toBe(true);
    expect(emptyCheck.current).toBe(0);
    expect(emptyCheck.max).toBe(150);

    // Seed 150 sales in the current month
    const now = Date.now();
    for (let i = 0; i < 150; i++) {
      const sale: Sale = {
        id: `s_${i}`,
        workspaceId: wsId,
        invoiceNumber: `INV-${i}`,
        customerId: null,
        customerName: "Walk-in",
        items: [],
        subtotal: 10,
        discountTotal: 0,
        taxTotal: 0,
        totalAmount: 10,
        paidAmount: 10,
        balanceDue: 0,
        paymentMethod: "cash",
        status: "completed",
        createdByUid: "user_1",
        createdAt: now,
        updatedAt: now,
      };
      await db.put("sales", sale);
    }

    const cappedCheck = await checkMonthlyInvoiceLimit(wsId, null);
    expect(cappedCheck.allowed).toBe(false);
    expect(cappedCheck.current).toBe(150);
    expect(cappedCheck.reason).toContain("Monthly invoice limit reached");

    // Seed 1 old sale from previous year — should not count towards current month
    const oldSale: Sale = {
      id: "s_old",
      workspaceId: wsId,
      invoiceNumber: "INV-OLD",
      customerId: null,
      customerName: "Walk-in",
      items: [],
      subtotal: 10,
      discountTotal: 0,
      taxTotal: 0,
      totalAmount: 10,
      paidAmount: 10,
      balanceDue: 0,
      paymentMethod: "cash",
      status: "completed",
      createdByUid: "user_1",
      createdAt: new Date("2024-01-01").getTime(),
      updatedAt: new Date("2024-01-01").getTime(),
    };
    await db.put("sales", oldSale);

    // Count should still be 150 for this month
    const checkAfterOld = await checkMonthlyInvoiceLimit(wsId, null);
    expect(checkAfterOld.current).toBe(150);
  });
});
