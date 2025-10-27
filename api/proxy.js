import fetch from "node-fetch";

export const config = {
  runtime: "edge", // Important for low-latency streaming
};

export default async (req) => {
  try {
    let { searchParams } = new URL(req.url);
    let fullUrl = searchParams.get("url");
    if (!fullUrl) {
      return new Response("Missing URL", { status: 400 });
    }

    // Split cookie if included as |Cookie=
    let cookie = "";
    if (fullUrl.includes("|Cookie=")) {
      const parts = fullUrl.split("|Cookie=");
      fullUrl = parts[0];
      cookie = decodeURIComponent(parts[1]);
    }

    const response = await fetch(fullUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://www.hotstar.com/",
        "Origin": "https://www.hotstar.com",
        ...(cookie ? { "Cookie": cookie } : {}),
      },
    });

    if (!response.ok) {
      return new Response(`CDN Error: ${response.status}`, { status: response.status });
    }

    const newHeaders = new Headers(response.headers);
    newHeaders.set("Access-Control-Allow-Origin", "*");

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  } catch (err) {
    return new Response("Proxy Error: " + err.message, { status: 500 });
  }
};
