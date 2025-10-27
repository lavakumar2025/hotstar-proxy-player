import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) {
      return res.status(400).send("Missing ?url parameter");
    }

    const decodedUrl = decodeURIComponent(targetUrl);

    // Fetch the content
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

    const contentType =
      response.headers.get("content-type") || "application/octet-stream";

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", contentType);

    // ✅ Handle .m3u8 or .m3u8?chunks= files (playlist text)
    if (
      contentType.includes("application/vnd.apple.mpegurl") ||
      contentType.includes("mpegurl") ||
      decodedUrl.includes(".m3u8")
    ) {
      let data = await response.text();

      // Rewrite any relative .ts or .m3u8 URLs inside the playlist
      data = data.replace(
        /(\n)(?!https?:\/\/)([^#\n]+\.m3u8[^ \n]*|[^#\n]+\.ts[^ \n]*)/g,
        (match, p1, p2) => {
          const absUrl = new URL(p2, decodedUrl).href;
          return `${p1}/api/proxy?url=${encodeURIComponent(absUrl)}`;
        }
      );

      return res.status(200).send(data);
    }

    // ✅ Handle binary data (.ts or others)
    const buffer = Buffer.from(await response.arrayBuffer());
    return res.status(200).send(buffer);
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).send("Proxy failed: " + err.message);
  }
}
