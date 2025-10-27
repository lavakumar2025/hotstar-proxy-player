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
    if (/^https?:\/\//i.test(line)) return line;
    const base = new URL(baseUrl);
    const baseDir = base.href.substring(0, base.href.lastIndexOf("/") + 1);
    return new URL(line, baseDir).href;
  } catch {
    return line;
  }
}

export default async function handler(req, res) {
  try {
    const targetUrl = req.query.url || req.url.split("?url=")[1];
    if (!targetUrl) return res.status(400).send("Missing url parameter");

    const decodedUrl = decodeURIComponent(targetUrl);
    const headers = buildForwardHeaders();
    const response = await fetch(decodedUrl, { headers });

    if (!response.ok) {
      const txt = await response.text().catch(() => "");
      return res.status(response.status).send(`Upstream error ${response.status}: ${txt || response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";
    const bodyText = await response.text();

    // ✅ Detect playlist
    if (/#EXTM3U/i.test(bodyText)) {
      const lines = bodyText.split(/\r?\n/);

      // ✅ Detect variant playlists (master playlist)
      const variantLines = lines.filter(l => l.includes("#EXT-X-STREAM-INF"));
      if (variantLines.length > 0) {
        let bestUrl = null;
        let bestRes = 0;

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith("#EXT-X-STREAM-INF")) {
            const resMatch = lines[i].match(/RESOLUTION=(\d+)x(\d+)/);
            const urlLine = lines[i + 1]?.trim();
            if (urlLine) {
              const absUrl = resolveToAbsolute(urlLine, decodedUrl);
              const height = resMatch ? parseInt(resMatch[2]) : 0;
              if (height > bestRes) {
                bestRes = height;
                bestUrl = absUrl;
              }
            }
          }
        }

        if (bestUrl) {
          // ✅ Auto-select highest quality variant (usually 1080p)
          const redirect = `/api/proxy?url=${encodeURIComponent(bestUrl)}`;
          return res.redirect(302, redirect);
        }
      }

      // ✅ Regular media playlist, rewrite segments
      const rewritten = lines
        .map(line => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) return line;
          const abs = resolveToAbsolute(trimmed, decodedUrl);
          return `/api/proxy?url=${encodeURIComponent(abs)}`;
        })
        .join("\n");

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      return res.status(200).send(rewritten);
    }

    // ✅ Non-m3u8 (segment files)
    const streamResp = await fetch(decodedUrl, { headers });
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", streamResp.headers.get("content-type") || "application/octet-stream");
    if (streamResp.body) streamResp.body.pipe(res);
    else res.status(500).send("No stream data");
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).send("Proxy error: " + err.message);
  }
}
