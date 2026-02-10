const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = process.env.PORT || 3000;
const indexPath = path.join(__dirname, 'index.html');
const indexHtml = fs.readFileSync(indexPath);
const indexGzip = zlib.gzipSync(indexHtml);

const headers = {
  'Content-Type': 'text/html; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'public, max-age=3600',
};

const server = http.createServer((req, res) => {
  const acceptGzip = (req.headers['accept-encoding'] || '').includes('gzip');

  if (acceptGzip) {
    res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip' });
    res.end(indexGzip);
  } else {
    res.writeHead(200, headers);
    res.end(indexHtml);
  }
});

server.listen(PORT, () => {
  console.log(`markupR landing page serving on port ${PORT}`);
});
