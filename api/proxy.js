export const config = {
  runtime: "edge", // Required for Edge Runtime (no Node modules)
};

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    let fullUrl = searchParams.get("url");

    if (!fullUrl) {
      return new Response("Missing URL parameter", { status: 400 });
    }

    // Parse Cookie if appended like ?url=...|Cookie=...
    let cookie = "";
    if (fullUrl.includes("|Cookie=")) {
      const parts = fullUrl.split("|Cookie=");
      fullUrl = parts[0];
      cookie = decodeURIComponent(parts[1]);
    }

    // Fetch from the real m3u8 URL
    const response = await fetch(fullUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Referer": "https://www.hotstar.com/",
        "Origin": "https://www.hotstar.com",
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });

    // If CDN rejects (Akamai Reference #...) handle gracefully
    if (!response.ok) {
      return new Response(`Error fetching stream: ${response.status}`, {
        status: response.status,
      });
    }

    // Clone headers and allow CORS
    const newHeaders = new Headers(response.headers);
    newHeaders.set("Access-Control-Allow-Origin", "*");
    newHeaders.delete("content-security-policy");
    newHeaders.delete("x-frame-options");

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  } catch (err) {
    return new Response("Proxy Error: " + err.message, { status: 500 });
  }
}
