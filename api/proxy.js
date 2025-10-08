const fetch = require('node-fetch'); // v2.x

module.exports = async (req, res) => {
  try {
    let targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('Missing url parameter');

    try { targetUrl = decodeURIComponent(targetUrl); } catch (e) { }

    console.log('[Proxy] Fetching:', targetUrl);

    const headers = {
      'Origin': 'https://www.hotstar.com',
      'Referer': 'https://www.hotstar.com/',
      'User-Agent': 'Hotstar;in.startv.hotstar.links_macha_official(Android/15)'
    };

    // If user passes Cookie in URL like ?url=...|Cookie=xyz
    const cookieSplit = targetUrl.split('|Cookie=');
    if (cookieSplit[1]) {
      headers['Cookie'] = cookieSplit[1];
      targetUrl = cookieSplit[0];
    }

    // Forward Range header (important for .ts chunks)
    if (req.headers['range']) headers['Range'] = req.headers['range'];

    const upstream = await fetch(targetUrl, { headers, method: 'GET' });
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      console.error('[Proxy] Upstream error', upstream.status, upstream.statusText);
      return res.status(upstream.status).send(text || `Upstream ${upstream.status}`);
    }

    const contentType = (upstream.headers.get('content-type') || '').toLowerCase();

    // Rewrite m3u8 playlists
    if (targetUrl.toLowerCase().includes('.m3u8') || contentType.includes('mpegurl') || contentType.includes('vnd.apple')) {
      const text = await upstream.text();
      const base = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

      const linesArr = text.split(/\r?\n/).map(line => {
        const t = (line || '').trim();
        if (!t || t.startsWith('#')) return t;

        const absoluteUrl = t.startsWith('http') ? t : base + t;
        const encoded = encodeURIComponent(absoluteUrl);
        return `/api/proxy?url=${encoded}${headers['Cookie'] ? `|Cookie=${headers['Cookie']}` : ''}`;
      });

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache');
      return res.send(linesArr.join('\n'));
    }

    // Stream .ts or other binary files
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
    if (upstream.headers.get('content-length')) res.setHeader('Content-Length', upstream.headers.get('content-length'));
    if (upstream.headers.get('accept-ranges')) res.setHeader('Accept-Ranges', upstream.headers.get('accept-ranges'));

    // Pipe response
    upstream.body.pipe(res);
  } catch (err) {
    console.error('[Proxy] Error:', err);
    res.status(500).send('Proxy internal error: ' + String(err));
  }
};
