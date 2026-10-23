# Offline-First Architecture & Synchronization Engine

Offline operation is a first-class citizen in **ShopLedger SaaS**. The architecture ensures merchants can continue checkout, record stock notes, and view records even when internet connectivity fluctuates.

---

## 1. Storage Layers

1. **Service Worker (`public/sw.js`)**:
   - Caches the core PWA application shell, HTML, scripts, stylesheets, and icons.
   - Provides stale-while-revalidate caching and offline route fallbacks.
2. **IndexedDB Local Database (`src/lib/offline/db.ts`)**:
   - High-capacity in-browser transactional database.
   - Object stores:
     - `workspaces`: Cached workspace metadata and tenant settings.
     - `sync_queue`: Ordered mutation log awaiting remote processing.
     - `audit_notes`: Non-financial operational memos, stock verification records.
     - `cache_store`: Fast key-value document cache.

---

## 2. The Idempotent Sync Queue (`src/lib/offline/sync-manager.ts`)

Every local mutation generates an idempotent operation record:

```typescript
export interface SyncQueueItem {
  id: string; // crypto.randomUUID()
  workspaceId: string;
  operation: 'create' | 'update' | 'delete';
  entityType: 'product' | 'customer' | 'sale' | 'purchase' | 'audit_note' | 'setting';
  entityId: string;
  payload: Record<string, unknown>;
  status: 'saved_locally' | 'waiting_to_sync' | 'syncing' | 'synced' | 'failed' | 'conflict';
  retryCount: number;
  lastAttempt?: number;
  error?: string;
  createdAt: number;
  syncedAt?: number;
}
```

### Operation Lifecycle:
1. **`saved_locally` / `waiting_to_sync`**: Written atomically to IndexedDB.
2. **`syncing`**: Connection detected; queue worker dispatches mutation.
3. **`synced`**: Remote server/Firestore responds with success acknowledgement.
4. **`failed`**: Network failure or validation error; retry counter increments with exponential backoff.
5. **`conflict`**: Version collision detected; flags record for resolution.

---

## 3. Server Acknowledgment Invariant

> **Critical Rule**: An offline mutation is **never** marked `synced` until the remote server/Firestore explicitly acknowledges processing. Local optimistic states remain labeled as `waiting_to_sync` or `syncing`.

---

## 4. Known Offline Limitations

- Real-time stock reservation across multiple concurrent devices requires online connectivity.
- Google OAuth login requires network access during the initial sign-in handshake.
- High-volume media uploads (large product photo albums) are deferred until a stable WiFi/cellular connection is restored.
