import fetch from "node-fetch";

function buildForwardHeaders() {
  return {
    "Origin": "https://jio.yupptv.online",
    "Referer": "https://jio.yupptv.online/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive"
  };
}

function resolveToAbsolute(line, baseUrl) {
  try {
    if (/^https?:\/\//i.test(line)) return line;
    const base = new URL(baseUrl);
    return new URL(line, base).href;
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
      const text = await response.text().catch(() => "");
      return res.status(response.status).send(`Upstream error ${response.status}: ${text || response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";
    const isM3U8 = contentType.includes("mpegurl") || decodedUrl.includes(".m3u8");

    // --- Handle HLS playlist ---
    if (isM3U8) {
      const bodyText = await response.text();
      if (!/#EXTM3U/i.test(bodyText)) return res.status(200).send(bodyText);

      const lines = bodyText.split(/\r?\n/);
      const variantLines = lines.filter(l => l.includes("#EXT-X-STREAM-INF"));

      // Auto-select best quality (1080p)
      if (variantLines.length > 0) {
        let bestUrl = null;
        let bestRes = 0;

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith("#EXT-X-STREAM-INF")) {
            const resMatch = lines[i].match(/RESOLUTION=\d+x(\d+)/);
            const urlLine = lines[i + 1]?.trim();
            if (urlLine) {
              const absUrl = resolveToAbsolute(urlLine, decodedUrl);
              const height = resMatch ? parseInt(resMatch[1]) : 0;
              if (height > bestRes) {
                bestRes = height;
                bestUrl = absUrl;
              }
            }
          }
        }

        if (bestUrl) {
          const nextResp = await fetch(bestUrl, { headers });
          const subPlaylist = await nextResp.text();
          const rewritten = subPlaylist
            .split(/\r?\n/)
            .map(line => {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith("#")) return line;
              const abs = resolveToAbsolute(trimmed, bestUrl);
              return `/api/proxy?url=${encodeURIComponent(abs)}`;
            })
            .join("\n");

          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
          return res.status(200).send(rewritten);
        }
      }

      // Rewrite segment URLs
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

    // --- Handle TS or media segment ---
    const streamResp = await fetch(decodedUrl, { headers });
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Content-Type", streamResp.headers.get("content-type") || "video/mp2t");

    if (streamResp.body) streamResp.body.pipe(res);
    else res.status(500).send("No stream data");
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).send("Proxy error: " + err.message);
  }
}
