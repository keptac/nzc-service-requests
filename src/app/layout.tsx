import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SDA Service Request Tracker",
  description: "Approval workflow tracker for Seventh-day Adventist Church service requests"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
