import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Monday BI Agent",
  description: "Founder-level BI agent over Monday.com data"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}

