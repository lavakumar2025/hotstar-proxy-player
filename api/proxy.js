// api/proxy.js
import fetch from "node-fetch";

function buildForwardHeaders() {
  return {
    "Origin": "https://jio.yupptv.online",
    "Referer": "https://jio.yupptv.online/",
    "User-Agent": "Hotstar",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive",
    "Cookie": "" // present but empty per remote expectation
  };
}

// Helper: if a playlist line is a URL (not comment) -> resolve absolute URL
function resolveLineAsUrl(line, base) {
  try {
    // if already absolute
    return new URL(line).href;
  } catch {
    try {
      // resolve relative to base
      return new URL(line, base).href;
    } catch {
      return null;
    }
  }
}

export default async function handler(req, res) {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) {
      res.status(400).send("Missing url parameter");
      return;
    }

    const headers = buildForwardHeaders();

    // Fetch original resource
    const upstream = await fetch(targetUrl, { headers });

    // If upstream returned error, pass it
    if (!upstream.ok) {
      const text = await upstream.text().catch(()=>"");
      res.status(upstream.status).send(`Upstream error ${upstream.status}: ${text || upstream.statusText}`);
      return;
    }

    const contentType = upstream.headers.get("content-type") || "";

    // If playlist (m3u8), read text and rewrite URLs to point back to this proxy
    if (contentType.includes("mpegurl") || contentType.includes("vnd.apple.mpegurl") || contentType.includes("application/vnd.apple.mpegurl") || (await maybeIsM3U8(upstream))) {
      const bodyText = await upstream.text();
      // Split into lines and rewrite only those lines that look like URLs (not comments starting with # and not empty)
      const lines = bodyText.split(/\r?\n/);
      const rewritten = lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return line; // comment or empty: keep as is

        // resolve relative -> absolute using original targetUrl as base
        const absolute = resolveLineAsUrl(trimmed, targetUrl);
        if (!absolute) return line; // fallback

        // return proxied URL that calls this function again for that resource
        return `/api/proxy?url=${encodeURIComponent(absolute)}`;
      }).join("\n");

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
      // no-cache is helpful for live HLS
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
      res.status(200).send(rewritten);
      return;
    }

    // Otherwise treat as binary (TS, AAC, etc.) — pipe upstream body
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", contentType);
    // Preserve caching headers for segments if present
    const upstreamCache = upstream.headers.get("cache-control");
    if (upstreamCache) res.setHeader("Cache-Control", upstreamCache);

    // Stream binary body
    const upstreamBody = upstream.body;
    if (!upstreamBody) {
      res.status(500).send("Upstream has no body");
      return;
    }
    // pipe readable stream to Vercel response
    upstreamBody.pipe(res);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).send("Proxy error: " + err.message);
  }
}

// Helper to detect m3u8 if content-type is missing or generic
async function maybeIsM3U8(upstreamResponse) {
  try {
    // clone response not available; upstreamResponse may have been used. For safety, inspect content-type earlier.
    // If we get here, upstreamResponse body may be consumed; we return false.
    return false;
  } catch {
    return false;
  }
}
