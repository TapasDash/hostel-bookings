import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hostel Mail to Excel | OTA Reservation Sync",
  description: "Stateless Next.js app to extract hostel reservations from Gmail and export clean UTF-8 Excel files.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${geistMono.variable} font-sans bg-[#09090B] text-[#F8FAFC] antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
