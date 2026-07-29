// Vercel's query-param population for optional catch-all routes ([[...x]].js)
// isn't reliable outside a Next.js project, so derive segments from the raw
// request URL instead, which is unambiguous regardless of runtime quirks.
function pathSegments(req, prefix) {
  const pathname = req.url.split('?')[0];
  const trimmed = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;
  return trimmed.split('/').filter(Boolean).map(decodeURIComponent);
}

module.exports = { pathSegments };
