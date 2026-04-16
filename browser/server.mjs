import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REMOTE_ORIGIN = 'https://ingresosygastos.te.gob.pa';
const PORT = Number(process.env.PORT || 4180);

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const setCorsHeaders = (response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
};

const safeLocalPath = (pathname) => {
  const cleanPath = pathname === '/' ? '/index.html' : pathname;
  const resolvedPath = normalize(join(__dirname, cleanPath));

  if (!resolvedPath.startsWith(__dirname)) {
    return null;
  }

  return resolvedPath;
};

const serveFile = (response, filePath) => {
  const extension = extname(filePath).toLowerCase();
  response.statusCode = 200;
  response.setHeader('Content-Type', MIME_TYPES[extension] || 'application/octet-stream');
  createReadStream(filePath).pipe(response);
};

const proxyRequest = async (request, response, pathnameWithSearch) => {
  try {
    const upstream = await fetch(`${REMOTE_ORIGIN}${pathnameWithSearch}`, {
      method: request.method,
      headers: {
        accept: request.headers.accept || '*/*',
        'accept-encoding': request.headers['accept-encoding'] || 'gzip, deflate, br',
        'user-agent': request.headers['user-agent'] || 'browser-mirror',
      },
      body: ['GET', 'HEAD'].includes(request.method || 'GET') ? undefined : Readable.toWeb(request),
      duplex: ['GET', 'HEAD'].includes(request.method || 'GET') ? undefined : 'half',
    });

    response.statusCode = upstream.status;
    upstream.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'content-encoding') return;
      response.setHeader(key, value);
    });

    if (!upstream.body) {
      response.end();
      return;
    }

    Readable.fromWeb(upstream.body).pipe(response);
  } catch (error) {
    response.statusCode = 502;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.end(`Proxy error: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

  setCorsHeaders(response);

  if (request.method === 'OPTIONS') {
    response.statusCode = 204;
    response.end();
    return;
  }

  if (requestUrl.pathname.startsWith('/api/')) {
    await proxyRequest(request, response, `${requestUrl.pathname}${requestUrl.search}`);
    return;
  }

  const localPath = safeLocalPath(requestUrl.pathname);
  if (localPath && existsSync(localPath) && statSync(localPath).isFile()) {
    serveFile(response, localPath);
    return;
  }

  if (/\.[a-z0-9]+$/i.test(requestUrl.pathname)) {
    await proxyRequest(request, response, `${requestUrl.pathname}${requestUrl.search}`);
    return;
  }

  serveFile(response, join(__dirname, 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Browser mirror available at http://localhost:${PORT}`);
});
