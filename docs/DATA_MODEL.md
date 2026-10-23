# Multi-Tenant Firestore Data Model

ShopLedger SaaS implements a strict multi-tenant schema where every business data document is explicitly associated with a `workspaceId`.

---

## 1. Entity Relationship Diagram

```
+--------------------------------------------------------------+
|                         users/{uid}                          |
|  - uid: string (Firebase Auth UID)                           |
|  - email: string | null                                      |
|  - displayName: string | null                                |
|  - currentWorkspaceId: string                                |
+------------------------------+-------------------------------+
                               |
                               | 1:N
                               v
+--------------------------------------------------------------+
|                memberships/mem_{workspaceId}_{uid}           |
|  - id: string                                                |
|  - workspaceId: string (FK -> workspaces)                    |
|  - userId: string (FK -> users)                              |
|  - role: 'owner' | 'admin' | 'manager' | 'cashier'           |
|  - status: 'active' | 'invited' | 'suspended'                |
|  - permissions: string[]                                     |
+------------------------------+-------------------------------+
                               |
                               | N:1
                               v
+--------------------------------------------------------------+
|                    workspaces/{workspaceId}                  |
|  - id: string                                                |
|  - name: string                                              |
|  - category: BusinessCategoryKey                             |
|  - country: string                                           |
|  - currency: string (e.g. "USD", "PKR", "INR")               |
|  - currencySymbol: string (e.g. "$", "Rs.", "₹")             |
|  - ownerUid: string                                          |
|  - phone?: string                                            |
|  - address?: string                                          |
|  - settings: WorkspaceSettings                               |
+------------------------------+-------------------------------+
                               |
                               | 1:1
                               v
+--------------------------------------------------------------+
|                subscriptions/sub_{workspaceId}               |
|  - id: string                                                |
|  - workspaceId: string                                       |
|  - planId: 'free' | 'growth_2m' | 'pro_6m' | 'enterprise_12m'|
|  - priceUSD: number                                          |
|  - durationMonths: number                                    |
|  - startDate: timestamp                                      |
|  - expiryDate: timestamp                                     |
|  - features: SubscriptionFeatures                            |
|  - limits: SubscriptionLimits                                |
+--------------------------------------------------------------+
```

---

## 2. Configurable Business Categories

| Key | Label | Description |
|---|---|---|
| `mobile_shop` | Mobile Shop | Retail sales of smartphones, accessories, and SIM cards |
| `mobile_repair_shop` | Mobile Repair Shop | Device repair tickets, screen replacements, servicing |
| `mobile_parts_shop` | Mobile Parts Shop | Spare parts, ICs, LCD screens, tools |
| `electronics_shop` | Electronics Shop | Home appliances, audio devices, electronics |
| `computer_shop` | Computer Shop | Laptops, desktops, PC components, networking gear |
| `clothing_and_garments`| Clothing and Garments | Apparel, footwear, sizes, fabrics, fashion accessories |
| `general_store` | General Store | Groceries, FMCG, daily convenience goods |
| `cosmetics_shop` | Cosmetics Shop | Beauty, skincare, personal care products |
| `hardware_shop` | Hardware Shop | Tools, plumbing, electrical, fasteners |
| `wholesale_business` | Wholesale Business | Bulk distribution, tiered pricing, volume orders |
| `other_business` | Other Business | Custom commercial trade and general store billing |

---

## 3. Subscription Pricing Tiers

| Plan ID | Name | Duration | Price (USD) | Effective Rate | Product Limit | Invoice Limit |
|---|---|---|---|---|---|---|
| `free` | Free Starter | Perpetual | **$0** | $0/mo | 100 | 150/mo |
| `growth_2m` | Growth | 2 Months | **$5** | $2.50/mo | 1,000 | 1,000/mo |
| `pro_6m` | Pro | 6 Months | **$8** | $1.33/mo | 5,000 | 5,000/mo |
| `enterprise_12m`| Annual Wholesale| 12 Months| **$15** | $1.25/mo | 50,000 | 50,000/mo |
