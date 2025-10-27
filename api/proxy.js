// api/proxy.js
import fetch from "node-fetch";

// Build headers to mimic original origin
function buildForwardHeaders() {
  return {
    "Origin": "https://jio.yupptv.online",
    "Referer": "https://jio.yupptv.online/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive",
  };
}

// Helper to resolve URLs properly
function resolveToAbsolute(line, baseUrl) {
  try {
    if (/^https?:\/\//i.test(line)) return line;
    const base = new URL(baseUrl);
    if (line.startsWith("//")) return `${base.protocol}${line}`;
    if (line.startsWith("/")) return base.origin + line;
    return new URL(line, base.href).href;
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

    // Fetch the master playlist
    const masterResp = await fetch(decodedUrl, { headers });
    if (!masterResp.ok)
      return res.status(masterResp.status).send(`Upstream error: ${masterResp.status}`);

    const masterText = await masterResp.text();
    if (!/#EXTM3U/i.test(masterText))
      return res.status(400).send("Not a valid m3u8 playlist");

    // Check if this playlist already contains segments
    const isVariant = !masterText.match(/#EXT-X-STREAM-INF/i);

    // If already variant, just rewrite and return
    if (isVariant) {
      const rewritten = rewritePlaylist(masterText, decodedUrl);
      return sendPlaylist(res, rewritten);
    }

    // --- Handle Master Playlist ---
    const lines = masterText.split(/\r?\n/);
    const variants = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("#EXT-X-STREAM-INF")) {
        const nextLine = lines[i + 1]?.trim();
        const abs = resolveToAbsolute(nextLine, decodedUrl);
        const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/);
        const bandwidth = bandwidthMatch ? parseInt(bandwidthMatch[1]) : 0;
        variants.push({ url: abs, bandwidth });
      }
    }

    if (variants.length === 0)
      return res.status(400).send("No variants found");

    // Pick the highest bandwidth (best quality)
    const bestVariant = variants.sort((a, b) => b.bandwidth - a.bandwidth)[0];
    console.log("Using best quality:", bestVariant.bandwidth, bestVariant.url);

    // Fetch the best variant playlist
    const variantResp = await fetch(bestVariant.url, { headers });
    if (!variantResp.ok)
      return res.status(variantResp.status).send(`Variant fetch error: ${variantResp.status}`);

    const variantText = await variantResp.text();
    const rewrittenVariant = rewritePlaylist(variantText, bestVariant.url);

    sendPlaylist(res, rewrittenVariant);

  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).send("Proxy error: " + err.message);
  }
}

// --- Helper: Rewrite segment URLs ---
function rewritePlaylist(text, baseUrl) {
  const lines = text.split(/\r?\n/);
  return lines
    .map(line => {
      const t = line.trim();
      if (!t || t.startsWith("#")) return line;
      const abs = resolveToAbsolute(t, baseUrl);
      return `/api/proxy?url=${encodeURIComponent(abs)}`;
    })
    .join("\n");
}

// --- Helper: Send final playlist ---
function sendPlaylist(res, text) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
  res.status(200).send(text);
}
