# ShopLedger SaaS

> **Multi-Tenant Shop & Wholesale Management SaaS Platform**  
> Built with Next.js 15, React 19, TypeScript, Tailwind CSS, Firebase Authentication, Cloud Firestore, and an Offline-First IndexedDB Engine.

---

## 🚀 Overview

ShopLedger SaaS is a production-oriented cloud software platform built specifically for shopkeepers, retailers, distributors, and wholesale traders across multiple industries (Mobile Shops, Electronics, Computer Shops, Apparel, General Stores, Hardware, and Wholesale Trading).

Unlike basic web apps, ShopLedger implements:
- **True Multi-Tenant Isolation**: Enforced at the database layer via strict Firestore Security Rules.
- **Offline-First Persistence**: In-browser IndexedDB local storage and an idempotent synchronization queue that handles network drops gracefully.
- **Real Firebase Authentication**: Google Sign-In with stable Firebase UIDs.
- **Configurable Business Categories & Pricing**: Dynamic schemas for 11 distinct shop types and 4 subscription tiers ($0 Free Starter, $5 Growth, $8 Pro, $15 Annual Wholesale).
- **Zero Mock Fallacy**: Real application logic, real Firestore integration, and transparent status indicators.

---

## 📋 Technology Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 15 (App Router, Turbopack, React 19) |
| **Language** | TypeScript (Strict mode enabled) |
| **Styling** | Tailwind CSS with responsive layout |
| **Authentication** | Firebase Authentication (Google Sign-In) |
| **Database** | Firebase Cloud Firestore |
| **Offline Storage** | IndexedDB via `idb` |
| **PWA / Service Worker** | Installable Web App (`manifest.json`, `sw.js`) |
| **Testing** | Vitest with in-memory IndexedDB emulation (`fake-indexeddb`) |

---

## 🏢 Multi-Tenant Architecture

Every business registered on ShopLedger receives an isolated workspace record.
- **Workspace ID (`workspaceId`)**: Assigned to every business record.
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
1. **Local IndexedDB**: All store data is stored locally.
2. **Sync Queue**: Modifications generate an idempotent mutation item with a unique UUID.
3. **Status Transitions**:
   - `saved_locally` / `waiting_to_sync`
   - `syncing`
   - `synced` (Server acknowledged only)
   - `failed` (Retry counter with error logging)
   - `conflict`
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
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Running the Automated Tests
```bash
npm run test
```

### 6. Building for Production
```bash
npm run build
```

---

## 📱 Working Screens (Phase 1)

1. **Public Landing Page** (`/`): High-converting presentation of multi-tenant features, business categories, and pricing tiers.
2. **Sign-In Page** (`/login`): Google Sign-In with environment status banner and Sandbox test mode.
3. **Business Onboarding Wizard** (`/onboarding`): Multi-step setup for shop name, category, country, currency, optional phone, and optional store address.
4. **Main Dashboard** (`/dashboard`): Responsive dashboard showing active workspace, live online/offline badge, sync status, and the interactive **Offline Data & Sync Engine Test Lab**.
5. **Subscription & Entitlements** (`/dashboard/subscription`): Comprehensive tier breakdown ($0, $5, $8, $15) and entitlement limits.
6. **Account & Workspace Settings** (`/dashboard/settings`): Profile management, business invoice/tax configuration, and workspace switching.
7. **Help & Support** (`/dashboard/help`): Knowledge base and architecture FAQs.
8. **Roadmap Module Views**: Products, Inventory, Customers, Suppliers, Sales POS, Purchases, Customer Ledger, Expenses, and Reports with clear Phase 2 planned capabilities.

---

## 🗺️ Project Roadmap (Next Phases)

- **Phase 2: Core Commerce Engine**
  - Live Products & Barcode Scanning (IMEI & variation matrices)
  - Sub-second POS Cash Register with Thermal Printing (80mm/58mm)
  - Dual-entry Customer Udhar / Khata Ledger with WhatsApp invoice sharing
  - Inward stock purchase matching and supplier credit tracking
- **Phase 3: Privileged Backoffice & Payments**
  - Cloud Functions payment webhooks (Stripe / JazzCash / EasyPaisa / Razorpay)
  - Multi-location warehouse transfers
  - Automated weekly and monthly P&L reporting

---

## 📄 License
Private & Proprietary SaaS codebase. All rights reserved.
