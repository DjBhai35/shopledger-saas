"use client";

import { UpcomingModule } from "@/components/UpcomingModule";

export default function CustomersPage() {
  return (
    <UpcomingModule
      moduleName="Customers & CRM"
      description="Manage customer directories, contact details, purchase histories, and credit limits for retail and wholesale buyers."
      plannedFeatures={[
        "Customer contact profiles and credit limit rules",
        "Loyalty points and special discount tiers",
        "Direct WhatsApp receipt and balance notification links",
        "Export customer directory to CSV/Excel",
      ]}
    />
  );
}
