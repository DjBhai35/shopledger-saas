"use client";

import { UpcomingModule } from "@/components/UpcomingModule";

export default function InventoryPage() {
  return (
    <UpcomingModule
      moduleName="Inventory & Stock Tracking"
      description="Real-time multi-location stock tracking, batch numbers, low-stock threshold alerts, and stock adjustments."
      plannedFeatures={[
        "Real-time stock level decrement on POS sale",
        "Low-stock dashboard alerts with configurable thresholds",
        "Stock audit and adjustment logging with tenant isolation",
        "Multi-warehouse and backroom location tagging",
      ]}
    />
  );
}
