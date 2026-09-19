import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Roopac Brief: enquiry to production brief",
  description:
    "Turns a messy customer enquiry into a grounded, evidence-backed Roopac job brief. Independent job-application prototype built from roopac.com's public site.",
};

export const viewport: Viewport = {
  themeColor: "#f9f6f1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-paper"
        >
          Skip to content
        </a>
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
