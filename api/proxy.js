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
    "Cookie": ""
  };
}

function resolveAbsoluteUrl(line, baseUrl) {
  try {
    // If already absolute
    if (/^https?:\/\//i.test(line)) return line;
    // Otherwise resolve relative
    return new URL(line, baseUrl).href;
  } catch {
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

    // --- Handle M3U8 Playlist ---
    if (contentType.includes("mpegurl") || contentType.includes("vnd.apple.mpegurl")) {
      const bodyText = await upstream.text();
      const baseUrl = targetUrl;

      const rewritten = bodyText
        .split(/\r?\n/)
        .map(line => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) return line;

          // Convert relative to absolute
          const absUrl = resolveAbsoluteUrl(trimmed, baseUrl);

          // Rewrite to proxy again
          return `/api/proxy?url=${encodeURIComponent(absUrl)}`;
        })
        .join("\n");

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
      res.status(200).send(rewritten);
      return;
    }

    // --- Binary data (TS, AAC, etc.) ---
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
