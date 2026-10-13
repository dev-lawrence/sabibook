import type { Metadata, Viewport } from "next";
import { Google_Sans } from "next/font/google";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";
import "./globals.css";

const googleSans = Google_Sans({
  variable: "--font-google-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  // Next has no metric overrides for Google Sans yet, so skip the fallback.
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "SabiBook",
  description: "Talk your sales. SabiBook writes them down and keeps track of who owes you.",
  applicationName: "SabiBook",
  appleWebApp: { capable: true, title: "SabiBook", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f7f0e1",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en" className={`${googleSans.variable} antialiased`}>
        <body>
          <ConvexClientProvider>{children}</ConvexClientProvider>
          <RegisterServiceWorker />
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
