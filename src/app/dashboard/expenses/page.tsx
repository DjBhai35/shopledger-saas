"use client";

import { UpcomingModule } from "@/components/UpcomingModule";

export default function ExpensesPage() {
  return (
    <UpcomingModule
      moduleName="Shop Expenses & Cash Outflow"
      description="Record operational shop expenses including shop rent, staff wages, utilities, packaging, tea/refreshments, and maintenance."
      plannedFeatures={[
        "Categorized expense logging with receipt image attachment",
        "Recurring expense automation (Monthly rent, salaries)",
        "Net profit deduction calculation against gross revenue",
      ]}
    />
  );
}
