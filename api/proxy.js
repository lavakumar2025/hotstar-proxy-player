// api/proxy.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) {
      res.status(400).send("Missing url parameter");
      return;
    }

    const headers = {
      "Origin": "https://jio.yupptv.online",
      "Referer": "https://jio.yupptv.online/",
      "User-Agent": "Hotstar",
      "Accept": "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "Connection": "keep-alive",
      "Cookie": ""
    };

    const response = await fetch(targetUrl, { headers });

    if (!response.ok) {
      res.status(response.status).send(`Error fetching stream: ${response.statusText}`);
      return;
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", response.headers.get("content-type") || "application/octet-stream");

    response.body.pipe(res);
  } catch (error) {
    res.status(500).send("Proxy error: " + error.message);
  }
}
