import {
  createRootRoute,
  Outlet,
  ScrollRestoration,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NubeAuthProvider } from "@nube-auth/react";
import "../styles/app.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const nubeAuthConfig = {
  gatewayUrl: import.meta.env["VITE_NUBE_AUTH_GATEWAY_URL"] as string,
  appId: import.meta.env["VITE_NUBE_AUTH_APP_ID"] as string,
};

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <NubeAuthProvider config={nubeAuthConfig} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ScrollRestoration />
        <Outlet />
      </QueryClientProvider>
    </NubeAuthProvider>
  );
}
