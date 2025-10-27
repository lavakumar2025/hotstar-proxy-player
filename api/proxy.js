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
      return res
        .status(response.status)
        .send(`Upstream error ${response.status}: ${txt || response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";

    // Handle HLS playlists (.m3u8)
    if (contentType.includes("mpegurl") || decodedUrl.endsWith(".m3u8")) {
      const bodyText = await response.text();
      if (!/#EXTM3U/i.test(bodyText)) {
        return res.status(400).send("Not a valid m3u8 playlist");
      }

      const lines = bodyText.split(/\r?\n/);

      // Check for master playlist (with #EXT-X-STREAM-INF)
      const variantLines = lines.filter(l => l.includes("#EXT-X-STREAM-INF"));
      if (variantLines.length > 0) {
        // Auto-pick best quality
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
          // Fetch highest-quality variant directly (no redirect)
          const nextResp = await fetch(bestUrl, { headers });
          if (!nextResp.ok) {
            return res
              .status(nextResp.status)
              .send("Error fetching best quality playlist");
          }

          const subText = await nextResp.text();
          const subLines = subText.split(/\r?\n/);
          const rewritten = subLines
            .map(line => {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith("#")) return line;
              const abs = resolveToAbsolute(trimmed, bestUrl);
              return `/api/proxy?url=${encodeURIComponent(abs)}`;
            })
            .join("\n");

          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader(
            "Content-Type",
            "application/vnd.apple.mpegurl; charset=utf-8"
          );
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          return res.status(200).send(rewritten);
        }
      }

      // Simple media playlist (not master)
      const rewritten = lines
        .map(line => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) return line;
          const abs = resolveToAbsolute(trimmed, decodedUrl);
          return `/api/proxy?url=${encodeURIComponent(abs)}`;
        })
        .join("\n");

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader(
        "Content-Type",
        "application/vnd.apple.mpegurl; charset=utf-8"
      );
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      return res.status(200).send(rewritten);
    }

    // Handle binary segments (.ts, .aac, etc.)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Content-Type",
      response.headers.get("content-type") || "application/octet-stream"
    );
    const cacheControl =
      response.headers.get("cache-control") ||
      "no-cache, no-store, must-revalidate";
    res.setHeader("Cache-Control", cacheControl);

    // Stream binary body directly
    const stream = response.body;
    if (stream) stream.pipe(res);
    else res.status(500).send("No data received from upstream");
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).send("Proxy error: " + err.message);
  }
}
