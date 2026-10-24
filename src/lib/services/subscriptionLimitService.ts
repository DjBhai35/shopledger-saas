import { getLocalDB } from "@/lib/offline/db";
import { WorkspaceSubscription, SubscriptionLimits, SubscriptionStatus } from "@/types";
import { PRICING_PLANS } from "@/lib/config/pricing";

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  current: number;
  max: number;
}

export interface EffectiveSubscriptionState {
  isExpired: boolean;
  isExpiringSoon: boolean; // within 7 days
  daysRemaining: number;
  status: SubscriptionStatus;
  planId: string;
  planName: string;
  limits: SubscriptionLimits;
}

const FREE_PLAN_LIMITS: SubscriptionLimits = PRICING_PLANS[0].limits;

/**
 * Computes the real-time effective subscription state, resolving expiration and grace periods.
 * If a paid subscription period has elapsed, limits automatically downgrade to Free Starter tier.
 */
export function getEffectiveSubscription(
  subscription?: WorkspaceSubscription | null
): EffectiveSubscriptionState {
  if (!subscription || subscription.planId === "free") {
    return {
      isExpired: false,
      isExpiringSoon: false,
      daysRemaining: 9999,
      status: "active",
      planId: "free",
      planName: "Free Starter",
      limits: FREE_PLAN_LIMITS,
    };
  }

  const now = Date.now();
  const msRemaining = subscription.expiryDate - now;
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
  const isExpired = msRemaining <= 0;
  const isExpiringSoon = !isExpired && daysRemaining <= 7;

  if (isExpired) {
    return {
      isExpired: true,
      isExpiringSoon: false,
      daysRemaining: 0,
      status: "expired",
      planId: subscription.planId,
      planName: subscription.planName,
      // Downgrade to free limits when expired
      limits: FREE_PLAN_LIMITS,
    };
  }

  return {
    isExpired: false,
    isExpiringSoon,
    daysRemaining,
    status: subscription.status || "active",
    planId: subscription.planId,
    planName: subscription.planName,
    limits: subscription.limits || FREE_PLAN_LIMITS,
  };
}

/**
 * Service to enforce subscription plan limits (products, monthly invoices, staff).
 * Evaluated on both client and trusted server logic.
 */
export async function checkProductLimit(
  workspaceId: string,
  subscription?: WorkspaceSubscription | null
): Promise<LimitCheckResult> {
  const effective = getEffectiveSubscription(subscription);
  const maxProducts = effective.limits.maxProducts ?? 100;

  try {
    const db = await getLocalDB();
    const products = await db.getAllFromIndex("products", "by_workspace", workspaceId);
    const activeProducts = products.filter((p) => !p.isArchived);
    const current = activeProducts.length;

    if (current >= maxProducts) {
      const reason = effective.isExpired
        ? `Your subscription has expired. Catalog is restricted to Free Tier limit (${current}/${maxProducts}). Renew your subscription to restore higher limits.`
        : `Product limit reached (${current}/${maxProducts}). Upgrade your subscription tier to add more products.`;

      return {
        allowed: false,
        reason,
        current,
        max: maxProducts,
      };
    }

    return { allowed: true, current, max: maxProducts };
  } catch {
    return { allowed: true, current: 0, max: maxProducts };
  }
}

export async function checkMonthlyInvoiceLimit(
  workspaceId: string,
  subscription?: WorkspaceSubscription | null
): Promise<LimitCheckResult> {
  const effective = getEffectiveSubscription(subscription);
  const maxInvoices = effective.limits.maxMonthlyInvoices ?? 150;

  try {
    const db = await getLocalDB();
    const sales = await db.getAllFromIndex("sales", "by_workspace", workspaceId);

    // Calculate sales in current calendar month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const currentMonthSales = sales.filter((s) => s.createdAt >= startOfMonth);
    const current = currentMonthSales.length;

    if (current >= maxInvoices) {
      const reason = effective.isExpired
        ? `Your subscription has expired. Invoices are capped at Free Tier limit (${current}/${maxInvoices}). Renew your subscription to issue more invoices.`
        : `Monthly invoice limit reached (${current}/${maxInvoices}). Upgrade your plan to issue more sales invoices this month.`;

      return {
        allowed: false,
        reason,
        current,
        max: maxInvoices,
      };
    }

    return { allowed: true, current, max: maxInvoices };
  } catch {
    return { allowed: true, current: 0, max: maxInvoices };
  }
}

export async function checkStaffLimit(
  workspaceId: string,
  currentStaffCount: number,
  subscription?: WorkspaceSubscription | null
): Promise<LimitCheckResult> {
  const effective = getEffectiveSubscription(subscription);
  const maxStaff = effective.limits.maxStaffAccounts ?? 1;

  if (currentStaffCount >= maxStaff) {
    return {
      allowed: false,
      reason: effective.isExpired
        ? `Subscription expired. Staff accounts limited to ${maxStaff}. Renew to add more staff.`
        : `Staff accounts limit reached (${currentStaffCount}/${maxStaff}). Upgrade your plan to invite more staff members.`,
      current: currentStaffCount,
      max: maxStaff,
    };
  }

  return { allowed: true, current: currentStaffCount, max: maxStaff };
}
