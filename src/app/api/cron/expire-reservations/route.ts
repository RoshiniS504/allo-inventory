import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();

    // Find all PENDING reservations where expiresAt < now()
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: "PENDING",
        expiresAt: {
          lt: now,
        },
      },
    });

    let expiredCount = 0;

    // For each in a transaction
    for (const reservation of expiredReservations) {
      await prisma.$transaction(async (tx) => {
        type StockRow = {
          id: string;
          reservedUnits: number;
        };

        const lockedStock = await tx.$queryRaw<StockRow[]>`
          SELECT id, "reservedUnits" FROM "Stock" WHERE id = ${reservation.stockId} FOR UPDATE
        `;
        const stockRow = lockedStock[0];

        if (stockRow) {
          const newReservedUnits = Math.max(0, stockRow.reservedUnits - reservation.quantity);
          await tx.stock.update({
            where: { id: reservation.stockId },
            data: {
              reservedUnits: newReservedUnits,
            },
          });
        }

        await tx.reservation.update({
          where: { id: reservation.id },
          data: {
            status: "RELEASED",
            releasedAt: now,
          },
        });
      });
      expiredCount++;
    }

    return NextResponse.json({ expired: expiredCount });
  } catch (error) {
    console.error("GET /api/cron/expire-reservations error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Something went wrong" },
      { status: 500 }
    );
  }
}
