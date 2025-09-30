const fetch = require("node-fetch");

module.exports = async (req, res) => {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send("Missing url parameter");
  }

  try {
    const response = await fetch(url, {
      headers: {
        "Origin": "https://www.hotstar.com",
        "Referer": "https://www.hotstar.com/",
        "User-Agent": "Hotstar;in.startv.hotstar.links_macha_official(Android/15)",
        "Cookie": "hdntl=exp=1759269007~acl=%2f*~id=c40a5e786ea713d5f9bb6e3d0a86e57d~data=hdntl~hmac=fbf8d61f477cf406a086bc0ea61cd5994e2a577788586c4543f5ffe561c6fe34"
      }
    });

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", contentType);

    const body = await response.text();

    // If m3u8 playlist, rewrite chunk URLs
    if (url.includes(".m3u8")) {
      const base = url.substring(0, url.lastIndexOf("/") + 1);
      const lines = body.split("\n").map(line => {
        line = line.trim();
        if (line && !line.startsWith("#")) {
          if (!line.startsWith("http")) line = base + line;
          line = `/proxy?url=${encodeURIComponent(line)}`;
        }
        return line;
      });
      return res.send(lines.join("\n"));
    }

    res.send(body);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching URL");
  }
};
