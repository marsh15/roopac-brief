import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Roopac Brief — enquiry to production brief",
  description:
    "Turns a messy customer enquiry into a grounded, evidence-backed Roopac job brief. Independent job-application prototype built from roopac.com's public site.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
