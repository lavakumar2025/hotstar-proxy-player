import fetch from "node-fetch";

export default async function handler(req, res) {
  const target = req.query.url;
  if (!target) return res.status(400).send("Missing url param");

  try {
    const upstream = await fetch(target, {
      headers: {
        "Referer": "https://tamilbulb.world/",
        "Origin":  "https://tamilbulb.world/",
        "User-Agent": "Hotstar",
        "Accept": "*/*"
      },
      redirect: "follow"
    });

    const contentType = upstream.headers.get("content-type") || "text/html";
    const text = await upstream.text();
    res.setHeader("Content-Type", "text/plain; charset=utf-8"); // send raw HTML as text
    res.status(upstream.status).send(text);
  } catch (err) {
    res.status(500).send("fetch error: " + err.message);
  }
}
