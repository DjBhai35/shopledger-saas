"use client";

import { UpcomingModule } from "@/components/UpcomingModule";

export default function SuppliersPage() {
  return (
    <UpcomingModule
      moduleName="Suppliers & Vendor Management"
      description="Track manufacturers, wholesalers, distributors, purchase orders, and accounts payable."
      plannedFeatures={[
        "Supplier profiles, payment terms, and bank details",
        "Purchase order tracking with bill attachment",
        "Accounts payable ledger and payment scheduling",
      ]}
    />
  );
}
