import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

const DESCRIPTION =
  "Monitor every GitHub Actions workflow run, manage secrets, and debug CI/CD failures — all in one clean dashboard.";

export const metadata: Metadata = {
  title: "Gitvisor — GitHub Actions visibility, simplified",
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Gitvisor",
    title: "Gitvisor — GitHub Actions visibility, simplified",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: "Gitvisor — GitHub Actions visibility, simplified",
    description: DESCRIPTION,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-48x48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
