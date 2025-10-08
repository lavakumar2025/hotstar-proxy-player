const fetch = require('node-fetch'); // v2.x

module.exports = async (req, res) => {
  const { url, cookie } = req.query;
  if (!url) return res.status(400).send('Missing url parameter');

  let targetUrl = decodeURIComponent(url);

  try {
    const headers = {
      'Origin': 'https://www.hotstar.com',
      'Referer': 'https://www.hotstar.com/',
      'User-Agent': 'Hotstar;in.startv.hotstar(Android/15)',
      'Cookie': cookie || ''
    };

    if (req.headers.range) headers.Range = req.headers.range;

    const upstreamResp = await fetch(targetUrl, { headers });
    const contentType = upstreamResp.headers.get('content-type') || 'application/octet-stream';

    // If playlist, rewrite all chunk URLs to proxied URLs
    if (targetUrl.includes('.m3u8')) {
      const text = await upstreamResp.text();
      const base = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

      const linesArr = text.split(/\r?\n/).map(line => {
        const t = (line || '').trim();
        if (!t || t.startsWith('#')) return t;

        const absoluteUrl = t.startsWith('http') ? t : base + t;
        const proxiedUrl = `/api/proxy?url=${encodeURIComponent(absoluteUrl)}&cookie=${encodeURIComponent(cookie || '')}`;
        return proxiedUrl;
      });

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache');
      return res.send(linesArr.join('\n'));
    }

    // Otherwise, stream binary (.ts, key, etc.)
    res.setHeader('Content-Type', contentType);
    if (upstreamResp.headers.get('content-length'))
      res.setHeader('Content-Length', upstreamResp.headers.get('content-length'));
    if (upstreamResp.headers.get('accept-ranges'))
      res.setHeader('Accept-Ranges', upstreamResp.headers.get('accept-ranges'));

    upstreamResp.body.pipe(res);

  } catch (err) {
    console.error('[Proxy] Error:', err);
    res.status(500).send('Proxy internal error: ' + err.message);
  }
};
