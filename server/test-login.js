// server/test-login.js
// Simple Node script to POST login JSON to the Vite proxy and print full responses.
(async () => {
  try {
    const urlBase = 'http://localhost:5173';
    const loginUrl = `${urlBase}/api/login`;
    const userUrl = `${urlBase}/api/user`;

    const payload = { username: 'pgadmin@cityconnect.com', password: 'PgAdmin123!' };

    console.log('POST', loginUrl);
    // Simulate browser headers (Vite dev server origin)
    const browserLikeHeaders = {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:5173',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
    };

    const t0 = Date.now();
    const loginRes = await fetch(loginUrl, {
      method: 'POST',
      headers: browserLikeHeaders,
      body: JSON.stringify(payload),
    });
    const t1 = Date.now();
    const loginTime = t1 - t0;

    console.log('\n--- LOGIN RESPONSE ---');
    console.log('status:', loginRes.status, loginRes.statusText);
    console.log('headers:');
    for (const [k, v] of loginRes.headers) console.log(`${k}: ${v}`);
    const ct = loginRes.headers.get('content-type') || '';
    const loginBody = ct.includes('application/json') ? await loginRes.json() : await loginRes.text();
    console.log('body:', typeof loginBody === 'string' ? loginBody : JSON.stringify(loginBody, null, 2));
    console.log('timing: ' + loginTime + 'ms');

    const setCookie = loginRes.headers.get('set-cookie');
    console.log('set-cookie header:', setCookie);

    // Prepare cookie header for subsequent request (use first cookie pair)
    const cookieHeader = setCookie ? setCookie.split(';')[0] : undefined;

    console.log('\nGET', userUrl);
    const t2 = Date.now();
    const userRes = await fetch(userUrl, {
      method: 'GET',
      headers: Object.assign({}, cookieHeader ? { Cookie: cookieHeader } : undefined, {
        'Origin': 'http://localhost:5173',
        'User-Agent': browserLikeHeaders['User-Agent'],
        'Accept': 'application/json, text/plain, */*',
      }),
    });
    const t3 = Date.now();
    const userTime = t3 - t2;

    console.log('\n--- USER RESPONSE ---');
    console.log('status:', userRes.status, userRes.statusText);
    console.log('headers:');
    for (const [k, v] of userRes.headers) console.log(`${k}: ${v}`);
    const userCt = userRes.headers.get('content-type') || '';
    const userBody = userCt.includes('application/json') ? await userRes.json() : await userRes.text();
    console.log('body:', typeof userBody === 'string' ? userBody : JSON.stringify(userBody, null, 2));
    console.log('timing: ' + userTime + 'ms');
  } catch (err) {
    console.error('Test failed:', err);
    process.exitCode = 1;
  }
})();
