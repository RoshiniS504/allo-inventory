import { prisma } from '@/src/lib/prisma';

export type ProductWithAvailability = {
  id: number;
  name: string;
  price: number;
  availableQty: number;
};

export async function getProducts(): Promise<ProductWithAvailability[]> {
  const products = await prisma.product.findMany({
    select: { id: true, name: true, price: true, inventories: { select: { quantity: true } } }
  });

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    availableQty: p.inventories.reduce((sum, inv) => sum + inv.quantity, 0)
  }));
}

