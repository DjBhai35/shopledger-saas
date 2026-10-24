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

## 💎 Prompt 3 Deliverables: USDT Crypto Payments & Secure Admin Panel

### 1. USDT Cryptocurrency Payments (TRC20 & BEP20)
- **Multi-Network Support**: Accepts USDT on both **TRC20 (Tron)** and **BEP20 (BNB Smart Chain)** networks.
- **Deposit Address Presentation**: Dedicated, copy-protected deposit address boxes with instantaneous **"Copied!"** visual feedback.
- **Network Safety Warnings**: Explicit prominent alerts cautioning users against cross-chain deposit errors.
- **Anti-Fraud Security Architecture**:
  - Submitting a Transaction Hash (TxID) strictly creates a `pending` proof record.
  - **Subscriptions are NEVER automatically activated by client submissions alone.**
  - Platform administrators must verify the transaction on the public blockchain explorer (TronScan / BscScan) before issuing an approval.
  - **Duplicate Transaction Hash Prevention**: Hashes are checked against global uniqueness ledgers across all tenants. Re-using or re-submitting an existing hash is strictly blocked.
- **User Payment Tracking**: Users can view real-time verification statuses (`Pending Review`, `Approved & Active`, `Rejected`) with admin notes or rejection reasons.

### 2. Platform Administration Panel (`/dashboard/admin`)
- **Restricted Access**: Enforced via verified `isSuperAdmin` flags, admin email lists (`NEXT_PUBLIC_ADMIN_EMAILS`, `ADMIN_EMAILS`), and restrictive Firestore Security Rules. Unauthorized users are blocked with an access-denied screen.
- **Payments Management**:
  - Filter by pending, approved, or rejected transactions.
  - Deep links to public block explorers (**TronScan** for TRC20, **BscScan** for BEP20).
  - One-click **Approve & Activate**: Atomically activates the subscription, computes term start/end dates, applies plan limits, and logs a permanent `payment_history` entry.
  - One-click **Reject**: Prompts for mandatory rejection reason (e.g. invalid hash, wrong amount) and records rejection without modifying workspace subscription.
- **User Accounts & Moderation**:
  - View all registered users across workspaces.
  - **Block / Unblock Accounts**: Instantly suspend fraudulent or delinquent accounts. Blocked users are locked out of the dashboard with an Account Suspended barrier.
  - Self-block protection prevents administrators from accidentally locking themselves out.
- **Pricing & Limits Configuration**:
  - Dynamically configure pricing for all tiers: Free Starter ($0), Growth ($5 / 2 mo), Pro ($8 / 6 mo), Wholesale ($15 / 12 mo).
  - Customize catalog product limits, monthly invoice caps, and staff account quotas.
- **Shop Categories Management**:
  - Enable or disable specific shop categories across the platform.
- **Platform Settings & Support**:
  - Configurable official **WhatsApp Support Phone Number** and pre-filled message.
  - Support email and system announcement banner.
  - Configurable TRC20 and BEP20 USDT deposit addresses.

### 3. Subscription Lifecycle & Server-Side Enforcement
- **Automatic Expiration Handling**: When a paid subscription period lapses (`now > expiryDate`), the system automatically flags the subscription as `expired` and downgrades effective limits to Free Starter limits (100 products, 150 invoices).
- **Seamless Renewals**: Renewing an active subscription extends seamlessly from the existing `expiryDate`. Renewing an expired subscription begins from `now`.
- **Pre-Mutation Limits Enforcement**: Server and client limit services block creating the 101st product or 151st invoice if the subscription is expired or at capacity.

### 4. Configurable WhatsApp Customer Support
- **Header & Floating Buttons**: Embedded WhatsApp button with real-time status pulses.
- **Smart Pre-Filled Messages**: Links to `https://wa.me/<number>?text=...` with dynamic context including the shop's name, workspace ID, and user email for prompt customer service.

---

## 📦 Core Management Modules (Prompt 2 Deliverables)

### 1. Products & Inventory Management
- **Full Catalog Operations**: Add, edit, view, search, filter, and archive products.
- **Category-Aware Attributes**: Dynamic attributes tailored to business types (IMEI, storage, expiry dates, sizes, colors).
- **Tenant-Scoped Uniqueness**: Strict validation ensuring duplicate SKUs/barcodes cannot exist within the same workspace.
- **Stock Movement Auditing**: Real-time logging of all inventory changes (`opening_stock`, `sale`, `purchase`, `sale_return`, `purchase_return`, `damage`, `adjustment`) with user author attribution and previous/new quantity snapshots.

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
- **Local IndexedDB**: High-performance local storage with IndexedDB schema version 3 across 17 object stores.
- **Operation Journal (`operation_journal`)**: Idempotency ledger preventing duplicated stock decrements or re-applied mutations upon reconnection.
- **Conflict & Overselling Detection**: Flags items when concurrent offline transactions conflict with server state.
- **Server Acknowledgment Guarantee**: Offline mutations remain in `waiting_to_sync` or `syncing` until positively acknowledged by the server.

