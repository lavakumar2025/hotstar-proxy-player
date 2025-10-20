import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send("Missing url parameter");

    const headers = {
      "Origin": "https://jio.yupptv.online",
      "Referer": "https://jio.yupptv.online/",
      "User-Agent": "Hotstar",
      "Accept": "*/*",
      "Connection": "keep-alive"
    };

    const upstream = await fetch(targetUrl, { headers });

    if (!upstream.ok) {
      res.status(upstream.status).send(`Upstream error ${upstream.status}`);
      return;
    }

    const contentType = upstream.headers.get("content-type") || "";
    const bodyText = await upstream.text();

    // If it's a master playlist, rewrite relative chunk URLs
    if (contentType.includes("mpegurl") || bodyText.includes("#EXTM3U")) {
      const base = targetUrl.split("/").slice(0, -1).join("/") + "/"; // base URL path
      const rewritten = bodyText.split("\n").map(line => {
        if (!line || line.startsWith("#")) return line;
        // convert relative stream.m3u8?chunks=... to full URL
        if (line.startsWith("stream.m3u8?chunks=")) {
          return base + line;
        }
        return line;
      }).join("\n");

// Inside your proxy.js, after fetching the chunk playlist
if (contentType.includes("mpegurl") || bodyText.includes("#EXTM3U")) {
  const baseProxy = "https://hotstar-proxy-player.vercel.app/api/proxy?url=";

  const rewritten = bodyText.split("\n").map(line => {
    if (!line || line.startsWith("#")) return line;

    // Rewrite relative ts or chunk URLs to full proxy URLs
    if (line.includes("stream.ts?segment=") || line.includes("stream.m3u8?chunks=")) {
      return baseProxy + encodeURIComponent("https://bb4.xojef51292.workers.dev/tamilbulb/live/" + line);
    }

    return line;
  }).join("\n");

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
  res.status(200).send(rewritten);
  return;
}


      
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
      res.status(200).send(rewritten);
      return;
    }

    // Otherwise pipe binary (.ts segments)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", contentType);
    upstream.body.pipe(res);

  } catch (err) {
    console.error(err);
    res.status(500).send("Proxy error: " + err.message);
  }
}
