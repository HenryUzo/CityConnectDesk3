import http from 'http';

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', ts: new Date().toISOString() }));
    return;
  }
  
  res.writeHead(404);
  res.end('Not found');
});

const port = 8000;
const host = '127.0.0.1';

console.log(`[BOOT] Starting simple test server...`);

server.on('error', (err) => {
  console.error('[SERVER ERROR]', err);
});

server.on('listening', () => {
  console.log(`[BOOT] Server is listening on ${host}:${port}`);
});

server.listen(port, host, () => {
  console.log(`[BOOT] Listen callback executed`);
});

// Keep the process alive
setInterval(() => {
  console.log(`[KEEPALIVE] Running at ${new Date().toISOString()}`);
}, 2000);
