import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting database seed...");

  // 1. Seed Warehouses
  console.log("Seeding warehouses...");
  const mumbai = await prisma.warehouse.upsert({
    where: { id: "wh-mumbai" },
    update: {},
    create: {
      id: "wh-mumbai",
      name: "Mumbai",
      location: "Maharashtra",
    },
  });

  const delhi = await prisma.warehouse.upsert({
    where: { id: "wh-delhi" },
    update: {},
    create: {
      id: "wh-delhi",
      name: "Delhi",
      location: "Delhi NCR",
    },
  });

  const bangalore = await prisma.warehouse.upsert({
    where: { id: "wh-bangalore" },
    update: {},
    create: {
      id: "wh-bangalore",
      name: "Bangalore",
      location: "Karnataka",
    },
  });

  // 2. Seed Products
  console.log("Seeding products...");
  const productsData = [
    {
      id: "prod-sildenafil",
      name: "Sildenafil 50mg",
      sku: "SIL-050",
      description: "Erectile dysfunction treatment",
    },
    {
      id: "prod-tadalafil",
      name: "Tadalafil 20mg",
      sku: "TAD-020",
      description: "Long-acting ED treatment",
    },
    {
      id: "prod-finasteride",
      name: "Finasteride 1mg",
      sku: "FIN-001",
      description: "Hair loss prevention",
    },
    {
      id: "prod-minoxidil",
      name: "Minoxidil 5% Solution",
      sku: "MIN-005",
      description: "Topical hair regrowth",
    },
    {
      id: "prod-testosterone",
      name: "Testosterone Gel 1%",
      sku: "TES-001",
      description: "Hormone replacement therapy",
    },
  ];

  for (const p of productsData) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        name: p.name,
        description: p.description,
      },
      create: p,
    });
  }

  // 3. Seed Stock for every product × every warehouse
  console.log("Seeding stock records...");
  const stockData = [
    // Mumbai (wh-mumbai)
    { productId: "prod-sildenafil", warehouseId: "wh-mumbai", totalUnits: 50, reservedUnits: 2 },
    { productId: "prod-tadalafil", warehouseId: "wh-mumbai", totalUnits: 4, reservedUnits: 0 },
    { productId: "prod-finasteride", warehouseId: "wh-mumbai", totalUnits: 100, reservedUnits: 0 },
    { productId: "prod-minoxidil", warehouseId: "wh-mumbai", totalUnits: 0, reservedUnits: 0 },
    { productId: "prod-testosterone", warehouseId: "wh-mumbai", totalUnits: 12, reservedUnits: 0 },

    // Delhi (wh-delhi)
    { productId: "prod-sildenafil", warehouseId: "wh-delhi", totalUnits: 5, reservedUnits: 0 },
    { productId: "prod-tadalafil", warehouseId: "wh-delhi", totalUnits: 20, reservedUnits: 0 },
    { productId: "prod-finasteride", warehouseId: "wh-delhi", totalUnits: 2, reservedUnits: 0 },
    { productId: "prod-minoxidil", warehouseId: "wh-delhi", totalUnits: 45, reservedUnits: 0 },
    { productId: "prod-testosterone", warehouseId: "wh-delhi", totalUnits: 8, reservedUnits: 0 },

    // Bangalore (wh-bangalore)
    { productId: "prod-sildenafil", warehouseId: "wh-bangalore", totalUnits: 15, reservedUnits: 0 },
    { productId: "prod-tadalafil", warehouseId: "wh-bangalore", totalUnits: 0, reservedUnits: 0 },
    { productId: "prod-finasteride", warehouseId: "wh-bangalore", totalUnits: 75, reservedUnits: 0 },
    { productId: "prod-minoxidil", warehouseId: "wh-bangalore", totalUnits: 3, reservedUnits: 0 },
    { productId: "prod-testosterone", warehouseId: "wh-bangalore", totalUnits: 25, reservedUnits: 0 },
  ];

  for (const sd of stockData) {
    await prisma.stock.upsert({
      where: {
        productId_warehouseId: {
          productId: sd.productId,
          warehouseId: sd.warehouseId,
        },
      },
      update: {
        totalUnits: sd.totalUnits,
        reservedUnits: sd.reservedUnits,
      },
      create: sd,
    });
  }

  // 4. Seed 1 existing PENDING reservation expiring in 8 minutes
  console.log("Seeding initial pending reservation...");
  const sildenafilStockMumbai = await prisma.stock.findUnique({
    where: {
      productId_warehouseId: {
        productId: "prod-sildenafil",
        warehouseId: "wh-mumbai",
      },
    },
  });

  if (sildenafilStockMumbai) {
    await prisma.reservation.upsert({
      where: { id: "seed-pending-reservation" },
      update: {
        stockId: sildenafilStockMumbai.id,
        quantity: 2,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 8 * 60 * 1000), // expires in 8 minutes
      },
      create: {
        id: "seed-pending-reservation",
        stockId: sildenafilStockMumbai.id,
        quantity: 2,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 8 * 60 * 1000),
      },
    });
  }

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Error during database seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
