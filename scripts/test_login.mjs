async function post(url, body) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include'
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch(e) { json = text; }
    return { status: res.status, ok: res.ok, body: json };
  } catch(e) {
    console.error('Fetch error:', e.message);
    console.error('Error code:', e.code);
    return { status: 0, ok: false, error: e.message, code: e.code };
  }
}

(async () => {
  const base = 'http://localhost:5000';
  const username = 'testuser@example.com';
  const password = 'TestPass123!';
  
  console.log('\n🔐 Testing Login Flow\n');
  
  console.log(`POST /api/login`);
  console.log(`  Username: ${username}`);
  console.log(`  Password: ${password}`);
  
  const login = await post(`${base}/api/login`, { username, password });
  console.log(`\nResponse: ${login.status}`);
  console.log(JSON.stringify(login.body, null, 2));
  
  if (login.ok) {
    console.log('\n✓ Login successful!');
    console.log('\nGET /api/user (should return logged-in user)');
    const user = await post(`${base}/api/user`, null);
    console.log(`Response: ${user.status}`);
    console.log(JSON.stringify(user.body, null, 2));
  } else {
    console.log('\n✗ Login failed with status', login.status);
  }
})();
