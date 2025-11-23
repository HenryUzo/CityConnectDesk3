import fetch from 'node-fetch';

(async () => {
  try {
    const res = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pgadmin@cityconnect.com', password: 'PgAdmin123!' }),
    });
    console.log('status', res.status, res.statusText);
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const body = await res.json();
      console.log('body:', JSON.stringify(body, null, 2));
    } else {
      const text = await res.text();
      console.log('body(text):', text.slice(0, 1000));
    }
  } catch (err) {
    console.error('request error:', err);
  }
})();
