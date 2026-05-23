'use client';

import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@radix-ui/react-dialog';
import { Button } from '@/src/components/ui/button';

export function ReservationDialog({
  productId,
  productName
}: {
  productId: number;
  productName: string;
}) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const warehouseId = 1; // TODO: wire real warehouses

  const payload = useMemo(
    () => ({
      productId,
      warehouseId,
      quantity,
      idempotencyKey: crypto.randomUUID()
    }),
    [productId, quantity]
  );

  async function handleReserve() {
    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data?.error ? 'Reservation failed' : 'Reservation failed');
      return;
    }

    // Redirect to checkout
    window.location.href = `/reservation/${data.reservationId}`;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default">Reserve</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reserve {productName}</DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-3">
          <div className="text-sm text-muted-foreground">Quantity</div>
          <input
            className="w-full rounded border px-3 py-2"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
          />

          <Button className="w-full" onClick={handleReserve}>
            Confirm Hold
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

