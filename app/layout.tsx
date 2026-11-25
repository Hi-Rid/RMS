import type { Metadata, Viewport } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-archivo",
  display: "swap",
});

const jbmono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jbmono",
  display: "swap",
});

function resolveMetadataBase(): URL {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    "http://localhost:3000";

  const normalized = /^https?:\/\//i.test(raw)
    ? raw
    : /^localhost\b|^127\.0\.0\.1\b/i.test(raw)
      ? `http://${raw}`
      : `https://${raw}`;

  try {
    return new URL(normalized);
  } catch {
    return new URL("http://localhost:3000");
  }
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: { default: "RMS", template: "%s · RMS" },
  description: "Reference Management System.",
  applicationName: "RMS",
  appleWebApp: { capable: true, title: "RMS", statusBarStyle: "default" },
  openGraph: {
    type: "website",
    siteName: "RMS",
    title: "RMS — Reference Management System",
    description: "Reference Management System.",
  },
  twitter: {
    card: "summary_large_image",
    title: "RMS — Reference Management System",
    description: "Reference Management System.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#800115",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${archivo.variable} ${jbmono.variable}`}>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        {children}
        <Toaster position="top-center" theme="light" />
      </body>
    </html>
  );
}