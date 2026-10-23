import { PricingPlan, SubscriptionPlanId, WorkspaceSubscription } from "@/types";

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "free",
    name: "Free Starter",
    priceUSD: 0,
    durationMonths: 120, // Perpetual free starter
    displayPrice: "$0",
    billingDescription: "Free forever for single shops getting started",
    isPopular: false,
    features: {
      offlineMode: true,
      multiDeviceSync: false,
      customerLedger: true,
      wholesalePricing: false,
      advancedReports: false,
      inventoryTracking: true,
      pdfExport: true,
      customBranding: false,
      prioritySupport: false,
    },
    limits: {
      maxProducts: 100,
      maxMonthlyInvoices: 150,
      maxCustomers: 100,
      maxStaffAccounts: 1,
    },
  },
  {
    id: "growth_2m",
    name: "Growth (2 Months)",
    priceUSD: 5,
    durationMonths: 2,
    displayPrice: "$5",
    billingDescription: "$5 billed every 2 months ($2.50/month)",
    isPopular: false,
    features: {
      offlineMode: true,
      multiDeviceSync: true,
      customerLedger: true,
      wholesalePricing: true,
      advancedReports: true,
      inventoryTracking: true,
      pdfExport: true,
      customBranding: false,
      prioritySupport: false,
    },
    limits: {
      maxProducts: 1000,
      maxMonthlyInvoices: 1000,
      maxCustomers: 1000,
      maxStaffAccounts: 3,
    },
  },
  {
    id: "pro_6m",
    name: "Pro (6 Months)",
    priceUSD: 8,
    durationMonths: 6,
    displayPrice: "$8",
    billingDescription: "$8 billed every 6 months ($1.33/month)",
    isPopular: true,
    features: {
      offlineMode: true,
      multiDeviceSync: true,
      customerLedger: true,
      wholesalePricing: true,
      advancedReports: true,
      inventoryTracking: true,
      pdfExport: true,
      customBranding: true,
      prioritySupport: true,
    },
    limits: {
      maxProducts: 5000,
      maxMonthlyInvoices: 5000,
      maxCustomers: 5000,
      maxStaffAccounts: 10,
    },
  },
  {
    id: "enterprise_12m",
    name: "Annual Wholesale (12 Months)",
    priceUSD: 15,
    durationMonths: 12,
    displayPrice: "$15",
    billingDescription: "$15 billed annually ($1.25/month - Best Value)",
    isPopular: false,
    features: {
      offlineMode: true,
      multiDeviceSync: true,
      customerLedger: true,
      wholesalePricing: true,
      advancedReports: true,
      inventoryTracking: true,
      pdfExport: true,
      customBranding: true,
      prioritySupport: true,
    },
    limits: {
      maxProducts: 50000,
      maxMonthlyInvoices: 50000,
      maxCustomers: 50000,
      maxStaffAccounts: 50,
    },
  },
];

export function getPlanById(id: SubscriptionPlanId | string): PricingPlan {
  const plan = PRICING_PLANS.find((p) => p.id === id);
  return plan || PRICING_PLANS[0];
}

/**
 * Creates the initial default subscription for a new workspace.
 * Uses Free Starter tier with safe defaults.
 */
export function createDefaultFreeSubscription(workspaceId: string): WorkspaceSubscription {
  const freePlan = getPlanById("free");
  const now = Date.now();
  const farFuture = now + 10 * 365 * 24 * 60 * 60 * 1000; // 10 years

  return {
    id: `sub_${workspaceId}`,
    workspaceId,
    planId: "free",
    planName: freePlan.name,
    status: "active",
    priceUSD: 0,
    durationMonths: freePlan.durationMonths,
    startDate: now,
    expiryDate: farFuture,
    features: { ...freePlan.features },
    limits: { ...freePlan.limits },
    autoRenew: false,
    updatedAt: now,
  };
}
