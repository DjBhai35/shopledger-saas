# Offline-First Architecture & Synchronization Engine

Offline operation is a first-class citizen in **ShopLedger SaaS**. The architecture ensures merchants can continue POS checkout, look up customers, record sales, log expenses, and view records even when internet connectivity fluctuates or drops entirely.

---

## 1. Storage Architecture (IndexedDB Schema v2)

ShopLedger utilizes a high-performance in-browser transactional database (`src/lib/offline/db.ts`) with 14 specialized object stores:

| Store Name | Primary Key | Key Indexes | Purpose |
|---|---|---|---|
| `products` | `id` | `by_workspace`, `by_sku`, `by_barcode` | Product catalog with category attributes |
| `stock_movements` | `id` | `by_workspace`, `by_product`, `by_type` | Immutable inventory audit trail |
| `customers` | `id` | `by_workspace` | Customer directory & credit balances |
| `suppliers` | `id` | `by_workspace` | Supplier directory & accounts payable |
| `sales` | `id` | `by_workspace`, `by_invoice`, `by_customer` | POS invoices and billing records |
| `purchases` | `id` | `by_workspace`, `by_po`, `by_supplier` | Inward receiving orders & cost updates |
| `customer_ledger` | `id` | `by_workspace`, `by_customer` | Dual-entry customer khata entries |
| `supplier_ledger` | `id` | `by_workspace`, `by_supplier` | Dual-entry supplier khata entries |
| `expenses` | `id` | `by_workspace`, `by_category` | Operating expense logs |
| `operation_journal` | `id` | `by_workspace`, `by_entity` | Strict idempotency ledger |
| `sync_queue` | `id` | `by_workspace`, `by_status` | Outbound mutation queue |
| `workspaces` | `id` | `by_slug` | Tenant configuration & settings |
| `audit_notes` | `id` | `by_workspace` | Stock check memos & physical audit logs |
| `cache_store` | `key` | None | Fast key-value document cache |

---

## 2. Idempotency & The Operation Journal (`operation_journal`)

When operating in poor network conditions or recovering from dropped connections, repeated sync attempts run the risk of double-posting sales or over-decrementing stock.

To make sync operations strictly idempotent:
1. Every local mutation enqueued has a unique cryptographically random UUID (`id`).
2. Before processing an item from the queue, `syncManager` inspects the `operation_journal` store:
   ```typescript
   const existingJournal = await db.get("operation_journal", item.id);
   if (existingJournal) {
     // Already acknowledged in cloud; update local queue to synced without repeating transaction
     item.status = "synced";
     item.syncedAt = existingJournal.appliedAt;
     return;
   }
   ```
3. Once cloud acknowledgment is received, the mutation ID is permanently written to `operation_journal`.
4. Any repeated sync loop or retry safely detects the journal entry and acknowledges immediately.

---

## 3. Conflict & Overselling Detection

In offline retail environments, multiple cash registers might sell the last units of the same SKU concurrently.
- If a sync mutation arrives at the server and finds insufficient inventory, the server rejects the decrement.
- The sync worker catches this response and transitions the item to `status: "conflict"`.
- `conflictDetails` is populated (e.g. `"Conflict: Product p1 was oversold concurrently by another register."`).
- The UI surfaces this immediately in the sync indicator widget so the manager can inspect and resolve the physical stock discrepancy.

---

## 4. Operation Lifecycle & Status Transitions

```
[Local User Action]
        |
        v
 [Saved to IndexedDB]
        |
        +---> status = "saved_locally" / "waiting_to_sync"
                    |
              (Network Online)
                    |
                    v
            status = "syncing"
                    |
      +-------------+-------------+
      |                           |
  (Success)                    (Error)
      |                           |
      v                           +---> Conflict (overselling): status = "conflict"
status = "synced"                 |
+ recorded in                     +---> Network Timeout: status = "failed"
  operation_journal                     (retry with backoff)
```

---

## 5. Server Acknowledgment Invariant

> **Non-Negotiable Rule**: An offline mutation is **never** marked `synced` until the remote Firestore/server endpoint explicitly returns a confirmation. Local optimistic states remain labeled as `waiting_to_sync` or `syncing`.
