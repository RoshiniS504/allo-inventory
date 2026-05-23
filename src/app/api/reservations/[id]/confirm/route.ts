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

    if (reservation.status !== "PENDING") {
      return NextResponse.json(
        { error: "INVALID_STATUS", message: "Reservation status is not PENDING" },
        { status: 400 }
      );
    }

    if (new Date(reservation.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: "RESERVATION_EXPIRED", message: "Reservation has expired" },
        { status: 410 }
      );
    }

    const updatedReservation = await prisma.reservation.update({
      where: { id },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
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
    console.error("POST /api/reservations/[id]/confirm error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Something went wrong" },
      { status: 500 }
    );
  }
}
