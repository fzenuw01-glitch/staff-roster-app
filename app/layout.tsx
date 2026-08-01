import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export const metadata: Metadata = {
  title: "Pay & Sleep Management",
  description: "Operational maintenance, bookings and staff management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased bg-slate-100 text-slate-900`}
    >
      <body className="min-h-full flex flex-col selection:bg-indigo-500 selection:text-white">
        {/* Main wrapper optimized for full widescreen utilization while preventing extreme text stretching */}
        <div className="w-full min-h-screen flex flex-col mx-auto max-w-[1920px] bg-white shadow-sm">
          {children}
        </div>
      </body>
    </html>
  );
}