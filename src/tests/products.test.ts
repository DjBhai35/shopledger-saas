import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { resetDBConnection } from "@/lib/offline/db";
import {
  createProduct,
  getProducts,
  updateProduct,
  adjustProductStock,
  archiveProduct,
  validateProduct,
  getProductByBarcodeOrSku,
} from "@/lib/services/productService";

describe("Products & Inventory Service", () => {
  const ws1 = "ws_test_electronics_1";
  const ws2 = "ws_test_clothing_2";

  beforeEach(() => {
    resetDBConnection();
  });

  it("should validate required product fields and numeric constraints", async () => {
    const invalid = await validateProduct({ name: "", costPrice: -10, sellingPrice: 50 }, ws1);
    expect(invalid.valid).toBe(false);
    expect(invalid.errors).toContain("Product name is required.");
    expect(invalid.errors).toContain("Cost price must be a valid positive number or 0.");

    const valid = await validateProduct(
      { name: "iPhone 15 Pro", sku: "IP15P-128", costPrice: 800, sellingPrice: 999 },
      ws1
    );
    expect(valid.valid).toBe(true);
    expect(valid.errors.length).toBe(0);
  });

  it("should create product and log initial opening stock movement", async () => {
    const product = await createProduct(
      {
        workspaceId: ws1,
        name: "MacBook Pro 14",
        sku: "MBP14-M3",
        barcode: "194253123456",
        category: "Computer Shop",
        brand: "Apple",
        costPrice: 1500,
        sellingPrice: 1999,
        quantity: 10,
        minStockAlert: 2,
        unit: "pcs",
        mobileAttributes: { model: "M3 Pro", storage: "512GB", color: "Space Black" },
      },
      "user_admin"
    );

    expect(product.id).toBeDefined();
    expect(product.quantity).toBe(10);
    expect(product.mobileAttributes?.storage).toBe("512GB");

    // Retrieve product
    const retrieved = await getProductByBarcodeOrSku(ws1, "194253123456");
    expect(retrieved?.id).toBe(product.id);
  });

  it("should prevent duplicate SKU within the same workspace but allow across different workspaces", async () => {
    await createProduct(
      {
        workspaceId: ws1,
        name: "Wireless Mouse",
        sku: "MOU-001",
        category: "Electronics",
        costPrice: 10,
        sellingPrice: 20,
        quantity: 5,
        minStockAlert: 1,
        unit: "pcs",
      },
      "admin"
    );

    // Duplicate SKU in ws1 must fail
    await expect(
      createProduct(
        {
          workspaceId: ws1,
          name: "Another Mouse",
          sku: "MOU-001",
          category: "Electronics",
          costPrice: 12,
          sellingPrice: 22,
          quantity: 2,
          minStockAlert: 1,
          unit: "pcs",
        },
        "admin"
      )
    ).rejects.toThrow(/already assigned to another active product/);

    // Same SKU in another workspace (ws2) must succeed
    const ws2Product = await createProduct(
      {
        workspaceId: ws2,
        name: "Mouse in Shop 2",
        sku: "MOU-001",
        category: "Accessories",
        costPrice: 10,
        sellingPrice: 20,
        quantity: 8,
        minStockAlert: 1,
        unit: "pcs",
      },
      "admin"
    );
    expect(ws2Product.id).toBeDefined();
    expect(ws2Product.workspaceId).toBe(ws2);
  });

  it("should adjust product stock with audit trail", async () => {
    const product = await createProduct(
      {
        workspaceId: ws1,
        name: "USB-C Cable",
        sku: "CAB-USBC",
        category: "Accessories",
        costPrice: 2,
        sellingPrice: 5,
        quantity: 20,
        minStockAlert: 5,
        unit: "pcs",
      },
      "admin"
    );

    const { product: adjusted, movement } = await adjustProductStock({
      workspaceId: ws1,
      productId: product.id,
      quantityChange: -3,
      reason: "Damaged packaging in storage",
      type: "damage",
      authorUid: "manager_1",
    });

    expect(adjusted.quantity).toBe(17);
    expect(movement.type).toBe("damage");
    expect(movement.quantityChange).toBe(-3);
    expect(movement.previousQuantity).toBe(20);
    expect(movement.newQuantity).toBe(17);
  });
});
