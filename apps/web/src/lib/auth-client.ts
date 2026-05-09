import { NubeAuthClient } from "@nube-auth/client";

export const nubeAuthClient = new NubeAuthClient({
  gatewayUrl: import.meta.env["VITE_NUBE_AUTH_GATEWAY_URL"] as string,
  appId: import.meta.env["VITE_NUBE_AUTH_APP_ID"] as string,
});
