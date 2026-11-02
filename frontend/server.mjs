import http from 'node:http';
import { readFile } from 'node:fs/promises';

const port = Number(process.env.PORT || 3000);
const backend = process.env.BACKEND_URL || 'http://127.0.0.1:8080';
const files = {
  '/': ['index.html', 'text/html'],
  '/index.html': ['index.html', 'text/html'],
  '/app.js': ['app.js', 'text/javascript'],
  '/styles.css': ['styles.css', 'text/css'],
};

function proxyRequest(request, response) {
  const headers = { 'Content-Type': 'application/json' };
  if (request.headers.authorization) {
    headers.Authorization = request.headers.authorization;
  }

  const proxy = http.request(backend + request.url, { method: request.method, headers }, function (upstream) {
    response.writeHead(upstream.statusCode, {
      'Content-Type': upstream.headers['content-type'] || 'application/json',
    });
    upstream.on('error', function () {
      response.destroy();
    });
    upstream.pipe(response);
  });

  proxy.setTimeout(15000, function () {
    proxy.destroy();
  });
  proxy.on('error', function () {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ message: 'Бэкенд недоступен. Запустите Spring Boot на порту 8080.' }));
  });
  request.on('aborted', function () {
    proxy.destroy();
  });
  request.pipe(proxy);
}

async function serveFile(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }

  const pathname = request.url.split('?')[0];
  const file = files[pathname];
  if (!file) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }

  try {
    const content = await readFile(new URL('./public/' + file[0], import.meta.url));
    response.writeHead(200, { 'Content-Type': file[1] + '; charset=utf-8' });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    response.writeHead(500);
    response.end('Не удалось прочитать файл');
  }
}

const server = http.createServer(function (request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Content-Security-Policy', "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");

  if (request.url.startsWith('/api/')) {
    proxyRequest(request, response);
  } else {
    serveFile(request, response);
  }
});

server.on('error', function (error) {
  console.error(error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', function () {
  console.log('Фронтенд: http://127.0.0.1:' + server.address().port);
});
