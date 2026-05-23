"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// Define TypeScript interfaces for our API response
interface Warehouse {
  id: string;
  name: string;
  location: string;
}

interface Stock {
  id: string;
  productId: string;
  warehouseId: string;
  totalUnits: number;
  reservedUnits: number;
  availableUnits: number;
  warehouse: Warehouse;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  description: string;
  stocks: Stock[];
}

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) {
    throw new Error("Failed to fetch data");
  }
  return res.json();
});

export default function HomePage() {
  const router = useRouter();
  const { data: products, error, isLoading, mutate } = useSWR<Product[]>(
    "/api/products",
    fetcher,
    { refreshInterval: 30000 }
  );

  // Modal and reservation state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");

  const handleOpenReserveModal = (product: Product) => {
    setSelectedProduct(product);
    // Default to first warehouse that has stock, or just first in list
    if (product.stocks.length > 0) {
      setSelectedWarehouseId(product.stocks[0].warehouseId);
    } else {
      setSelectedWarehouseId("");
    }
    setQuantity(1);
    // Generate a fresh idempotency key for this reservation attempt
    setIdempotencyKey(crypto.randomUUID());
  };

  const handleCloseModal = () => {
    setSelectedProduct(null);
  };

  const handleReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    // Client-side sanity checks
    if (!selectedWarehouseId) {
      toast.error("Please select a warehouse");
      return;
    }

    if (quantity <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          productId: selectedProduct.id,
          warehouseId: selectedWarehouseId,
          quantity,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        toast.error("Not enough stock available", {
          description: "Someone else just reserved the last units. Please try another warehouse.",
        });
        mutate(); // update cache
        handleCloseModal();
        return;
      }

      if (res.status === 410) {
        toast.error("Reservation expired", {
          description: "Your hold timed out. Please reserve again.",
        });
        handleCloseModal();
        return;
      }

      if (!res.ok) {
        toast.error("Something went wrong", {
          description: data.message ?? "Please try again.",
        });
        return;
      }

      // Success — navigate to checkout
      toast.success("Stock reserved successfully for 10 minutes!");
      handleCloseModal();
      mutate();
      router.push(`/reservation/${data.id}`);
    } catch (err) {
      console.error("Reservation request error:", err);
      toast.error("Network error", {
        description: "Check your connection and try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to color code badges based on availability
  const getBadgeVariant = (available: number) => {
    if (available > 5) return "success";
    if (available > 0) return "warning";
    return "error";
  };

  // SWR State Conditionals
  if (isLoading) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <header className="mb-10 text-center md:text-left flex flex-col md:flex-row md:items-end justify-between border-b border-slate-800 pb-6 gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-500">
              Allo Health
            </span>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
              Inventory Reservation System
            </h1>
            <p className="mt-2 text-slate-400">
              Race-condition-free real-time stock allocation and reservation checkout.
            </p>
          </div>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <header className="mb-10 text-center md:text-left flex flex-col md:flex-row md:items-end justify-between border-b border-slate-800 pb-6 gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-500">
              Allo Health
            </span>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
              Inventory Reservation System
            </h1>
          </div>
        </header>
        <div className="flex flex-col items-center justify-center min-h-64 gap-4 border border-rose-500/20 bg-rose-500/5 rounded-xl p-8 max-w-lg mx-auto text-center">
          <p className="text-rose-400 font-medium">Failed to load products</p>
          <p className="text-slate-400 text-sm">
            Check that the database is seeded and the API is reachable.
          </p>
          <Button onClick={() => mutate()} className="mt-2" variant="outline">
            Retry Connection
          </Button>
        </div>
      </main>
    );
  }

  if (!products || products.length === 0) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <header className="mb-10 text-center md:text-left flex flex-col md:flex-row md:items-end justify-between border-b border-slate-800 pb-6 gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-500">
              Allo Health
            </span>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
              Inventory Reservation System
            </h1>
          </div>
        </header>
        <div className="flex flex-col items-center justify-center min-h-64 border border-slate-800 bg-slate-900/30 rounded-xl p-8 max-w-lg mx-auto text-center">
          <p className="text-slate-400 text-sm">
            No products found. Run: <code className="bg-slate-950 text-slate-300 px-1.5 py-0.5 rounded font-mono">npx prisma db seed</code>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-7xl">
      <header className="mb-10 text-center md:text-left flex flex-col md:flex-row md:items-end justify-between border-b border-slate-800 pb-6 gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-500">
            Allo Health
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
            Inventory Reservation System
          </h1>
          <p className="mt-2 text-slate-400">
            Race-condition-free real-time stock allocation and reservation checkout.
          </p>
        </div>
        <div className="flex items-center gap-2 self-center md:self-end">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-xs text-slate-400 font-medium">Live monitoring active</span>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => {
          const hasStock = product.stocks.some((s) => s.availableUnits > 0);

          return (
            <Card key={product.id} className="flex flex-col hover:border-slate-700 transition duration-300 group">
              <CardHeader className="flex-1">
                <div className="flex justify-between items-start mb-2 gap-2">
                  <CardTitle className="text-xl font-bold group-hover:text-emerald-400 transition-colors">
                    {product.name}
                  </CardTitle>
                  <span className="text-[10px] font-mono bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700 uppercase shrink-0">
                    {product.sku}
                  </span>
                </div>
                <CardDescription className="line-clamp-2 min-h-[40px]">
                  {product.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="border-t border-slate-800/60 pt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                  Warehouse Stock Status
                </h4>
                <div className="space-y-2">
                  {product.stocks.map((stock) => (
                    <div
                      key={stock.id}
                      className="flex justify-between items-center bg-slate-950/40 p-2 rounded-lg border border-slate-800/40"
                    >
                      <span className="text-sm font-medium text-slate-300">
                        {stock.warehouse.name}{" "}
                        <span className="text-xs text-slate-500">
                          ({stock.warehouse.location})
                        </span>
                      </span>
                      <Badge variant={getBadgeVariant(stock.availableUnits)}>
                        {stock.availableUnits} units available
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="border-t border-slate-800/60 pt-4 bg-slate-900/10 rounded-b-xl">
                <Button
                  onClick={() => handleOpenReserveModal(product)}
                  className="w-full font-semibold transition"
                  variant={hasStock ? "default" : "outline"}
                  disabled={!hasStock}
                >
                  {hasStock ? "Reserve Product" : "Out of Stock"}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Reserve Product Modal */}
      <Dialog open={selectedProduct !== null} onOpenChange={handleCloseModal}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleReserve}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-50">
                Reserve {selectedProduct?.name}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Reserves stock for 10 minutes. If payment is completed within this window, the stock will be confirmed.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-6">
              {/* Warehouse Selection */}
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="warehouse"
                  className="text-sm font-semibold text-slate-300"
                >
                  Select Warehouse Location
                </label>
                <select
                  id="warehouse"
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {selectedProduct?.stocks.map((stock) => (
                    <option
                      key={stock.warehouseId}
                      value={stock.warehouseId}
                      disabled={stock.availableUnits <= 0}
                    >
                      {stock.warehouse.name} ({stock.warehouse.location}) —{" "}
                      {stock.availableUnits} units left
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="quantity"
                  className="text-sm font-semibold text-slate-300"
                >
                  Quantity to Reserve
                </label>
                <input
                  id="quantity"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseModal}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
              >
                {isSubmitting ? "Reserving..." : "Reserve Now"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
