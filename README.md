# ShopLedger SaaS

> **Multi-Tenant Shop & Wholesale Management SaaS Platform**  
> Built with Next.js 15, React 19, TypeScript, Tailwind CSS, Firebase Authentication, Cloud Firestore, and an Offline-First IndexedDB Engine.

---

## 🚀 Overview

ShopLedger SaaS is a production-oriented cloud software platform built specifically for shopkeepers, retailers, distributors, and wholesale traders across multiple industries:
- **Mobile Phone & Repair Shops** (IMEI, model, storage, color, repair status, service charges)
- **Electronics & Computer Shops** (Serial numbers, manufacturer, warranty tracking)
- **Clothing & Garment Stores** (Sizes, colors, variants)
- **General Stores & Grocery Shops** (Batch numbers, expiry dates, units of measure)
- **Cosmetics & Hardware Stores** (Categorized stock units, wholesale pricing)
- **Wholesale Businesses** (Bulk quantity packs, wholesale tiers, credit khata accounts)

---

## 📦 Core Management Modules (Prompt 2 Deliverables)

### 1. Products & Inventory Management
- **Full Catalog Operations**: Add, edit, view, search, filter, and archive products.
- **Category-Aware Attributes**: Dynamic attributes tailored to business types (e.g. IMEI and storage for mobile stores, expiry dates for grocery, sizes/colors for clothing).
- **Tenant-Scoped Uniqueness**: Strict validation ensuring duplicate SKUs and barcodes cannot exist within the same workspace, while safely allowing identical SKUs across different tenants.
- **Stock Movement Auditing**: Real-time logging of all inventory changes (`opening_stock`, `sale`, `purchase`, `sale_return`, `purchase_return`, `damage`, `adjustment`) with user author attribution and previous/new quantity snapshots.
- **Safety Indicators**: Low-stock alerts and out-of-stock badges.

### 2. Customers & Suppliers Directory
- **Customer CRM**: Maintain customer profiles, phone numbers, addresses, and opening balances.
- **Supplier Directory**: Manage vendors, contact persons, phone numbers, and payables.
- **Payment Collection & Payouts**: Record customer payments against outstanding receivables and supplier disbursements against accounts payable.
- **Customer Account Statements**: Generate filterable statements with opening balance, debits, credits, and running closing balance.

### 3. Point of Sale (POS) Billing Counter
- **Rapid Checkout**: Instant product search by name, SKU, or barcode with quick item addition.
- **Flexible Pricing**: Line-item discounts, overall invoice discounts, and configurable sales tax (VAT).
- **Payment Modes**: Cash, card, bank transfer, and credit / Udhar.
- **Udhar Safety Check**: Credit sales require a registered customer; anonymous walk-in sales must be settled in full.
- **Thermal Receipt Generation**: Native receipt formatting supporting both standard **58mm** and **80mm** ESC/POS compatible thermal printers, with monospace preview and print triggers.
- **Sales Returns**: Process full or partial returns with automatic stock restoration and customer balance credit adjustments.

### 4. Purchases & Inward Stock Receiving
- **Inward Stock Orders**: Log received inventory shipments with unit purchase costs, line totals, discounts, and payment terms.
- **Cost Price Averaging**: Automatically updates product `costPrice` to latest purchase cost upon stock receipt.
- **Accounts Payable Sync**: Unpaid purchase balances automatically update the supplier's payable ledger.
- **Purchase Returns**: Vendor returns deduct inventory and record debit notes against supplier accounts.

### 5. Dual-Entry Khata Ledgers
- **Customer Khata**: Automatic reconciliation of sales debits and payment credits.
- **Supplier Khata**: Automatic reconciliation of inventory purchases and vendor payouts.
- **Running Balances**: Every entry maintains a deterministic running balance for transparent audit trails.

### 6. Expense Management
- **Predefined & Custom Categories**: Rent, utilities, staff wages, freight & transport, packaging, shop maintenance, marketing, and miscellaneous expenses.
- **P&L Isolation**: Expenses are tracked independently from inventory purchases to prevent double-counting in financial statements.

### 7. Real Business Intelligence & Financial Reports
- **Sales Metrics**: Total revenue, cash collected, credit receivables, invoice count, and tax collected.
- **Cost of Goods Sold (COGS)**: Calculated strictly from real product purchase cost basis (`unitCost * quantitySold`), not estimated percentages.
- **Gross Profit**: `Total Revenue - COGS` with Gross Margin percentage.
- **Net Operating Result**: `Gross Profit - Total Operating Expenses`.
- **Balance Sheet Indicators**: Current Inventory Valuation at cost (`quantity * costPrice`), Total Stock Units, Accounts Receivable, and Accounts Payable.
- **Best Sellers Ranking**: Top products sorted by units sold, revenue, and gross profit contribution.

