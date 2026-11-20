function allowedApiOrigin(candidate, published, pageHost) {
  if (!candidate || typeof candidate !== "string") return "";
  let url;
  try {
    url = new URL(candidate);
  } catch {
    return "";
  }
  if (url.username || url.password) return "";
  if (url.protocol !== "https:" && url.protocol !== "http:") return "";
  const origin = url.origin;
  if (published) {
    try {
      if (origin === new URL(published).origin) return origin;
    } catch {
      return "";
    }
  }
  const localPage = pageHost === "localhost" || pageHost === "127.0.0.1";
  const localApi = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (localPage && localApi && url.protocol === "http:") return origin;
  return "";
}

function takeTicket(href) {
  const url = new URL(href);
  const ticket = url.searchParams.get("ticket") || "";
  url.searchParams.delete("ticket");
  return { ticket, href: `${url.pathname}${url.search}${url.hash}` };
}

module.exports = { allowedApiOrigin, takeTicket };