---

## 📋 Technology Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 15 (App Router, Turbopack, React 19) |
| **Language** | TypeScript (Strict mode enabled) |
| **Styling** | Tailwind CSS with responsive layout |
| **Authentication** | Firebase Authentication (Google Sign-In) |
| **Database** | Firebase Cloud Firestore |
| **Cryptocurrency Payments** | USDT on TRC20 & BEP20 Networks |
| **Offline Storage** | IndexedDB via `idb` (v3 Schema with Operation Journal) |
| **PWA / Service Worker** | Installable Web App (`manifest.json`, `sw.js`) |
| **Testing** | Vitest with in-memory IndexedDB emulation (`fake-indexeddb`) |

---

## 🏢 Multi-Tenant Architecture

Every business registered on ShopLedger receives an isolated workspace record.
- **Workspace ID (`workspaceId`)**: Scoped to every business record.
- **Memberships**: Role-based access control (`owner`, `admin`, `manager`, `cashier`).
- **Platform Admins**: Cross-workspace super administrators for payment verification, platform settings, and user moderation.
- **Users**: Users authenticate with Google. A single user can belong to multiple businesses.
- **Subscriptions**: Bounded limits for catalog products, monthly invoices, and staff accounts.

Detailed schema specification is available in [`docs/DATA_MODEL.md`](./docs/DATA_MODEL.md).

---

## 🔒 Security & Anti-Fraud Model

All client operations run against restrictive security rules (`firestore.rules`):
- Deny all by default (`allow read, write: if false;`).
- Platform Super Admin operations (`isSuperAdmin`) verified via token claims or authenticated email lists.
- Users can submit payment proofs with `status: 'pending'`, but **cannot set status to 'approved'**.
- Only verified platform administrators can approve payment proofs and upgrade subscriptions.
- Users cannot elevate their own permissions or unblock their own accounts.
- Detailed rules guide: [`docs/FIRESTORE_SECURITY.md`](./docs/FIRESTORE_SECURITY.md).

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
Configure your credentials:
```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# Platform Super Administrators (comma-separated emails)
NEXT_PUBLIC_ADMIN_EMAILS=mdilshadm282@gmail.com,admin@shopledger.app
```

> **Note**: If you run without Firebase keys configured, ShopLedger automatically activates the **Instant Sandbox Mode** so you can test onboarding, offline persistence, USDT payment submissions, and the dashboard immediately.

### 4. Running the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

### 5. Running the Automated Test Suite
```bash
npm test
```
Executes all 15 Vitest test suites across Products, POS Sales, Purchases, Ledgers, Reports, USDT Payments, Admin Security, Immutable Audit Logs, and Offline Sync Engines:
```text
 ✓ src/tests/usdt-payments.test.ts (8 tests)
 ✓ src/tests/admin-audit.test.ts (8 tests)
 ✓ src/tests/sales-pos.test.ts (5 tests)
 ✓ src/tests/ledger-expenses.test.ts (5 tests)
 ✓ src/tests/subscription-lifecycle.test.ts (5 tests)
 ✓ src/tests/purchases.test.ts (3 tests)
 ✓ src/tests/subscription-limits.test.ts (2 tests)
 ✓ src/tests/reports.test.ts (1 test)
 ✓ src/tests/admin-security.test.ts (6 tests)
 ✓ src/tests/offline-sync.test.ts (6 tests)
 ✓ src/tests/offline-journal.test.ts (3 tests)
 ✓ src/tests/products.test.ts (4 tests)
 ✓ src/tests/pricing.test.ts (3 tests)
 ✓ src/tests/categories.test.ts (4 tests)
 ✓ src/tests/workspace-tenant.test.ts (2 tests)

 Test Files  15 passed (15)
      Tests  65 passed (65)
```

### 6. Production Build
```bash
npm run build
```
Compiles and optimizes all 27 static and dynamic production routes cleanly with 0 type errors.

---

## 📱 Progressive Web App (PWA) & Android Packaging

ShopLedger SaaS is built with an offline-first PWA architecture including:
- Service Worker (`public/sw.js`) with cache-first and stale-while-revalidate strategies.
- Web App Manifest (`public/manifest.json`) configured for `standalone` display and custom branding.
- Full step-by-step documentation for compiling into a native Android bundle (`.aab`) or APK (`.apk`) via Google's official Bubblewrap CLI (Trusted Web Activity - TWA) or Ionic Capacitor in [`docs/ANDROID_PACKAGING.md`](./docs/ANDROID_PACKAGING.md).

---

## 📄 License
MIT License. Created for the ShopLedger SaaS Platform.