### 8. Offline-First Synchronization & Operation Journal
- **Local IndexedDB**: High-performance local storage with IndexedDB schema version 2.
- **Operation Journal (`operation_journal`)**: Idempotency ledger preventing duplicated stock decrements or re-applied mutations upon reconnection.
- **Conflict & Overselling Detection**: Flags items when concurrent offline transactions conflict with server state.
- **Server Acknowledgment Guarantee**: Offline mutations remain in `waiting_to_sync` or `syncing` until positively acknowledged by the server.

### 9. Subscription Tier Limit Enforcement
- **Free Starter ($0)**: Enforces limits of 100 products and 150 monthly invoices.
- **Paid Tiers ($5 Growth, $8 Pro, $15 Wholesale)**: Scaled or unlimited capacity verified on both client services and backend security rules.

---

## 📋 Technology Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 15 (App Router, Turbopack, React 19) |
| **Language** | TypeScript (Strict mode enabled) |
| **Styling** | Tailwind CSS with responsive layout |
| **Authentication** | Firebase Authentication (Google Sign-In) |
| **Database** | Firebase Cloud Firestore |
| **Offline Storage** | IndexedDB via `idb` (v2 Schema with Operation Journal) |
| **PWA / Service Worker** | Installable Web App (`manifest.json`, `sw.js`) |
| **Testing** | Vitest with in-memory IndexedDB emulation (`fake-indexeddb`) |

---

## 🏢 Multi-Tenant Architecture

Every business registered on ShopLedger receives an isolated workspace record.
- **Workspace ID (`workspaceId`)**: Scoped to every business record.
- **Memberships**: Role-based access control (`owner`, `admin`, `manager`, `cashier`).
- **Users**: Users authenticate with Google. A single user can belong to multiple businesses.
- **Subscriptions**: Bounded limits for catalog products, monthly invoices, and staff accounts.

Detailed schema specification is available in [`docs/DATA_MODEL.md`](./docs/DATA_MODEL.md).

---

## 🔒 Firestore Security Rules

All client operations run against restrictive security rules (`firestore.rules`):
- Deny all by default (`allow read, write: if false;`).
- Workspace membership verification via deterministic IDs (`mem_{workspaceId}_{userId}`).
- Client-side subscription elevation is blocked; upgrades must be verified via server-side logic / Cloud Functions.
- Detailed rules guide: [`docs/FIRESTORE_SECURITY.md`](./docs/FIRESTORE_SECURITY.md).

---

## ⚡ Offline-First Architecture

ShopLedger does not rely purely on browser cache or casual optimistic updates:
1. **Local IndexedDB**: All store data is stored locally across 14 dedicated object stores.
2. **Sync Queue**: Modifications generate an idempotent mutation item with a unique UUID.
3. **Status Transitions**:
   - `saved_locally` / `waiting_to_sync`
   - `syncing`
   - `synced` (Server acknowledged only)
   - `failed` (Retry counter with error logging)
   - `conflict` (Concurrent edits or overselling)
4. Detailed offline guide: [`docs/OFFLINE_ARCHITECTURE.md`](./docs/OFFLINE_ARCHITECTURE.md).

---

## 🏁 Getting Started

### 1. Prerequisites
- Node.js `v20+` or `v24+`
- Git

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/DjBhai35/shopledger-saas.git
cd shopledger-saas

# Install dependencies
npm install
```

### 3. Environment Configuration
Create a `.env.local` file from `.env.example`:
```bash
cp .env.example .env.local
```
Add your Firebase Project credentials (see [`docs/FIREBASE_SETUP.md`](./docs/FIREBASE_SETUP.md)).

> **Note**: If you run without Firebase keys configured, ShopLedger automatically activates the **Instant Sandbox Mode** so you can test onboarding, offline persistence, and the dashboard immediately.

### 4. Running the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

### 5. Running the Automated Test Suite
```bash
npm test
```
Executes all 11 Vitest test suites across Products, POS Sales, Purchases, Ledgers, Reports, Limits, and Offline Engines:
```text
 ✓ src/tests/ledger-expenses.test.ts (5 tests)
 ✓ src/tests/purchases.test.ts (3 tests)
 ✓ src/tests/sales-pos.test.ts (5 tests)
 ✓ src/tests/subscription-limits.test.ts (2 tests)
 ✓ src/tests/reports.test.ts (1 test)
 ✓ src/tests/offline-sync.test.ts (6 tests)
 ✓ src/tests/offline-journal.test.ts (3 tests)
 ✓ src/tests/products.test.ts (4 tests)
 ✓ src/tests/workspace-tenant.test.ts (2 tests)
 ✓ src/tests/pricing.test.ts (3 tests)
 ✓ src/tests/categories.test.ts (4 tests)

 Test Files  11 passed (11)
      Tests  38 passed (38)
```

### 6. Production Build
```bash
npm run build
```
Compiles and optimizes all 19 static and dynamic routes.

---

## 📄 License
MIT License. Created for the ShopLedger SaaS Platform.
