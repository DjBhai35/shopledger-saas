import { BusinessCategory, BusinessCategoryKey } from "@/types";

export const BUSINESS_CATEGORIES: BusinessCategory[] = [
  {
    key: "mobile_shop",
    label: "Mobile Shop",
    description: "Retail sales of smartphones, accessories, chargers, and SIM cards.",
    icon: "Smartphone",
    suggestedTaxRate: 0,
  },
  {
    key: "mobile_repair_shop",
    label: "Mobile Repair Shop",
    description: "Device repair services, screen replacements, and servicing tickets.",
    icon: "Wrench",
    suggestedTaxRate: 0,
  },
  {
    key: "mobile_parts_shop",
    label: "Mobile Parts Shop",
    description: "Wholesale and retail spare parts, ICs, LCD screens, and tools.",
    icon: "Cpu",
    suggestedTaxRate: 0,
  },
  {
    key: "electronics_shop",
    label: "Electronics Shop",
    description: "Home appliances, audio devices, televisions, and electronics.",
    icon: "Tv",
    suggestedTaxRate: 0,
  },
  {
    key: "computer_shop",
    label: "Computer Shop",
    description: "Laptops, desktops, PC components, networking gear, and peripherals.",
    icon: "Laptop",
    suggestedTaxRate: 0,
  },
  {
    key: "clothing_and_garments",
    label: "Clothing and Garments",
    description: "Apparel, footwear, fabrics, sizes, colors, and fashion accessories.",
    icon: "Shirt",
    suggestedTaxRate: 0,
  },
  {
    key: "general_store",
    label: "General Store",
    description: "Daily groceries, packaged goods, FMCG, and convenience items.",
    icon: "ShoppingBag",
    suggestedTaxRate: 0,
  },
  {
    key: "cosmetics_shop",
    label: "Cosmetics Shop",
    description: "Beauty, skincare, fragrances, and personal care products.",
    icon: "Sparkles",
    suggestedTaxRate: 0,
  },
  {
    key: "hardware_shop",
    label: "Hardware Shop",
    description: "Tools, building materials, plumbing, electrical, and fasteners.",
    icon: "Hammer",
    suggestedTaxRate: 0,
  },
  {
    key: "wholesale_business",
    label: "Wholesale Business",
    description: "Bulk distribution, tiered pricing, volume discounts, and supplier ledgers.",
    icon: "Boxes",
    suggestedTaxRate: 0,
  },
  {
    key: "other_business",
    label: "Other Business",
    description: "Custom shop or commercial trade with flexible inventory and billing.",
    icon: "Store",
    suggestedTaxRate: 0,
  },
];

export function getCategoryByKey(key: BusinessCategoryKey | string): BusinessCategory {
  const found = BUSINESS_CATEGORIES.find((cat) => cat.key === key);
  return (
    found || {
      key: "other_business",
      label: "Other Business",
      description: "Custom shop or commercial trade.",
      icon: "Store",
      suggestedTaxRate: 0,
    }
  );
}
