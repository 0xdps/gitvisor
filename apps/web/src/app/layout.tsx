import type { Metadata } from "next";
import "./globals.css";
import "./carbon.scss";
import { Providers } from "./providers";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.gitvisor.dev";
const TITLE = "Gitvisor — GitHub Actions visibility, simplified";
const DESCRIPTION =
  "Monitor every GitHub Actions workflow run, manage secrets, and debug CI/CD failures — all in one clean dashboard.";

const SHARE_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: "Gitvisor",
} as const;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Gitvisor",
  authors: [{ name: "Gitvisor", url: SITE_URL }],
  creator: "Gitvisor",
  keywords: ["GitHub Actions", "CI", "CD", "secrets", "workflows", "Gitvisor"],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Gitvisor",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
    images: [SHARE_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    site: "@gitvisor",
    creator: "@gitvisor",
    title: TITLE,
    description: DESCRIPTION,
    images: [SHARE_IMAGE.url],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  manifest: "/site.webmanifest",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Gitvisor",
      url: SITE_URL,
      logo: `${SITE_URL}/icon-512x512.png`,
    },
    {
      "@type": "WebSite",
      name: "Gitvisor",
      url: SITE_URL,
      description: DESCRIPTION,
    },
    {
      "@type": "SoftwareApplication",
      name: "Gitvisor",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      url: SITE_URL,
      image: `${SITE_URL}/og.png`,
      description: DESCRIPTION,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="cds--g100">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
