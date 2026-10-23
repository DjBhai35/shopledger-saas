import { describe, it, expect } from "vitest";
import { BUSINESS_CATEGORIES, getCategoryByKey } from "@/lib/config/categories";

describe("Business Categories Configuration", () => {
  it("should contain all required shop and wholesale categories", () => {
    const requiredKeys = [
      "mobile_shop",
      "mobile_repair_shop",
      "mobile_parts_shop",
      "electronics_shop",
      "computer_shop",
      "clothing_and_garments",
      "general_store",
      "cosmetics_shop",
      "hardware_shop",
      "wholesale_business",
      "other_business",
    ];

    const definedKeys = BUSINESS_CATEGORIES.map((c) => c.key);
    for (const key of requiredKeys) {
      expect(definedKeys).toContain(key);
    }
  });

  it("should have descriptive labels for all categories", () => {
    for (const cat of BUSINESS_CATEGORIES) {
      expect(cat.label.length).toBeGreaterThan(3);
      expect(cat.description.length).toBeGreaterThan(10);
    }
  });

  it("should retrieve category by key accurately", () => {
    const mobile = getCategoryByKey("mobile_shop");
    expect(mobile.label).toBe("Mobile Shop");
    expect(mobile.icon).toBe("Smartphone");

    const wholesale = getCategoryByKey("wholesale_business");
    expect(wholesale.label).toBe("Wholesale Business");
  });

  it("should return fallback category for unknown keys", () => {
    const unknown = getCategoryByKey("non_existent_key");
    expect(unknown.key).toBe("other_business");
    expect(unknown.label).toBe("Other Business");
  });
});
