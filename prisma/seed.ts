import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create sample products
  await prisma.product.createMany({
    data: [
      { name: 'Widget A', price: 10.0 },
      { name: 'Widget B', price: 20.0 },
      { name: 'Gadget C', price: 15.5 },
    ],
    skipDuplicates: true,
  });

  // Create a warehouse
  await prisma.warehouse.createMany({
    data: [{ name: 'Main Warehouse' }],
    skipDuplicates: true,
  });

  // Populate inventory linking each product to the warehouse with an initial quantity
  const warehouses = await prisma.warehouse.findMany();
  const products = await prisma.product.findMany();

  for (const w of warehouses) {
    for (const p of products) {
      await prisma.inventory.create({
        data: {
          warehouseId: w.id,
          productId: p.id,
          quantity: 100,
        },
      });
    }
  }

  console.log('✅ Seed data has been inserted');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
