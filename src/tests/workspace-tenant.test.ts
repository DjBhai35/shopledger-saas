import { describe, it, expect } from "vitest";
import { createWorkspaceAndOnboard } from "@/lib/firebase/workspace";

describe("Multi-Tenant Workspace Isolation Architecture", () => {
  it("should create isolated workspace with owner membership and default free subscription", async () => {
    const params = {
      userId: "usr_alice_101",
      userEmail: "alice@phonehub.com",
      userDisplayName: "Alice Trader",
      businessName: "PhoneHub Electronics",
      category: "mobile_shop" as const,
      country: "Pakistan",
      currency: "PKR",
      currencySymbol: "Rs.",
      phone: "+92 300 1234567",
      address: "Plaza 4, Hafeez Centre, Lahore",
    };

    const { workspace, subscription } = await createWorkspaceAndOnboard(params);

    expect(workspace.id).toBeDefined();
    expect(workspace.name).toBe("PhoneHub Electronics");
    expect(workspace.ownerUid).toBe("usr_alice_101");
    expect(workspace.category).toBe("mobile_shop");
    expect(workspace.status).toBe("active");

    // Verify initial subscription
    expect(subscription.workspaceId).toBe(workspace.id);
    expect(subscription.planId).toBe("free");
    expect(subscription.priceUSD).toBe(0);
    expect(subscription.status).toBe("active");
  });

  it("should handle optional phone and address gracefully", async () => {
    const params = {
      userId: "usr_bob_202",
      userEmail: "bob@wholesalemarket.com",
      userDisplayName: "Bob Wholesaler",
      businessName: "Universal Wholesale",
      category: "wholesale_business" as const,
      country: "United States",
      currency: "USD",
      currencySymbol: "$",
    };

    const { workspace } = await createWorkspaceAndOnboard(params);
    expect(workspace.id).toBeDefined();
    expect(workspace.phone).toBeUndefined();
    expect(workspace.address).toBeUndefined();
    expect(workspace.currency).toBe("USD");
  });
});
