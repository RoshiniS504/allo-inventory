import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        stock: {
          include: {
            product: true,
            warehouse: true,
          },
        },
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Reservation not found" },
        { status: 404 }
      );
    }

    const responseBody = {
      id: reservation.id,
      stockId: reservation.stockId,
      quantity: reservation.quantity,
      status: reservation.status,
      expiresAt: reservation.expiresAt.toISOString(),
      confirmedAt: reservation.confirmedAt ? reservation.confirmedAt.toISOString() : null,
      releasedAt: reservation.releasedAt ? reservation.releasedAt.toISOString() : null,
      idempotencyKey: reservation.idempotencyKey,
      createdAt: reservation.createdAt.toISOString(),
      productName: reservation.stock.product.name,
      warehouseName: reservation.stock.warehouse.name,
      sku: reservation.stock.product.sku,
    };

    return NextResponse.json(responseBody);
  } catch (error) {
    console.error("GET /api/reservations/[id] error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Something went wrong" },
      { status: 500 }
    );
  }
}
