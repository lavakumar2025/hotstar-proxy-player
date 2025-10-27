import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    let url = req.query.url;
    if (!url) {
      return res.status(400).send("Missing URL");
    }

    // Extract optional cookie from URL
    let cookie = "";
    if (url.includes("|Cookie=")) {
      const parts = url.split("|Cookie=");
      url = parts[0];
      cookie = decodeURIComponent(parts[1]);
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Referer": "https://www.hotstar.com/",
        "Origin": "https://www.hotstar.com",
        ...(cookie ? { "Cookie": cookie } : {})
      }
    });

    // Stream the response
    res.setHeader("Content-Type", response.headers.get("content-type") || "application/octet-stream");
    res.setHeader("Access-Control-Allow-Origin", "*");

    response.body.pipe(res);
  } catch (err) {
    console.error("Proxy Error:", err);
    res.status(500).send("Proxy Error: " + err.message);
  }
}
