"use client";

import { UpcomingModule } from "@/components/UpcomingModule";

export default function PurchasesPage() {
  return (
    <UpcomingModule
      moduleName="Purchases & Inward Stock"
      description="Record incoming stock shipments from wholesalers, supplier bills, invoice matching, and automated average unit cost adjustments."
      plannedFeatures={[
        "Inward shipment entry with lot/batch tracking",
        "Cost averaging and supplier invoice matching",
        "Debit note generation for damaged stock returns",
      ]}
    />
  );
}
