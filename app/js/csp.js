// Content-Security-Policy for index.html. connect-src lists only the providers a visitor key may reach.
export function buildCsp(providersJson) {
  const connect = ["'self'", ...providersJson.csp_connect_src].join(" ");
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src ${connect}`,
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
  ].join("; ");
}
