import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PortalAuthProvider } from "@/context/PortalAuthContext";
import { PortalPackageRedirect } from "@/components/PortalPackageRedirect";
import { CommandPalette } from "@/components/CommandPalette";
import { APP_NAME, SITE_URL, TAGLINE } from "@/lib/constants";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — Min Partner API`,
    template: `%s · ${APP_NAME}`,
  },
  description: `${TAGLINE} Official developer documentation and API explorer for the Min Partner API.`,
  metadataBase: new URL(SITE_URL),
  openGraph: {
    url: SITE_URL,
    siteName: APP_NAME,
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <PortalAuthProvider>
            <PortalPackageRedirect />
            {children}
            <CommandPalette />
          </PortalAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
