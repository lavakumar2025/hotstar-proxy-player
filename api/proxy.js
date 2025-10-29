export default async function handler(req, res) {
  try {
    const target = req.query.url;
    if (!target) {
      return res.status(400).send("Missing ?url parameter");
    }

    // Decode and validate the target URL
    const decoded = decodeURIComponent(target);
    if (!/^https?:\/\//i.test(decoded)) {
      return res.status(400).send("Invalid URL");
    }

    // Fetch the remote content
    const response = await fetch(decoded, {
      headers: {
        "User-Agent": req.headers["user-agent"] || "Mozilla/5.0",
        "Referer": req.headers["referer"] || "",
        "Origin": req.headers["origin"] || "",
      },
    });

    // Copy content type and data
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const body = await response.arrayBuffer();

    // Set CORS + cache headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "no-store");

    res.status(response.status).send(Buffer.from(body));
  } catch (error) {
    res.status(500).send("Proxy error: " + error.message);
  }
}
