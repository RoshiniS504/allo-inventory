import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { ReserveSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const idempotencyKey = request.headers.get("Idempotency-Key");

  try {
    // Step 1 — Idempotency check (before any DB work)
    if (idempotencyKey) {
      const cached = await redis.get<{ body: unknown; status: number }>(
        `idempotency:${idempotencyKey}`
      );
      if (cached) {
        return NextResponse.json(cached.body, { status: cached.status });
      }
    }

    // Step 2 — Validate request body with Zod ReserveSchema
    const bodyText = await request.text();
    let jsonBody;
    try {
      jsonBody = JSON.parse(bodyText);
    } catch (e) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "Invalid JSON format" },
        { status: 400 }
      );
    }

    const validation = ReserveSchema.safeParse(jsonBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", issues: validation.error.issues },
        { status: 400 }
      );
    }

    const { productId, warehouseId, quantity } = validation.data;

    // Step 3 — Find the Stock record
    const stock = await prisma.stock.findUnique({
      where: {
        productId_warehouseId: {
          productId,
          warehouseId,
        },
      },
    });

    if (!stock) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Stock record not found" },
        { status: 404 }
      );
    }

    // Step 4 — CRITICAL: atomic transaction with row-level lock
    try {
      type StockRow = {
        id: string;
        productId: string;
        warehouseId: string;
        totalUnits: number;
        reservedUnits: number;
      };

      const reservation = await prisma.$transaction(async (tx) => {
        // Lock the exact stock row — second concurrent request blocks here
        // until first request commits, then re-reads the updated reservedUnits
        const lockedRows = await tx.$queryRaw<StockRow[]>`
          SELECT * FROM "Stock" WHERE id = ${stock.id} FOR UPDATE
        `;

        const locked = lockedRows[0];
        if (!locked) {
          throw Object.assign(new Error("STOCK_NOT_FOUND"), { code: "STOCK_NOT_FOUND" });
        }

        const available = locked.totalUnits - locked.reservedUnits;
        if (available < quantity) {
          throw Object.assign(new Error("INSUFFICIENT_STOCK"), { code: "INSUFFICIENT_STOCK" });
        }

        await tx.stock.update({
          where: { id: stock.id },
          data: {
            reservedUnits: {
              increment: quantity,
            },
          },
        });

        return tx.reservation.create({
          data: {
            stockId: stock.id,
            quantity,
            status: "PENDING",
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
            idempotencyKey: idempotencyKey ?? null,
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

      // Step 5 — Cache the response in Redis
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

      if (idempotencyKey) {
        await redis.set(
          `idempotency:${idempotencyKey}`,
          { body: responseBody, status: 201 },
          { ex: 86400 } // cache for 24 hours (86400 seconds)
        );
      }

      return NextResponse.json(responseBody, { status: 201 });
    } catch (txError: any) {
      if (txError.code === "INSUFFICIENT_STOCK") {
        const errorBody = {
          error: "INSUFFICIENT_STOCK",
          message: "Not enough units available",
        };
        if (idempotencyKey) {
          await redis.set(
            `idempotency:${idempotencyKey}`,
            { body: errorBody, status: 409 },
            { ex: 86400 }
          );
        }
        return NextResponse.json(errorBody, { status: 409 });
      }

      throw txError;
    }
  } catch (error: any) {
    console.error("POST /api/reservations error:", error);
    if (error.code === "STOCK_NOT_FOUND") {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Stock record not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Something went wrong" },
      { status: 500 }
    );
  }
}
