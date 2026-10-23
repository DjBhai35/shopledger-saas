"use client";

import { UpcomingModule } from "@/components/UpcomingModule";

export default function ProductsPage() {
  return (
    <UpcomingModule
      moduleName="Products & Catalog"
      description="Comprehensive product catalog management with barcode generation, IMEI tracking for mobile shops, variation matrices, and wholesale price tiers."
      plannedFeatures={[
        "Barcode and SKU scanning via camera or laser scanner",
        "IMEI & serial number tracking for electronics & mobile shops",
        "Category and brand taxonomies",
        "Cost price, retail price, and wholesale tier pricing",
        "Offline product lookup and caching via IndexedDB",
      ]}
    />
  );
}
