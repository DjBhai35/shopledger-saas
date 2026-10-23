import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { syncManager } from "@/lib/offline/sync-manager";
import { getLocalDB, resetDBConnection } from "@/lib/offline/db";
import { OperationJournalRecord } from "@/types";

describe("Offline Engine: Operation Journal & Conflict Detection", () => {
  const wsId = "ws_offline_journal_test";

  beforeEach(() => {
    resetDBConnection();
    syncManager.setOnlineStatusForTesting(null);
  });

  it("should enforce idempotency: skip re-execution if operation ID already exists in Operation Journal", async () => {
    const db = await getLocalDB();
    syncManager.setOnlineStatusForTesting(true);

    const opId = "op_idempotency_123";

    // Pre-seed Operation Journal with this operation ID
    const journalRecord: OperationJournalRecord = {
      id: opId,
      workspaceId: wsId,
      entityType: "sale",
      entityId: "sale_001",
      appliedAt: Date.now() - 5000,
      appliedByUid: "system_sync",
    };
    await db.put("operation_journal", journalRecord);

    // Enqueue an operation with the same ID
    await db.put("sync_queue", {
      id: opId,
      workspaceId: wsId,
      operation: "create",
      entityType: "sale",
      entityId: "sale_001",
      payload: { total: 100 },
      status: "waiting_to_sync",
      retryCount: 0,
      createdAt: Date.now(),
    });

    let serverCallCount = 0;
    const mockExecutor = async () => {
      serverCallCount++;
      return true;
    };

    const result = await syncManager.processQueue(wsId, mockExecutor);

    // It should succeed because it was journaled, but serverCallCount should remain 0!
    expect(result.succeeded).toBe(1);
    expect(serverCallCount).toBe(0);

    const queueItem = await db.get("sync_queue", opId);
    expect(queueItem?.status).toBe("synced");
    expect(queueItem?.syncedAt).toBe(journalRecord.appliedAt);
  });

  it("should record operation into Operation Journal upon successful synchronization", async () => {
    const db = await getLocalDB();
    syncManager.setOnlineStatusForTesting(false);

    const op = await syncManager.enqueueOperation({
      workspaceId: wsId,
      operation: "create",
      entityType: "product",
      entityId: "prod_journal_test",
      payload: { name: "Audit Cable", cost: 10 },
    });

    // Verify it is not yet in journal
    let journal = await db.get("operation_journal", op.id);
    expect(journal).toBeUndefined();

    // Now go online and sync
    syncManager.setOnlineStatusForTesting(true);
    let serverCalled = false;
    const mockExecutor = async () => {
      serverCalled = true;
      return true;
    };

    const res = await syncManager.processQueue(wsId, mockExecutor);
    expect(res.succeeded).toBe(1);
    expect(serverCalled).toBe(true);

    // Verify it is now persisted in Operation Journal
    journal = await db.get("operation_journal", op.id);
    expect(journal).toBeDefined();
    expect(journal?.id).toBe(op.id);
    expect(journal?.workspaceId).toBe(wsId);
  });

  it("should transition item status to 'conflict' when server reports inventory overselling conflict", async () => {
    const db = await getLocalDB();
    syncManager.setOnlineStatusForTesting(false);

    const op = await syncManager.enqueueOperation({
      workspaceId: wsId,
      operation: "create",
      entityType: "sale",
      entityId: "sale_conflict_999",
      payload: { items: [{ productId: "p1", qty: 5 }] },
    });

    syncManager.setOnlineStatusForTesting(true);

    // Mock executor throws an oversold conflict error
    const mockConflictExecutor = async () => {
      throw new Error("Conflict: Product p1 was oversold concurrently by another register.");
    };

    const res = await syncManager.processQueue(wsId, mockConflictExecutor);
    expect(res.conflicts).toBe(1);
    expect(res.failed).toBe(0);

    const updated = await db.get("sync_queue", op.id);
    expect(updated?.status).toBe("conflict");
    expect(updated?.conflictDetails).toContain("oversold concurrently");

    // Check queue summary reports conflict count
    const summary = await syncManager.getQueueSummary(wsId);
    expect(summary.conflict).toBe(1);
  });
});
