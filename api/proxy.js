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
  };
}

function resolveAbsoluteUrl(line, baseUrl) {
  try {
    // If already full
    if (/^https?:\/\//i.test(line)) return line;

    // Extract base directory from baseUrl (strip filename and query)
    const urlObj = new URL(baseUrl);
    const baseDir = urlObj.origin + urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf("/") + 1);

    // Combine baseDir + relative line manually
    return new URL(line, baseDir).href;
  } catch (e) {
    console.error("resolveAbsoluteUrl error:", e);
    return line;
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
    const upstream = await fetch(targetUrl, { headers });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      res.status(upstream.status).send(`Upstream error ${upstream.status}: ${text || upstream.statusText}`);
      return;
    }

    const contentType = upstream.headers.get("content-type") || "";

    // If playlist
    if (contentType.includes("mpegurl") || contentType.includes("vnd.apple.mpegurl")) {
      const bodyText = await upstream.text();

      const rewritten = bodyText
        .split(/\r?\n/)
        .map(line => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) return line;

          // Fix relative URLs
          const absUrl = resolveAbsoluteUrl(trimmed, targetUrl);

          // Rewrite through proxy again
          return `/api/proxy?url=${encodeURIComponent(absUrl)}`;
        })
        .join("\n");

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
      res.status(200).send(rewritten);
      return;
    }

    // Otherwise, stream binary data
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", contentType);
    const upstreamCache = upstream.headers.get("cache-control");
    if (upstreamCache) res.setHeader("Cache-Control", upstreamCache);

    const upstreamBody = upstream.body;
    if (!upstreamBody) {
      res.status(500).send("Upstream has no body");
      return;
    }

    upstreamBody.pipe(res);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).send("Proxy error: " + err.message);
  }
}
