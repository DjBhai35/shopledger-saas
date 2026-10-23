import { describe, it, expect } from "vitest";
import {
  PRICING_PLANS,
  getPlanById,
  createDefaultFreeSubscription,
} from "@/lib/config/pricing";

describe("Pricing and Subscription Architecture", () => {
  it("should define all expected pricing tiers accurately", () => {
    const free = getPlanById("free");
    expect(free.priceUSD).toBe(0);
    expect(free.limits.maxProducts).toBe(100);

    const growth2m = getPlanById("growth_2m");
    expect(growth2m.priceUSD).toBe(5);
    expect(growth2m.durationMonths).toBe(2);

    const pro6m = getPlanById("pro_6m");
    expect(pro6m.priceUSD).toBe(8);
    expect(pro6m.durationMonths).toBe(6);

    const enterprise12m = getPlanById("enterprise_12m");
    expect(enterprise12m.priceUSD).toBe(15);
    expect(enterprise12m.durationMonths).toBe(12);
  });

  it("should create default free subscription with active status and far-future expiry", () => {
    const sub = createDefaultFreeSubscription("ws_test_123");
    expect(sub.workspaceId).toBe("ws_test_123");
    expect(sub.planId).toBe("free");
    expect(sub.priceUSD).toBe(0);
    expect(sub.status).toBe("active");
    expect(sub.expiryDate).toBeGreaterThan(Date.now() + 100000000);
    expect(sub.features.offlineMode).toBe(true);
    expect(sub.features.customerLedger).toBe(true);
  });

  it("should restrict high-tier features on free starter tier", () => {
    const freePlan = getPlanById("free");
    expect(freePlan.features.wholesalePricing).toBe(false);
    expect(freePlan.features.multiDeviceSync).toBe(false);

    const enterprisePlan = getPlanById("enterprise_12m");
    expect(enterprisePlan.features.wholesalePricing).toBe(true);
    expect(enterprisePlan.features.multiDeviceSync).toBe(true);
  });
});
