"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

export default function ReservationPage({ params }: { params: { id: string } }) {
  const router = useRouter();

  const [reservation, setReservation] = useState<ReservationDetails | null>(null);
  const [localStatus, setLocalStatus] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [clientExpired, setClientExpired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch reservation details
  useEffect(() => {
    fetch(`/api/reservations/${params.id}`)
      .then((r) => {
        if (!r.ok) {
          if (r.status === 404) {
            toast.error("Reservation not found");
            router.push("/");
            return null;
          }
          throw new Error("Failed to fetch reservation");
        }
        return r.json();
      })
      .then((data) => {
        if (data) {
          setReservation(data);
          setLocalStatus(data.status);
          const remaining = Math.max(0, new Date(data.expiresAt).getTime() - Date.now());
          setTimeLeft(remaining);
          if (remaining === 0 && data.status === "PENDING") {
            setClientExpired(true);
            setLocalStatus("EXPIRED");
          }
        }
      })
      .catch((err) => {
        console.error("Error loading reservation details:", err);
        toast.error("Failed to load reservation details");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [params.id, router]);

  // Client-side countdown — do NOT wait for server to declare expiry
  useEffect(() => {
    if (localStatus !== "PENDING" || !reservation?.expiresAt) return;
    const tick = setInterval(() => {
      const remaining = Math.max(0, new Date(reservation.expiresAt).getTime() - Date.now());
      setTimeLeft(remaining);
      if (remaining === 0) {
        setClientExpired(true);
        setLocalStatus("EXPIRED");
        clearInterval(tick);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [localStatus, reservation?.expiresAt]);

  const handleConfirm = async () => {
    if (localStatus !== "PENDING" || clientExpired) return;
    setIsProcessing(true);

    try {
      const res = await fetch(`/api/reservations/${params.id}/confirm`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.status === 410) {
        toast.error("Reservation expired", {
          description: "Your 10-minute hold has expired.",
        });
        setClientExpired(true);
        setLocalStatus("EXPIRED");
        return;
      }

      if (!res.ok) {
        toast.error("Confirmation failed", { description: data.message });
        return;
      }

      toast.success("Purchase confirmed successfully!");
      setLocalStatus("CONFIRMED");
    } catch (err) {
      toast.error("Network error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRelease = async () => {
    if (localStatus !== "PENDING") return;
    setIsProcessing(true);

    try {
      const res = await fetch(`/api/reservations/${params.id}/release`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok) {
        toast.success("Reservation cancelled and stock released.");
        setLocalStatus("RELEASED");
      } else {
        toast.error("Cancellation failed", { description: data.message });
      }
    } catch (err) {
      toast.error("Network error");
    } finally {
      setIsProcessing(false);
    }
  };

  const displayStatus = clientExpired ? "EXPIRED" : localStatus;

  // Clock formatter helpers
  const mm = String(Math.floor(timeLeft / 60000)).padStart(2, "0");
  const ss = String(Math.floor((timeLeft % 60000) / 1000)).padStart(2, "0");
  
  // Expiry configuration values
  const isUrgent = timeLeft < 120000; // < 2 minutes (amber/red)
  const isCriticallyUrgent = timeLeft < 60000; // < 1 minute (red + pulsing)

  // Timer Color logic
  const getTimerColorClass = () => {
    if (isCriticallyUrgent) return "text-[#EF4444] urgency-pulse";
    if (isUrgent) return "text-[#F59E0B]";
    return "text-[#0F172A]";
  };

  const getProgressBarColor = () => {
    if (isCriticallyUrgent) return "bg-[#EF4444]";
    if (isUrgent) return "bg-[#F59E0B]";
    return "bg-[#00B89F]";
  };

  // Progress percentage (max hold time = 10 minutes = 600,000 ms)
  const progressPercent = Math.min(100, (timeLeft / 600000) * 100);

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-16 flex items-center justify-center min-h-[70vh]">
        <div className="max-w-[520px] w-full border border-[#E1E8EF] bg-white p-8 rounded-[20px] space-y-4 shadow-sm animate-pulse">
          <div className="h-6 w-1/3 bg-slate-100 rounded" />
          <div className="h-28 bg-slate-100 rounded" />
          <div className="h-10 bg-slate-100 rounded" />
        </div>
      </main>
    );
  }

  if (!reservation) {
    return (
      <main className="container mx-auto px-4 py-16 flex items-center justify-center min-h-[70vh]">
        <Card className="max-w-[520px] w-full border-[#EF4444] bg-white rounded-[20px] shadow-lg">
          <CardHeader className="p-8">
            <CardTitle className="text-[#EF4444] font-display text-xl font-bold">
              Reservation Not Found
            </CardTitle>
            <CardDescription className="text-[#475569] mt-2">
              The reservation code is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardFooter className="p-8 pt-0">
            <Button
              onClick={() => router.push("/")}
              className="w-full bg-[#0F6FBF] hover:bg-[#0A5599] text-white rounded-[10px] h-11"
            >
              Back to Catalog
            </Button>
          </CardFooter>
        </Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-[520px] px-4 sm:px-0 py-10">
      {/* Back button */}
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-1.5 text-sm font-semibold text-[#0F6FBF] hover:underline mb-6 transition"
      >
        <span>←</span> Back to products
      </button>

      {/* Reservation Checkout Card */}
      <Card className="bg-white border border-[#E1E8EF] rounded-[20px] p-8 shadow-md">
        
        {/* 1. Status Header */}
        <div className="w-full">
          {displayStatus === "PENDING" && (
            <div className="text-center py-2 px-4 rounded-[10px] font-semibold text-sm bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]">
              ⏱ Reservation Active
            </div>
          )}
          {displayStatus === "CONFIRMED" && (
            <div className="text-center py-2 px-4 rounded-[10px] font-semibold text-sm bg-[#E6F8F5] text-[#059669] border border-[#A7F3D0]">
              ✓ Purchase Confirmed
            </div>
          )}
          {displayStatus === "RELEASED" && (
            <div className="text-center py-2 px-4 rounded-[10px] font-semibold text-sm bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]">
              ○ Reservation Cancelled
            </div>
          )}
          {displayStatus === "EXPIRED" && (
            <div className="text-center py-2 px-4 rounded-[10px] font-semibold text-sm bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">
              ✕ Reservation Expired
            </div>
          )}
        </div>

        {/* Render States */}
        {displayStatus === "CONFIRMED" ? (
          /* 6. CONFIRMED STATE */
          <div className="flex flex-col items-center justify-center text-center py-8">
            <div className="h-16 w-16 rounded-full bg-[#E6F8F5] border border-[#A7F3D0] flex items-center justify-center text-[#00B89F] mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <h2 className="text-[22px] font-bold font-display text-[#0F172A]">
              Purchase confirmed!
            </h2>
            <p className="text-sm text-[#475569] mt-2 mb-8 max-w-sm">
              Your order has been placed successfully. Stock units have been securely locked.
            </p>
            <Button
              onClick={() => router.push("/")}
              className="w-full bg-[#0F6FBF] hover:bg-[#0A5599] text-white rounded-[10px] h-11 text-sm font-semibold"
            >
              Back to Products
            </Button>
          </div>
        ) : displayStatus === "RELEASED" || displayStatus === "EXPIRED" ? (
          /* 7. EXPIRED/RELEASED STATE */
          <div className="flex flex-col items-center justify-center text-center py-8">
            <div className={`h-16 w-16 rounded-full flex items-center justify-center mb-6 ${
              displayStatus === "EXPIRED" ? "bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626]" : "bg-[#F1F5F9] border border-[#E2E8F0] text-[#64748B]"
            }`}>
              {displayStatus === "EXPIRED" ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
                  <circle cx="12" cy="12" r="10"></circle>
                </svg>
              )}
            </div>
            <h2 className="text-[22px] font-bold font-display text-[#0F172A]">
              {displayStatus === "EXPIRED" ? "Reservation expired" : "Reservation cancelled"}
            </h2>
            <p className="text-sm text-[#475569] mt-2 mb-8 max-w-sm">
              {displayStatus === "EXPIRED" 
                ? "The 10-minute payment timer lapsed. Stock has been auto-released."
                : "The hold was cancelled and stock units have been returned to inventory."
              }
            </p>
            <Button
              onClick={() => router.push("/")}
              className="w-full bg-[#0F6FBF] hover:bg-[#0A5599] text-white rounded-[10px] h-11 text-sm font-semibold"
            >
              Start a new reservation
            </Button>
          </div>
        ) : (
          /* PENDING RESERVATION DETAILS */
          <>
            {/* 2. Product Info */}
            <div className="mt-6 mb-6">
              <h2 className="text-[22px] font-bold font-display text-[#0F172A]">
                {reservation.productName}
              </h2>
              <p className="font-mono text-xs text-[#94A3B8] mt-0.5 uppercase tracking-wider">
                SKU: {reservation.sku} <span className="mx-1.5">|</span> ID: {reservation.id}
              </p>

              {/* 2-Column Info Grid */}
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-[#F7FAFB] border border-[#E1E8EF] p-4 rounded-xl">
                  <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block">
                    Warehouse
                  </span>
                  <span className="text-sm font-bold text-[#475569] mt-1 block">
                    {reservation.warehouseName}
                  </span>
                </div>
                <div className="bg-[#F7FAFB] border border-[#E1E8EF] p-4 rounded-xl">
                  <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block">
                    Quantity
                  </span>
                  <span className="text-sm font-bold text-[#475569] mt-1 block">
                    {reservation.quantity} units
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Divider */}
            <div className="h-[1px] bg-[#E1E8EF] my-6" />

            {/* 4. Countdown Timer */}
            <div className="flex flex-col items-center justify-center py-4 mb-6">
              <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-1">
                Time remaining
              </span>
              
              <div 
                aria-live="polite" 
                className={`text-[48px] font-mono font-bold tracking-wider leading-none transition-colors duration-500 ${getTimerColorClass()}`}
              >
                {mm}:{ss}
              </div>

              {/* Smooth Progress Bar */}
              <div className="w-full h-1 bg-[#E1E8EF] rounded-full mt-5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 linear ${getProgressBarColor()}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* 5. Action Buttons */}
            <div className="flex flex-col gap-2.5">
              <Button
                onClick={handleConfirm}
                disabled={isProcessing || clientExpired}
                className="w-full h-12 bg-[#00B89F] hover:bg-[#009B85] text-white text-base font-semibold rounded-[12px] flex items-center justify-center gap-2 border-none shadow-[0_4px_12px_rgba(0,184,159,0.25)] hover:shadow-[0_6px_16px_rgba(0,184,159,0.35)] transition-all duration-150 hover:-translate-y-[1px]"
              >
                {isProcessing ? (
                  <span className="spinner" />
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>Confirm Purchase</span>
                  </>
                )}
              </Button>

              <Button
                onClick={handleRelease}
                disabled={isProcessing}
                className="w-full h-[42px] bg-transparent border border-[#E1E8EF] text-[#475569] hover:bg-[#FEF2F2] hover:border-[#FECACA] hover:text-[#DC2626] text-sm font-semibold rounded-[12px] transition-all duration-150"
              >
                Cancel Reservation
              </Button>
            </div>
          </>
        )}
      </Card>
    </main>
  );
}
