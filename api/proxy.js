// api/proxy.js
import fetch from "node-fetch";

function buildForwardHeaders() {
  return {
    "Origin": "https://jio.yupptv.online",
    "Referer": "https://jio.yupptv.online/",
    "User-Agent": "Hotstar",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive"
  };
}

function resolveToAbsolute(line, baseUrl) {
  try {
    if (/^https?:\/\//i.test(line)) return line; // already absolute
    if (/^\/\//.test(line)) {
      const base = new URL(baseUrl);
      return `${base.protocol}${line}`;
    }
    const base = new URL(baseUrl);
    const origin = base.origin;
    if (line.startsWith("/")) {
      return origin + line;
    }
    const baseDir = origin + base.pathname.substring(0, base.pathname.lastIndexOf("/") + 1);
    return new URL(line, baseDir).href;
  } catch (e) {
    console.error("resolveToAbsolute error:", e);
    return line;
  }
}

export default async function handler(req, res) {
  try {
    const targetUrl = req.query.url || req.url.split("?url=")[1];
    if (!targetUrl) {
      return res.status(400).send("Missing url parameter");
    }

    const decodedUrl = decodeURIComponent(targetUrl);
    const headers = buildForwardHeaders();
    const upstream = await fetch(decodedUrl, { headers });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return res.status(upstream.status).send(`Upstream error ${upstream.status}: ${text || upstream.statusText}`);
    }

    const bodyText = await upstream.text();
    const isM3U8 = /#EXTM3U/i.test(bodyText);

    if (isM3U8) {
      const lines = bodyText.split(/\r?\n/);
      const rewritten = lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return line;

        const abs = resolveToAbsolute(trimmed, decodedUrl);
        // Build rewritten proxy URL (relative to your API)
        return `/api/proxy?url=${encodeURIComponent(abs)}`;
      }).join("\n");

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      return res.status(200).send(rewritten);
    }

    // If it's not a playlist, re-fetch as binary to stream it
    const streamResp = await fetch(decodedUrl, { headers });
    const contentType = streamResp.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", contentType);
    const stream = streamResp.body;
    if (!stream) return res.status(500).send("Upstream has no body");
    stream.pipe(res);

  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).send("Proxy error: " + err.message);
  }
}
