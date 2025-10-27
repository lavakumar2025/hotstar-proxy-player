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

function resolveToAbsolute(line, baseUrl) {
  // line is trimmed non-empty and not a comment
  try {
    // already absolute http(s)
    if (/^https?:\/\//i.test(line)) return line;

    // protocol-relative: //host/path
    if (/^\/\//.test(line)) {
      const base = new URL(baseUrl);
      return `${base.protocol}${line}`;
    }

    const base = new URL(baseUrl);
    const origin = base.origin;
    // if line starts with '/', it's absolute path on same origin
    if (line.startsWith("/")) {
      return origin + line;
    }

    // otherwise resolve relative to directory of base (strip filename and query)
    const baseDir = origin + base.pathname.substring(0, base.pathname.lastIndexOf("/") + 1);
    return new URL(line, baseDir).href;
  } catch (e) {
    console.error("resolveToAbsolute error:", e, "line:", line, "baseUrl:", baseUrl);
    return line; // fallback
  }
}

export default async function handler(req, res) {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send("Missing url parameter");

    const headers = buildForwardHeaders();
    const upstream = await fetch(targetUrl, { headers });

    if (!upstream.ok) {
      const text = await upstream.text().catch(()=>"");
      return res.status(upstream.status).send(`Upstream error ${upstream.status}: ${text || upstream.statusText}`);
    }

    // Always read text first to detect m3u8 content even if content-type is absent/wrong.
    const rawBody = await upstream.text();
    const looksLikeM3U8 = /#EXTM3U/i.test(rawBody) || /\.m3u8(\?|$)/i.test(targetUrl);

    if (looksLikeM3U8) {
      const lines = rawBody.split(/\r?\n/);
      const rewritten = lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return line; // keep comments/empty

        // Resolve absolute URL
        const abs = resolveToAbsolute(trimmed, targetUrl);

        // Prevent rewriting if it's already a local proxy call to avoid loops
        // If your proxy domain is same host, adjust condition accordingly.
        // Here we skip rewriting if the abs already starts with our API proxy path.
        if (abs.startsWith(req.protocol + "://" + req.get("host") + "/api/proxy") ||
            abs.includes("/api/proxy?url=")) {
          return abs;
        }

        return `/api/proxy?url=${encodeURIComponent(abs)}`;
      }).join("\n");

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
      return res.status(200).send(rewritten);
    }

    // Not a playlist: send as binary (we already consumed upstream.text(), so re-fetch)
    // Re-fetch as a stream to pipe (some hosts don't like double-reading; re-request)
    const upstreamStream = await fetch(targetUrl, { headers });
    if (!upstreamStream.ok) {
      const text = await upstreamStream.text().catch(()=>"");
      return res.status(upstreamStream.status).send(`Upstream error ${upstreamStream.status}: ${text || upstreamStream.statusText}`);
    }

    const contentType = upstreamStream.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", contentType);
    const upstreamCache = upstreamStream.headers.get("cache-control");
    if (upstreamCache) res.setHeader("Cache-Control", upstreamCache);

    const body = upstreamStream.body;
    if (!body) return res.status(500).send("Upstream has no body");
    body.pipe(res);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).send("Proxy error: " + err.message);
  }
}
