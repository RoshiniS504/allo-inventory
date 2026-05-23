import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        stocks: {
          include: {
            warehouse: true,
            reservations: {
              where: {
                OR: [
                  { status: "CONFIRMED" },
                  {
                    status: "PENDING",
                    expiresAt: { gt: new Date() },
                  },
                ],
              },
            },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    const formattedProducts = products.map((product) => {
      const stocksWithAvailability = product.stocks.map((stock) => {
        const activeReservedUnits = stock.reservations.reduce(
          (sum, res) => sum + res.quantity,
          0
        );
        const availableUnits = Math.max(0, stock.totalUnits - activeReservedUnits);
        
        // Remove raw reservations array to avoid leaking details and keep payload clean
        const { reservations, ...stockDetails } = stock;
        return {
          ...stockDetails,
          availableUnits,
        };
      });

      return {
        ...product,
        stocks: stocksWithAvailability,
      };
    });

    return NextResponse.json(formattedProducts);
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Something went wrong" },
      { status: 500 }
    );
  }
}
