import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    // Get the real URL from query
    const targetUrl = req.query.url;

    if (!targetUrl) {
      return res.status(400).send("Missing ?url parameter");
    }

    // Decode encoded URLs (like from encodeURIComponent)
    const decodedUrl = decodeURIComponent(targetUrl);

    // Fetch with headers to simulate a real browser player
    const response = await fetch(decodedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
        "Referer": "https://www.hotstar.com/",
        "Origin": "https://www.hotstar.com",
        "Connection": "keep-alive",
        "Accept": "*/*",
      },
    });

    // Clone content-type
    const contentType = response.headers.get("content-type") || "application/octet-stream";

    // Special: rewrite relative .ts/.m3u8 URLs inside playlists
    let data = await response.text();
    if (contentType.includes("application/vnd.apple.mpegurl") || contentType.includes("mpegurl")) {
      // Fix relative segment URLs
      data = data.replace(
        /(\n)(?!https?:\/\/)([^#\n]+\.m3u8[^ \n]*|[^#\n]+\.ts[^ \n]*)/g,
        (match, p1, p2) => {
          const absUrl = new URL(p2, decodedUrl).href;
          return `${p1}/api/proxy?url=${encodeURIComponent(absUrl)}`;
        }
      );

      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).send(data);
    }

    // For .ts or other binary content
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(buffer);

  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).send("Proxy failed: " + err.message);
  }
}
