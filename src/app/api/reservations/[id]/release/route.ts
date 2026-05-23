import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Reservation not found" },
        { status: 404 }
      );
    }

    if (reservation.status !== "PENDING") {
      return NextResponse.json(
        { error: "INVALID_STATUS", message: "Reservation status is not PENDING" },
        { status: 400 }
      );
    }

    const updatedReservation = await prisma.$transaction(async (tx) => {
      // Lock the stock row to avoid concurrent race conditions during decrement
      type StockRow = {
        id: string;
        reservedUnits: number;
      };

      const lockedStock = await tx.$queryRaw<StockRow[]>`
        SELECT id, "reservedUnits" FROM "Stock" WHERE id = ${reservation.stockId} FOR UPDATE
      `;
      const stockRow = lockedStock[0];
      const newReservedUnits = stockRow 
        ? Math.max(0, stockRow.reservedUnits - reservation.quantity)
        : 0;

      if (stockRow) {
        await tx.stock.update({
          where: { id: reservation.stockId },
          data: {
            reservedUnits: newReservedUnits,
          },
        });
      }

      return tx.reservation.update({
        where: { id },
        data: {
          status: "RELEASED",
          releasedAt: new Date(),
        },
        include: {
          stock: {
            include: {
              product: true,
              warehouse: true,
            },
          },
        },
      });
    });

    const responseBody = {
      id: updatedReservation.id,
      stockId: updatedReservation.stockId,
      quantity: updatedReservation.quantity,
      status: updatedReservation.status,
      expiresAt: updatedReservation.expiresAt.toISOString(),
      confirmedAt: updatedReservation.confirmedAt ? updatedReservation.confirmedAt.toISOString() : null,
      releasedAt: updatedReservation.releasedAt ? updatedReservation.releasedAt.toISOString() : null,
      idempotencyKey: updatedReservation.idempotencyKey,
      createdAt: updatedReservation.createdAt.toISOString(),
      productName: updatedReservation.stock.product.name,
      warehouseName: updatedReservation.stock.warehouse.name,
      sku: updatedReservation.stock.product.sku,
    };

    return NextResponse.json(responseBody);
  } catch (error) {
    console.error("POST /api/reservations/[id]/release error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Something went wrong" },
      { status: 500 }
    );
  }
}
