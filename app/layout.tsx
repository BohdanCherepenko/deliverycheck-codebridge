import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "DeliveryCheck",
  description:
    "Evidence-backed delivery checks from a text PDF and item-label photos.",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f4f6f2",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
