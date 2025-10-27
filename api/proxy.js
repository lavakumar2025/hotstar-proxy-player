import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();

// Enable CORS for all origins
app.use(cors({
  origin: "*",
  methods: ["GET"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.get("/proxy", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send("Missing URL");

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Referer": "https://www.hotstar.com/",
        "Origin": "https://www.hotstar.com"
      }
    });

    // Copy content-type
    res.setHeader("Content-Type", response.headers.get("content-type") || "application/octet-stream");
    // CORS header
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Stream response to client
    response.body.pipe(res);
  } catch (err) {
    console.error("Proxy Error:", err);
    res.status(500).send("Proxy error: " + err.message);
  }
});

app.listen(3000, () => console.log("Proxy running on port 3000"));
