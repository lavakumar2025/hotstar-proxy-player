// proxy.js (dynamic cookie from user URL)
const express = require('express');
const fetch = require('node-fetch'); // v2.x
const path = require('path');

const app = express();
const PORT = 3800;

// serve player.html and static files from this folder
app.use(express.static(path.join(__dirname)));

// basic CORS for browser playback
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Range');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/proxy', async (req, res) => {
  try {
    if (!req.query.url) return res.status(400).send('Missing url parameter');

    // accept either encoded or plain url
    let targetUrl = req.query.url;
    try { targetUrl = decodeURIComponent(targetUrl); } catch (e) { /* ignore */ }

    // extract optional cookie from URL (like ?url=...|Cookie=abc123)
    const cookieMatch = targetUrl.match(/\|Cookie=(.*)$/);
    const cookie = cookieMatch ? cookieMatch[1] : '';
    targetUrl = targetUrl.replace(/\|Cookie=.*$/, '');

    console.log(`[Proxy] fetch -> ${targetUrl}`);
    if (cookie) console.log(`[Proxy] using cookie -> ${cookie.slice(0, 50)}...`);

    // base headers
    const upstreamHeaders = {
      'Origin': 'https://www.hotstar.com',
      'Referer': 'https://www.hotstar.com/',
      'User-Agent': 'Hotstar;in.startv.hotstar.links_macha_official(Android/15)'
    };

    // add cookie if provided
    if (cookie) upstreamHeaders['Cookie'] = cookie;

    // forward Range header if client requested it (important for .ts)
    if (req.headers.range) upstreamHeaders.Range = req.headers.range;

    const upstreamResp = await fetch(targetUrl, { method: 'GET', headers: upstreamHeaders });

    if (!upstreamResp.ok) {
      const text = await upstreamResp.text().catch(() => '');
      console.error(`[Proxy] upstream error ${upstreamResp.status} ${upstreamResp.statusText}`);
      return res.status(upstreamResp.status).type('text/plain').send(text || `Upstream ${upstreamResp.status}`);
    }

    const contentType = (upstreamResp.headers.get('content-type') || '').toLowerCase();

    // If playlist, rewrite segment lines to proxied URLs
    if (targetUrl.toLowerCase().includes('.m3u8') || contentType.includes('mpegurl') || contentType.includes('vnd.apple')) {
      const text = await upstreamResp.text();
      const base = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

      const linesArr = text.split(/\r?\n/).map(line => {
        const t = (line || '').trim();
        if (!t || t.startsWith('#')) return t;

        // build absolute segment URL (preserve query)
        const absoluteUrl = t.startsWith('http') ? t : base + t;

        // encode entire absolute URL so ?m= etc are preserved
        const encoded = encodeURIComponent(absoluteUrl + (cookie ? `|Cookie=${cookie}` : ''));
        const proxied = `http://127.0.0.1:${PORT}/proxy?url=${encoded}`;
        console.log(`[Proxy] rewrite -> ${proxied}`);
        return proxied;
      });

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache');
      return res.send(linesArr.join('\n'));
    }

    // Otherwise stream binary (.ts, key, etc.) back
    const upstreamCL = upstreamResp.headers.get('content-length');
    const upstreamAR = upstreamResp.headers.get('accept-ranges');

    if (upstreamCL) res.setHeader('Content-Length', upstreamCL);
    if (upstreamAR) res.setHeader('Accept-Ranges', upstreamAR);
    res.setHeader('Content-Type', upstreamResp.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');

    res.status(upstreamResp.status);
    upstreamResp.body.pipe(res);
  } catch (err) {
    console.error('[Proxy] Error:', err && err.stack ? err.stack : err);
    res.status(500).send('Proxy internal error: ' + String(err));
  }
});

app.listen(PORT, () => {
  console.log(`✅ Proxy & static server running at http://127.0.0.1:${PORT}`);
  console.log(`Open http://127.0.0.1:${PORT}/player.html`);
});
