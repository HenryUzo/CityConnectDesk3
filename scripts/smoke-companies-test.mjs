import http from 'http';

const candidates = ['http://127.0.0.1:5000', 'http://localhost:5000', 'http://[::1]:5000'];

let base = candidates[0];

async function chooseBase() {
  for (const c of candidates) {
    try {
      const res = await fetch(new URL('/health', c).toString(), { method: 'GET' });
      if (res.ok) {
        base = c;
        return;
      }
    } catch (e) {
      // try next
    }
  }
}

async function req(path, opts = {}) {
  const url = new URL(path, base);
  const res = await fetch(url.toString(), opts);
  const text = await res.text();
  let body = text;
  try { body = JSON.parse(text); } catch {}
  return { status: res.status, ok: res.ok, body };
}

// try to pick a reachable base (health endpoint)
(async () => {
  await chooseBase();
  console.log('using base:', base);
  try {
    console.log('GET /api/admin/companies');
    const list = await req('/api/admin/companies');
    console.log('->', list.status, JSON.stringify(list.body));

    if (Array.isArray(list.body) && list.body.length) {
      const id = list.body[0].id;
      console.log('GET /api/admin/companies/' + id);
      const one = await req('/api/admin/companies/' + id);
      console.log('->', one.status, JSON.stringify(one.body));

      console.log('PUT /api/admin/companies/' + id + ' (update name)');
      const put = await req('/api/admin/companies/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'SMOKE TEST ' + Date.now() })
      });
      console.log('->', put.status, JSON.stringify(put.body));
    }
  } catch (err) {
    console.error('Error during smoke test', err);
    process.exitCode = 2;
  }
})();
