import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "../styles/app.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function NotFound() {
  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>404 — Page not found</h1>
    </div>
  );
}

const DESCRIPTION =
  "Monitor every GitHub Actions workflow run, manage secrets, and debug CI/CD failures — all in one clean dashboard.";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Gitvisor — GitHub Actions visibility, simplified" },
      { name: "description", content: DESCRIPTION },
      { name: "theme-color", content: "#09090b" },
      // Open Graph
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Gitvisor" },
      { property: "og:title", content: "Gitvisor — GitHub Actions visibility, simplified" },
      { property: "og:description", content: DESCRIPTION },
      // Twitter
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Gitvisor — GitHub Actions visibility, simplified" },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [
      // Classic favicon
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      // Modern PNG favicons
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/icon-16x16.png" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/icon-32x32.png" },
      { rel: "icon", type: "image/png", sizes: "48x48", href: "/icon-48x48.png" },
      // Apple touch icon (iOS home screen)
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      // PWA manifest
      { rel: "manifest", href: "/site.webmanifest" },
    ],
  }),
  notFoundComponent: NotFound,
  component: RootComponent,
});

function RootComponent() {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <Outlet />
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
