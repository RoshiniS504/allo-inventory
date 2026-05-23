import type { Metadata } from "next";
import { DM_Sans, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Allo Health Inventory Reservation System",
  description: "Race-condition-free, idempotent inventory reservation system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen bg-[#F0F4F8] text-[#0F172A] font-sans antialiased relative">
        {/* Topbar */}
        <header className="fixed top-0 left-0 right-0 h-[56px] bg-white/85 backdrop-blur-[12px] border-b border-[#E1E8EF] z-50 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center text-[19px] font-display">
              <span className="font-extrabold text-[#0F6FBF] tracking-tight">allo</span>
              <span className="font-medium text-[#94A3B8] tracking-tight">health</span>
            </div>
            <div className="h-4 w-[1px] bg-[#E1E8EF] hidden sm:block"></div>
            <span className="text-[13px] font-semibold text-[#475569] tracking-medium hidden sm:block">
              Inventory
            </span>
          </div>
          <div className="flex items-center gap-2 bg-[#E6F8F5] border border-[#A7F3D0] rounded-full px-3 py-1 text-[#059669] text-xs font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00B89F] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00B89F] live-dot"></span>
            </span>
            <span>Live System</span>
          </div>
        </header>

        {/* Page Wrapper */}
        <div className="pt-20 pb-12 max-w-[1280px] mx-auto px-6 relative z-10">
          {children}
        </div>

        {/* Customized Toaster */}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "white",
              border: "1px solid #E1E8EF",
              borderRadius: "12px",
              boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
              fontFamily: "var(--font-inter), sans-serif",
              fontSize: "14px",
              color: "#0F172A",
            },
            duration: 4000,
          }}
        />
      </body>
    </html>
  );
}
