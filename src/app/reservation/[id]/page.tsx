"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ReservationDetails {
  id: string;
  stockId: string;
  quantity: number;
  status: "PENDING" | "CONFIRMED" | "RELEASED";
  expiresAt: string;
  confirmedAt: string | null;
  releasedAt: string | null;
  idempotencyKey: string | null;
  createdAt: string;
  productName: string;
  warehouseName: string;
  sku: string;
}

export default function ReservationPage() {
  const { id } = useParams();
  const router = useRouter();

  const [reservation, setReservation] = useState<ReservationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"PENDING" | "CONFIRMED" | "RELEASED">("PENDING");
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [clientExpired, setClientExpired] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch reservation details on load
  useEffect(() => {
    async function fetchReservation() {
      try {
        const response = await fetch(`/api/reservations/${id}`);
        if (!response.ok) {
          if (response.status === 404) {
            toast.error("Reservation not found");
            router.push("/");
            return;
          }
          throw new Error("Failed to fetch reservation");
        }
        const data = await response.json();
        setReservation(data);
        setStatus(data.status);

        // Calculate initial remaining time
        const remaining = Math.max(0, new Date(data.expiresAt).getTime() - Date.now());
        setTimeLeft(remaining);

        if (remaining <= 0 && data.status === "PENDING") {
          setClientExpired(true);
        }
      } catch (err) {
        console.error("Error fetching reservation:", err);
        toast.error("Failed to load reservation details");
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchReservation();
    }
  }, [id, router]);

  // Countdown timer effect
  useEffect(() => {
    if (status !== "PENDING" || clientExpired) return;

    const interval = setInterval(() => {
      if (!reservation) return;
      const remaining = Math.max(0, new Date(reservation.expiresAt).getTime() - Date.now());
      setTimeLeft(remaining);

      if (remaining === 0) {
        setClientExpired(true);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [reservation, status, clientExpired]);

  // Formatter helper for MM:SS
  const formatTimeLeft = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleConfirm = async () => {
    if (status !== "PENDING" || clientExpired) return;
    setIsProcessing(true);

    try {
      const response = await fetch(`/api/reservations/${id}/confirm`, {
        method: "POST",
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Purchase confirmed successfully!");
        setStatus("CONFIRMED");
      } else if (response.status === 410) {
        toast.error("Reservation has expired");
        setClientExpired(true);
      } else {
        toast.error(data.message || "Failed to confirm reservation");
      }
    } catch (err) {
      console.error("Confirm error:", err);
      toast.error("An error occurred during confirmation.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRelease = async () => {
    if (status !== "PENDING") return;
    setIsProcessing(true);

    try {
      const response = await fetch(`/api/reservations/${id}/release`, {
        method: "POST",
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Reservation cancelled and stock released.");
        setStatus("RELEASED");
      } else {
        toast.error(data.message || "Failed to cancel reservation");
      }
    } catch (err) {
      console.error("Release error:", err);
      toast.error("An error occurred while releasing the reservation.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Determine current effective UI state
  // LOADING, PENDING, CONFIRMED, RELEASED, EXPIRED
  const isPending = status === "PENDING" && !clientExpired;
  const isConfirmed = status === "CONFIRMED";
  const isReleased = status === "RELEASED";
  const isExpired = clientExpired || (status === "PENDING" && timeLeft <= 0);

  const isUrgent = isPending && timeLeft < 120000; // < 2 minutes (120,000 ms)

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-16 flex items-center justify-center min-h-[70vh]">
        <div className="max-w-md w-full border border-slate-800 bg-slate-900/30 p-8 rounded-xl space-y-4 animate-pulse">
          <div className="h-6 w-1/3 bg-slate-800 rounded"></div>
          <div className="h-24 bg-slate-800 rounded"></div>
          <div className="h-10 bg-slate-800 rounded"></div>
        </div>
      </main>
    );
  }

  if (!reservation) {
    return (
      <main className="container mx-auto px-4 py-16 flex items-center justify-center min-h-[70vh]">
        <Card className="max-w-md w-full border-rose-950 bg-rose-950/15">
          <CardHeader>
            <CardTitle className="text-rose-400">Reservation Not Found</CardTitle>
          </CardHeader>
          <CardContent className="text-slate-300">
            The reservation code is invalid or has been permanently removed.
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push("/")} className="w-full">
              Back to Catalog
            </Button>
          </CardFooter>
        </Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[85vh]">
      <div className="max-w-xl w-full">
        {/* Status indicator banner */}
        {isConfirmed && (
          <div className="mb-6 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-bold text-sm">Purchase Confirmed</p>
              <p className="text-xs text-slate-300">Your inventory reservation has been locked permanently.</p>
            </div>
          </div>
        )}

        {isReleased && (
          <div className="mb-6 p-4 rounded-xl border border-slate-700 bg-slate-800/20 text-slate-400 flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-bold text-sm text-slate-300">Reservation Cancelled</p>
              <p className="text-xs text-slate-500">Hold released. Inventory units returned to general warehouse stock.</p>
            </div>
          </div>
        )}

        {isExpired && (
          <div className="mb-6 p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-bold text-sm">Reservation Expired</p>
              <p className="text-xs text-slate-300">The 10-minute payment timer lapsed. Stock has been auto-released.</p>
            </div>
          </div>
        )}

        {isPending && (
          <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
              <div>
                <p className="font-bold text-sm">Payment Holding Period</p>
                <p className="text-xs text-slate-300">Complete checkout before expiration to secure your order.</p>
              </div>
            </div>
            <div className={`text-2xl font-mono font-extrabold px-3 py-1 bg-slate-950/80 border rounded-lg shrink-0 ${isUrgent ? "text-rose-500 border-rose-500/50 animate-pulse" : "text-amber-400 border-amber-500/30"}`}>
              {formatTimeLeft(timeLeft)}
            </div>
          </div>
        )}

        {/* Detailed Reservation Summary */}
        <Card className="border-slate-800 bg-slate-900/40 shadow-2xl overflow-hidden">
          <CardHeader className="bg-slate-950/30 border-b border-slate-800/60 pb-6">
            <div className="flex justify-between items-center gap-2">
              <span className="text-xs font-semibold text-emerald-500 uppercase tracking-wider">
                Hold Transaction Summary
              </span>
              <Badge variant={isConfirmed ? "success" : isReleased ? "secondary" : isExpired ? "destructive" : "warning"}>
                {isConfirmed ? "Confirmed" : isReleased ? "Released" : isExpired ? "Expired" : "Pending Hold"}
              </Badge>
            </div>
            <CardTitle className="text-2xl font-bold mt-2 text-slate-50">
              {reservation.productName}
            </CardTitle>
            <CardDescription className="font-mono text-xs uppercase text-slate-400 mt-1">
              SKU: {reservation.sku} | Reservation ID: {reservation.id}
            </CardDescription>
          </CardHeader>

          <CardContent className="py-6 space-y-4">
            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-950/35 p-3 rounded-lg border border-slate-800/40">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Warehouse</p>
                <p className="text-sm font-bold text-slate-200 mt-1">{reservation.warehouseName}</p>
              </div>
              <div className="bg-slate-950/35 p-3 rounded-lg border border-slate-800/40">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Quantity Reserved</p>
                <p className="text-sm font-bold text-slate-200 mt-1">{reservation.quantity} units</p>
              </div>
            </div>

            {/* Timestamps */}
            <div className="space-y-2 pt-2 text-xs border-t border-slate-800/40 text-slate-400">
              <div className="flex justify-between">
                <span>Hold Created:</span>
                <span className="font-mono text-slate-300">{new Date(reservation.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Hold Expiration:</span>
                <span className="font-mono text-slate-300">{new Date(reservation.expiresAt).toLocaleString()}</span>
              </div>
              {reservation.confirmedAt && (
                <div className="flex justify-between text-emerald-400">
                  <span>Payment Confirmed:</span>
                  <span className="font-mono">{new Date(reservation.confirmedAt).toLocaleString()}</span>
                </div>
              )}
              {reservation.releasedAt && (
                <div className="flex justify-between text-slate-300">
                  <span>Released At:</span>
                  <span className="font-mono">{new Date(reservation.releasedAt).toLocaleString()}</span>
                </div>
              )}
              {reservation.idempotencyKey && (
                <div className="flex justify-between pt-2 border-t border-dashed border-slate-800/50">
                  <span>Idempotency Key:</span>
                  <span className="font-mono text-[10px] break-all max-w-[250px]">{reservation.idempotencyKey}</span>
                </div>
              )}
            </div>
          </CardContent>

          <CardFooter className="bg-slate-950/30 border-t border-slate-800/60 p-6 flex flex-col sm:flex-row gap-3">
            {isPending ? (
              <>
                <Button
                  onClick={handleRelease}
                  disabled={isProcessing}
                  variant="outline"
                  className="w-full sm:flex-1 border-slate-800 text-slate-300 hover:bg-slate-850"
                >
                  Cancel Hold
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={isProcessing}
                  className="w-full sm:flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  {isProcessing ? "Processing..." : "Confirm & Pay"}
                </Button>
              </>
            ) : (
              <Button
                onClick={() => router.push("/")}
                className="w-full bg-slate-850 border border-slate-800 text-slate-300 hover:bg-slate-800"
              >
                Back to Catalog
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
