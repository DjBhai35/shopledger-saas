"use client";

import { UpcomingModule } from "@/components/UpcomingModule";

export default function SalesPage() {
  return (
    <UpcomingModule
      moduleName="POS Billing & Sales"
      description="High-speed Point of Sale counter with offline invoice generation, barcode integration, thermal printing, and partial credit sales."
      plannedFeatures={[
        "Sub-second offline POS checkout via IndexedDB",
        "80mm & 58mm thermal receipt printing formatting",
        "Split payments: Cash, Card, Bank Transfer, and Credit / Udhar",
        "Automated change calculation and discount controls",
      ]}
    />
  );
}
