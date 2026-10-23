# Multi-Tenant Firestore & IndexedDB Data Model

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
|  - currency: string (e.g. "USD", "PKR", "INR")               |
|  - currencySymbol: string (e.g. "$", "Rs.", "₹")             |
|  - ownerUid: string                                          |
|  - settings: WorkspaceSettings                               |
+------------------------------+-------------------------------+
                               |
        +----------------------+----------------------+
        |                      |                      |
        v                      v                      v
+---------------+      +---------------+      +---------------+
|   products    |      |   customers   |      |   suppliers   |
+-------+-------+      +-------+-------+      +-------+-------+
        |                      |                      |
        | 1:N                  | 1:N                  | 1:N
        v                      v                      v
+---------------+      +---------------+      +---------------+
|stock_movements|      |customer_ledger|      |supplier_ledger|
+---------------+      +---------------+      +---------------+
        ^                      ^                      ^
        |                      |                      |
+-------+-------+              |                      |
|     sales     +--------------+                      |
+---------------+                                     |
                                                      |
+---------------+                                     |
|   purchases   +-------------------------------------+
+-------+-------+
        |
        v
+---------------+
|   expenses    |
+---------------+
```

---

## 2. Core Collections Specification

### 2.1 `products/{productId}`
| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique product ID |
| `workspaceId` | `string` | Tenant workspace identifier |
| `name` | `string` | Product title |
| `sku` | `string` | Unique Stock Keeping Unit within workspace |
| `barcode` | `string?` | Optional EAN/UPC/Code128 barcode |
| `category` | `string` | Categorization group |
| `brand` | `string?` | Manufacturer or brand |
| `costPrice` | `number` | Inward acquisition cost |
| `sellingPrice` | `number` | Standard retail/selling price |
| `quantity` | `number` | Current stock on hand |
| `minStockAlert` | `number` | Threshold for low stock warning |
| `unit` | `string` | Unit of measure (`pcs`, `box`, `kg`, etc.) |
| `mobileAttributes` | `object?` | `model`, `storage`, `color`, `imei`, `warrantyMonths` |
| `repairAttributes` | `object?` | `deviceModel`, `partsUsed`, `serviceCharge`, `status` |
| `clothingAttributes` | `object?` | `size`, `color`, `style`, `material` |
| `groceryAttributes` | `object?` | `batchNumber`, `expiryDate`, `packageWeight` |
| `electronicsAttributes`| `object?` | `model`, `serialNumber`, `warrantyMonths` |
| `wholesaleAttributes` | `object?` | `minOrderQuantity`, `wholesalePrice`, `boxQuantity` |
| `isArchived` | `boolean` | Soft deletion status |

### 2.2 `stock_movements/{movementId}`
Immutable audit trail for all quantity adjustments:
- `workspaceId`: Scoped to tenant.
- `productId`: Target product.
- `type`: `'opening_stock' | 'sale' | 'purchase' | 'sale_return' | 'purchase_return' | 'damage' | 'adjustment'`.
- `quantityChange`: Signed change (e.g. `-2`, `+50`).
- `previousQuantity` & `newQuantity`: Verified state before and after mutation.
- `unitCost`: Cost snapshot at time of movement.
- `referenceId`: Invoice number or purchase order reference.
- `authorUid`: User responsible for action.

### 2.3 `customers/{customerId}` & `customer_ledger/{entryId}`
- **Customer**: `name`, optional `phone`, `address`, `openingBalance`, `currentBalance`.
- **Customer Ledger**: `type` (`opening_balance`, `credit_sale`, `payment_received`, `sale_return`), `debit`, `credit`, `runningBalance`, `referenceId`.

### 2.4 `suppliers/{supplierId}` & `supplier_ledger/{entryId}`
- **Supplier**: `name`, `contactPerson`, optional `phone`, `address`, `openingBalance`, `currentPayableBalance`.
- **Supplier Ledger**: `type` (`opening_balance`, `purchase_credit`, `payment_made`, `purchase_return`), `debit`, `credit`, `runningBalance`, `referenceId`.

### 2.5 `sales/{saleId}`
- `invoiceNumber`: Unique formatted sequence (e.g. `INV-20261023-A4F1`).
- `customerId`: Reference to customer or `null` for anonymous walk-in.
- `items`: Array of `{ productId, productName, quantity, unitCost, unitPrice, discount, total }`.
- `subtotal`, `discountTotal`, `taxTotal`, `totalAmount`, `paidAmount`, `balanceDue`.
- `paymentMethod`: `'cash' | 'card' | 'bank_transfer' | 'credit'`.
- `status`: `'completed' | 'refunded' | 'cancelled'`.

### 2.6 `purchases/{purchaseId}`
- `purchaseNumber`: Unique PO string (e.g. `PO-20261023-9B2C`).
- `supplierId`: Vendor reference.
- `items`: Inward lines with received quantity and unit cost.
- `subtotal`, `taxTotal`, `totalAmount`, `paidAmount`, `balanceDue`.
- `status`: `'received' | 'returned' | 'cancelled'`.

### 2.7 `expenses/{expenseId}`
- `category`: `'rent' | 'utilities' | 'salaries' | 'transport' | 'supplies' | 'repairs' | 'marketing' | 'custom'`.
- `amount`: Safe positive number.
- `date`: Timestamp.
- `paymentMethod`: Cash or digital payment.
- `description` & optional `receiptNumber`.

### 2.8 `operation_journal/{operationId}`
- Deterministic idempotency ledger stored in IndexedDB and replicated to Firestore.
- Prevents re-executing transactions or applying duplicate stock decrements during sync retries.
