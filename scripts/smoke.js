(async ()=>{
  const urls = [
    'http://localhost:5000/',
    'http://localhost:5000/api',
    'http://localhost:5000/api/health',
    'http://localhost:5000/api/admin/users'
  ];

  for (const u of urls) {
    try {
      const res = await fetch(u, { method: 'GET' });
      console.log(u, '=>', res.status);
      const text = await res.text().catch(()=>null);
      if (text && text.length < 500) console.log('  body:', text);
    } catch (e) {
      console.log(u, '=> ERROR', e && e.message ? e.message : e);
      console.error(e);
    }
  }
})();
