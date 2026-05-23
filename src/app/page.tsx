"use client";

import React, { useState, useEffect } from "react";
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

// Micro-interaction Component for Stock number scale animation
const AnimatedStockNumber = ({ value }: { value: number }) => {
  const [scale, setScale] = useState(false);

  useEffect(() => {
    setScale(true);
    const timeout = setTimeout(() => setScale(false), 300);
    return () => clearTimeout(timeout);
  }, [value]);

  return (
    <span
      className={`inline-block transition-all duration-300 ${
        scale ? "scale-[1.25] font-bold text-[#0F6FBF]" : "scale-100"
      }`}
    >
      {value}
    </span>
  );
};

// Skeleton Card for loading states
const SkeletonCard = () => (
  <div className="bg-white border border-[#E1E8EF] rounded-[16px] p-6 shadow-sm">
    <div className="flex justify-between items-center mb-4">
      <div className="h-5 w-20 skeleton" />
      <div className="h-8 w-8 rounded-full skeleton" />
    </div>
    <div className="h-5 w-3/4 skeleton mb-2" />
    <div className="h-4 w-5/6 skeleton mb-6" />
    <div className="h-[1px] bg-[#E1E8EF] mb-4" />
    <div className="space-y-3 mb-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex justify-between items-center">
          <div className="h-4 w-1/3 skeleton" />
          <div className="h-6 w-24 rounded-full skeleton" />
        </div>
      ))}
    </div>
    <div className="h-10 w-full rounded-[10px] skeleton" />
  </div>
);

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
    // Find the first warehouse with available stock, or fall back to the first warehouse
    const firstAvailableStock = product.stocks.find((s) => s.availableUnits > 0);
    setSelectedWarehouseId(firstAvailableStock ? firstAvailableStock.warehouseId : product.stocks[0]?.warehouseId || "");
    setQuantity(1);
    // Generate a fresh idempotency key
    setIdempotencyKey(crypto.randomUUID());
  };

  const handleCloseModal = () => {
    setSelectedProduct(null);
  };

  const handleReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

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
        mutate();
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

      // Success
      toast.success("Reserved!", {
        description: "You have 10 minutes to confirm.",
      });
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

  // Warehouse selection stock lookup helper
  const getSelectedWarehouseStock = () => {
    if (!selectedProduct || !selectedWarehouseId) return 0;
    const stock = selectedProduct.stocks.find(
      (s) => s.warehouseId === selectedWarehouseId
    );
    return stock ? stock.availableUnits : 0;
  };

  // Header content render helper
  const renderHero = () => (
    <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[#E1E8EF] pb-6 mb-8 gap-4">
      <div>
        <h1 className="text-[28px] font-bold font-display text-[#0F172A]">
          Available Products
        </h1>
        <p className="mt-1 text-sm text-[#475569]">
          Select a product to reserve stock from any warehouse.
        </p>
      </div>
      <div className="text-xs font-semibold text-[#94A3B8] tracking-wider self-start md:self-end">
        5 Products <span className="mx-1">·</span> 3 Warehouses <span className="mx-1">·</span> Live stock
      </div>
    </div>
  );

  // Colored circle icon lookup per product
  const getProductCircleIcon = (index: number, char: string) => {
    const presets = [
      { bg: "bg-[#EBF4FF]", text: "text-[#0F6FBF]" }, // Primary
      { bg: "bg-[#E6F8F5]", text: "text-[#00B89F]" }, // Accent
      { bg: "bg-[#FFFBEB]", text: "text-[#F59E0B]" }, // Warning
    ];
    const select = presets[index % presets.length];
    return (
      <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs ${select.bg} ${select.text}`}>
        {char}
      </div>
    );
  };

  if (isLoading) {
    return (
      <main className="container mx-auto max-w-7xl relative z-10">
        {renderHero()}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[20px]">
          {[...Array(6)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container mx-auto max-w-7xl relative z-10">
        {renderHero()}
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 bg-white border border-[#E1E8EF] rounded-[16px] p-8 max-w-lg mx-auto text-center shadow-sm">
          <div className="h-12 w-12 rounded-full bg-[#FEF2F2] flex items-center justify-center text-[#EF4444] mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <p className="text-[#0F172A] font-bold text-lg">Failed to load products</p>
          <p className="text-[#475569] text-sm">
            Check that the database is seeded and the API is reachable.
          </p>
          <Button onClick={() => mutate()} className="mt-2 bg-[#0F6FBF] hover:bg-[#0A5599] text-white">
            Retry Connection
          </Button>
        </div>
      </main>
    );
  }

  if (!products || products.length === 0) {
    return (
      <main className="container mx-auto max-w-7xl relative z-10">
        {renderHero()}
        <div className="flex flex-col items-center justify-center min-h-[300px] bg-white border border-[#E1E8EF] rounded-[16px] p-8 max-w-lg mx-auto text-center shadow-sm">
          <p className="text-[#475569] text-sm mb-4">
            No products found. Please seed your database.
          </p>
          <code className="bg-[#F7FAFB] text-[#0F172A] border border-[#E1E8EF] px-3 py-1.5 rounded-lg font-mono text-xs">
            npx prisma db seed
          </code>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-7xl relative z-10">
      {renderHero()}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[20px]">
        {products.map((product, idx) => {
          const hasStock = product.stocks.some((s) => s.availableUnits > 0);

          return (
            <Card
              key={product.id}
              className="bg-white border border-[#E1E8EF] rounded-[16px] p-6 shadow-sm hover:shadow-md hover:-translate-y-[2px] transition-all duration-200 flex flex-col fade-in-up group"
              style={{ animationDelay: `${idx * 0.07}s` }}
            >
              {/* Card topbar */}
              <div className="flex justify-between items-center mb-4">
                <span className="text-[11px] font-mono bg-[#F1F5F9] text-[#64748B] px-2 py-0.5 rounded-[4px] uppercase tracking-wider font-semibold border border-transparent">
                  {product.sku}
                </span>
                {getProductCircleIcon(idx, product.name.charAt(0))}
              </div>

              {/* Title and descriptions */}
              <div className="flex-1">
                <CardTitle className="text-[17px] font-bold font-display text-[#0F172A] mb-1">
                  {product.name}
                </CardTitle>
                <CardDescription className="text-[13px] text-[#475569] leading-relaxed line-clamp-2 mb-6">
                  {product.description}
                </CardDescription>
              </div>

              <div className="h-[1px] bg-[#E1E8EF] mb-4" />

              {/* Warehouse stock listings */}
              <div className="space-y-2.5 mb-6">
                {product.stocks.map((stock) => {
                  const isAvailable = stock.availableUnits > 5;
                  const isLow = stock.availableUnits > 0 && stock.availableUnits <= 5;
                  const isOut = stock.availableUnits === 0;

                  return (
                    <div
                      key={stock.id}
                      className="flex justify-between items-center text-[13px] text-[#475569] py-0.5"
                    >
                      <span className="font-medium text-[#475569]">
                        {stock.warehouse.name}{" "}
                        <span className="text-xs text-[#94A3B8] font-normal">
                          ({stock.warehouse.location})
                        </span>
                      </span>

                      {isAvailable && (
                        <span className="bg-[#E6F8F5] text-[#059669] border border-[#A7F3D0] rounded-[20px] px-2.5 py-0.5 text-xs font-semibold">
                          <AnimatedStockNumber value={stock.availableUnits} /> available
                        </span>
                      )}
                      {isLow && (
                        <span className="bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A] rounded-[20px] px-2.5 py-0.5 text-xs font-semibold">
                          <AnimatedStockNumber value={stock.availableUnits} /> left
                        </span>
                      )}
                      {isOut && (
                        <span className="bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA] rounded-[20px] px-2.5 py-0.5 text-xs font-semibold">
                          Out of stock
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action Button */}
              <Button
                onClick={() => handleOpenReserveModal(product)}
                className={`w-full h-10 rounded-[10px] text-sm font-semibold transition-all duration-200 border-none ${
                  hasStock
                    ? "bg-[#0F6FBF] hover:bg-[#0A5599] text-white hover:scale-[1.01]"
                    : "bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed"
                }`}
                disabled={!hasStock}
              >
                {hasStock ? "Reserve Stock" : "Unavailable"}
              </Button>
            </Card>
          );
        })}
      </div>

      {/* Reserve Product Modal */}
      <Dialog open={selectedProduct !== null} onOpenChange={handleCloseModal}>
        <DialogContent className="max-w-[440px] rounded-[20px] p-7 bg-white border border-[#E1E8EF]">
          <form onSubmit={handleReserve}>
            <DialogHeader className="mb-5">
              <DialogTitle className="text-xl font-bold font-display text-[#0F172A]">
                Reserve Stock
              </DialogTitle>
              <DialogDescription className="text-xs text-[#94A3B8] font-medium mt-1">
                {selectedProduct?.name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3">
              {/* Warehouse Selection */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="warehouse"
                  className="text-[13px] font-semibold text-[#475569]"
                >
                  Select Warehouse Location
                </label>
                <select
                  id="warehouse"
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  className="w-full bg-white border border-[#E1E8EF] rounded-[10px] h-[42px] px-3 text-sm text-[#0F172A] focus:outline-none focus:border-[#0F6FBF] focus:ring-4 focus:ring-[#0F6FBF]/10 transition-all duration-150"
                >
                  {selectedProduct?.stocks.map((stock) => (
                    <option
                      key={stock.warehouseId}
                      value={stock.warehouseId}
                      disabled={stock.availableUnits <= 0}
                    >
                      {stock.warehouse.name} ({stock.warehouse.location}) —{" "}
                      {stock.availableUnits} left
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="quantity"
                  className="text-[13px] font-semibold text-[#475569]"
                >
                  Quantity to Reserve
                </label>
                <input
                  id="quantity"
                  type="number"
                  min="1"
                  max={getSelectedWarehouseStock() || 1}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                  className="w-full bg-white border border-[#E1E8EF] rounded-[10px] h-[42px] px-3 text-sm text-[#0F172A] focus:outline-none focus:border-[#0F6FBF] focus:ring-4 focus:ring-[#0F6FBF]/10 transition-all duration-150"
                  required
                />
                <span className="text-xs text-[#94A3B8] font-medium mt-1">
                  {getSelectedWarehouseStock()} units available at this location
                </span>
              </div>
            </div>

            <DialogFooter className="mt-6 flex gap-3">
              <Button
                type="button"
                onClick={handleCloseModal}
                disabled={isSubmitting}
                className="bg-transparent border border-[#E1E8EF] text-[#475569] hover:bg-[#F7FAFB] rounded-[10px] h-11 text-sm font-semibold flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#0F6FBF] hover:bg-[#0A5599] text-white rounded-[10px] h-11 text-sm font-semibold flex-1 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner" />
                    <span>Reserving...</span>
                  </>
                ) : (
                  <span>Reserve Now</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
