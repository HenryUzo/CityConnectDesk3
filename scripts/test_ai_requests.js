import http from 'node:http';

function postJson(path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: '127.0.0.1',
      port: 5000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers,
      },
      timeout: 5000,
    };

    const req = http.request(options, (res) => {
      let buf = '';
      res.on('data', (d) => buf += d);
      res.on('end', () => resolve({ status: res.statusCode, body: buf, headers: res.headers }));
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

async function waitForServer(retries = 10, delay = 500) {
  const hosts = ['127.0.0.1', 'localhost', '::1'];
  for (let i = 0; i < retries; i++) {
    for (const host of hosts) {
      try {
        await new Promise((res, rej) => {
          const req = http.request({ hostname: host, port: 5000, path: '/health', method: 'GET', timeout: 2000 }, (r) => {
            r.on('data', () => {});
            r.on('end', () => res());
          });
          req.on('error', rej);
          req.end();
        });
        return true;
      } catch (e) {
        // try next host
      }
    }
    await new Promise((r) => setTimeout(r, delay));
  }
  return false;
}

(async () => {
  const ready = await waitForServer(20, 500);
  if (!ready) {
    console.error('Server not reachable on 127.0.0.1:5000');
    process.exit(2);
  }

  try {
    console.log('POST /api/ai/prepared-requests/snapshot');
    const snap = await postJson('/api/ai/prepared-requests/snapshot', {
      sessionId: 'test-session-node-1',
      category: 'furniture',
      urgency: 'low',
      recommendedApproach: 'Professional',
      confidenceScore: 0,
      requiresConsultancy: false,
      readyToBook: false,
      snapshot: {},
    }, { 'x-user-email': 'resident@cityconnect.local' });
    console.log('snapshot status', snap.status);
    console.log('snapshot body', snap.body);
  } catch (e) {
    console.error('snapshot error', e && e.message ? e.message : e);
  }

  try {
    console.log('POST /api/ai/diagnose');
    const diag = await postJson('/api/ai/diagnose', {
      category: 'furniture',
      description: 'Broken chair leg, needs repair. The leg is loose and wood cracked near the joint.',
      urgency: 'low',
      specialInstructions: 'Please suggest if DIY possible'
    }, { 'x-user-email': 'resident@cityconnect.local' });
    console.log('diagnose status', diag.status);
    console.log('diagnose body', diag.body);
  } catch (e) {
    console.error('diagnose error', e && e.message ? e.message : e);
  }
})();
