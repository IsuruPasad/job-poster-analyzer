// Saltside API gateway (ikman.lk's core backend) — used server-side by the app-login BFF
// (lib/auth) and the location tree loader (lib/locations).
export const API_GATEWAY_URL = (process.env.API_GATEWAY_URL || "https://api.ikman.lk").replace(/\/+$/, "");
