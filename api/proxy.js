// File: api/proxy.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    res.status(400).send("Missing url parameter");
    return;
  }

  // Headers required by your target stream
  const headers = {
    "Origin": "https://jio.yupptv.online",
    "Referer": "https://jio.yupptv.online/",
    "User-Agent": "Hotstar",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive",
    "Cookie": "", // keep as blank but present
  };

  try {
    const response = await fetch(targetUrl, { headers });

    if (!response.ok) {
      res.status(response.status).send(`Error fetching stream: ${response.statusText}`);
      return;
    }

    // Mirror headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", response.headers.get("content-type") || "application/octet-stream");

    // Stream response
    response.body.pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).send("Proxy error: " + err.message);
  }
}
