import fetch from "node-fetch";

export default async function handler(req, res) {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send("Missing url parameter");
  }

  try {
    const response = await fetch(url, {
      headers: {
        "Origin": "https://www.hotstar.com",
        "Referer": "https://www.hotstar.com/",
        "User-Agent": "Hotstar;in.startv.hotstar/13.3.0 (Linux;Android 10) ExoPlayerLib/2.14.2",
        "Cookie":
          "hdntl=exp=1759269007~acl=/*~id=c40a5e786ea713d5f9bb6e3d0a86e57d~data=hdntl~hmac=fbf8d61f477cf406a086bc0ea61cd5994e2a577788586c4543f5ffe561c6fe34"
      },
    });

    let body = await response.text();
    let contentType = response.headers.get("content-type") || "text/plain";

    // If playlist (.m3u8), rewrite chunk URLs through proxy
    if (url.includes(".m3u8")) {
      const base = url.substring(0, url.lastIndexOf("/") + 1);
      body = body
        .split("\n")
        .map((line) => {
          line = line.trim();
          if (line && !line.startsWith("#")) {
            if (!line.startsWith("http")) {
              line = base + line;
            }
            line = req.headers.origin + "/api/proxy?url=" + encodeURIComponent(line);
          }
          return line;
        })
        .join("\n");
      contentType = "application/vnd.apple.mpegurl";
    }

    res.setHeader("Content-Type", contentType);
    res.status(response.status).send(body);
  } catch (err) {
    res.status(500).send("Proxy error: " + err.message);
  }
}
