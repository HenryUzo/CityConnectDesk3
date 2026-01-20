import http from 'node:http';

function request(options, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const req = http.request(options, (res) => {
      let buf = '';
      res.on('data', (d) => buf += d);
      res.on('end', () => resolve({ status: res.statusCode, body: buf, headers: res.headers }));
    });
    req.on('error', reject);
    if (data) {
      req.setHeader('Content-Type', 'application/json');
      req.setHeader('Content-Length', Buffer.byteLength(data));
      req.write(data);
    }
    req.end();
  });
}

async function waitForServer(retries = 40, delay = 500) {
  for (let i = 0; i < retries; i++) {
    try {
      const ok = await new Promise((res) => {
        const req = http.request({ hostname: '127.0.0.1', port: 5000, path: '/health', method: 'GET', timeout: 2000 }, (r) => {
          r.on('data', () => {});
          r.on('end', () => res(true));
        });
        req.on('error', () => res(false));
        req.end();
      });
      if (ok) return true;
    } catch {}
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, delay));
  }
  return false;
}

(async () => {
  const ready = await waitForServer();
  if (!ready) {
    console.error('\nServer not reachable after retries');
    process.exit(2);
  }

  // Use dev bypass header and a valid category to persist snapshot
  try {
    console.log('POST /api/ai/prepared-requests/snapshot');
    const snap = await request({ hostname: '127.0.0.1', port: 5000, path: '/api/ai/prepared-requests/snapshot', method: 'POST', timeout: 5000, headers: { 'x-user-email': 'resident@cityconnect.local' } }, {
      sessionId: 'test-session-node-1',
      category: 'carpenter',
      urgency: 'low',
      recommendedApproach: 'Professional',
      confidenceScore: 0,
      requiresConsultancy: false,
      readyToBook: false,
      snapshot: {},
    });
    console.log('snapshot status', snap.status);
    console.log('snapshot body', snap.body);
  } catch (e) {
    console.error('snapshot error', e && e.message ? e.message : e);
  }

  try {
    console.log('POST /api/ai/diagnose');
    const diag = await request({ hostname: '127.0.0.1', port: 5000, path: '/api/ai/diagnose', method: 'POST', timeout: 5000, headers: { 'x-user-email': 'resident@cityconnect.local' } }, {
      category: 'furniture',
      description: 'Broken chair leg, needs repair. The leg is loose and wood cracked near the joint.',
      urgency: 'low',
      specialInstructions: 'Please suggest if DIY possible'
    });
    console.log('diagnose status', diag.status);
    console.log('diagnose body', diag.body);
  } catch (e) {
    console.error('diagnose error', e && e.message ? e.message : e);
  }
})();
