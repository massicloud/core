import type { Metadata } from "next";
import { type ReactNode } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/app/providers";
import { ConditionalShell } from "@/components/layout/conditional-shell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: {
    default: "MassiCloud Portal",
    template: "%s | MassiCloud Portal",
  },
  description:
    "Algerian sovereign cloud portal for managed Postgres, Redis, and object storage.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} dark`}>
      <body className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA] antialiased">
        <Providers>
          <ConditionalShell>{children}</ConditionalShell>
        </Providers>
      </body>
    </html>
  );
}
