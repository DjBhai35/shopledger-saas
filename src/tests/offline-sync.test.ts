import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { syncManager } from "@/lib/offline/sync-manager";
import { getLocalDB, resetDBConnection } from "@/lib/offline/db";

describe("Offline Sync & IndexedDB Storage Engine", () => {
  const testWorkspaceId = "ws_test_tenant_999";

  beforeEach(async () => {
    resetDBConnection();
    syncManager.setOnlineStatusForTesting(null);
  });

  it("should generate collision-resistant unique operation UUIDs", () => {
    const id1 = syncManager.generateOperationId();
    const id2 = syncManager.generateOperationId();
    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);
  });

  it("should enqueue operation with status 'waiting_to_sync'", async () => {
    syncManager.setOnlineStatusForTesting(false); // keep offline to prevent immediate auto-sync

    const op = await syncManager.enqueueOperation({
      workspaceId: testWorkspaceId,
      operation: "create",
      entityType: "audit_note",
      entityId: "note_101",
      payload: { title: "Stock verification", itemsCount: 42 },
    });

    expect(op.id).toBeDefined();
    expect(op.workspaceId).toBe(testWorkspaceId);
    expect(op.status).toBe("waiting_to_sync");
    expect(op.retryCount).toBe(0);

    const pending = await syncManager.getPendingItems(testWorkspaceId);
    expect(pending.some((p) => p.id === op.id)).toBe(true);
  });

  it("should compute accurate queue summaries", async () => {
    syncManager.setOnlineStatusForTesting(false);
    const summary = await syncManager.getQueueSummary(testWorkspaceId);
    expect(summary.total).toBeGreaterThanOrEqual(1);
    expect(summary.waiting).toBeGreaterThanOrEqual(1);
    expect(summary.isOnline).toBe(false);
  });

  it("should process queue and transition to 'synced' upon server acknowledgment", async () => {
    syncManager.setOnlineStatusForTesting(true);

    // Provide mock server executor that confirms sync
    const acknowledgedItems: string[] = [];
    const mockServerExecutor = async (item: { id: string }) => {
      acknowledgedItems.push(item.id);
      return true; // Server confirms receipt
    };

    const result = await syncManager.processQueue(testWorkspaceId, mockServerExecutor);
    expect(result.processed).toBeGreaterThanOrEqual(1);
    expect(result.succeeded).toBeGreaterThanOrEqual(1);
    expect(result.failed).toBe(0);

    const allItems = await syncManager.getAllQueueItems(testWorkspaceId);
    const syncedItem = allItems.find((i) => acknowledgedItems.includes(i.id));
    expect(syncedItem?.status).toBe("synced");
    expect(syncedItem?.syncedAt).toBeDefined();
  });

  it("should mark operation as 'failed' and increment retryCount if server fails", async () => {
    syncManager.setOnlineStatusForTesting(false);

    // Enqueue an operation
    const op = await syncManager.enqueueOperation({
      workspaceId: testWorkspaceId,
      operation: "update",
      entityType: "product",
      entityId: "prod_1",
      payload: { price: 150 },
    });

    syncManager.setOnlineStatusForTesting(true);

    // Mock server executor that rejects / throws
    const mockFailingExecutor = async () => {
      throw new Error("Simulated network timeout 503");
    };

    const result = await syncManager.processQueue(testWorkspaceId, mockFailingExecutor);
    expect(result.failed).toBeGreaterThanOrEqual(1);

    const allItems = await syncManager.getAllQueueItems(testWorkspaceId);
    const failedItem = allItems.find((i) => i.id === op.id);
    expect(failedItem?.status).toBe("failed");
    expect(failedItem?.retryCount).toBeGreaterThanOrEqual(1);
    expect(failedItem?.error).toContain("Simulated network timeout");
  });

  it("should persist local non-financial audit note into IndexedDB and queue", async () => {
    const note = await syncManager.saveLocalAuditNote({
      workspaceId: testWorkspaceId,
      title: "Physical Shelf Audit Note",
      content: "Verified 20 items in shelf B. All sealed.",
      authorUid: "user_test_42",
      authorEmail: "auditor@shop.local",
    });

    expect(note.id).toBeDefined();
    expect(note.title).toBe("Physical Shelf Audit Note");

    const notes = await syncManager.getAuditNotes(testWorkspaceId);
    expect(notes.some((n) => n.id === note.id)).toBe(true);
  });
});
