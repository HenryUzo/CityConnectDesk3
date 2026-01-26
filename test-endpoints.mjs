import http from 'http';

const testEndpoints = async () => {
  const endpoints = [
    { method: 'GET', path: '/api/admin/categories', name: 'GET Categories' },
    { method: 'GET', path: '/api/admin/estates', name: 'GET Estates' },
    { method: 'GET', path: '/api/admin/audit-logs', name: 'GET Audit Logs' },
    { method: 'GET', path: '/api/admin/dashboard/stats', name: 'GET Dashboard Stats' }
  ];

  for (const endpoint of endpoints) {
    console.log(`\nTesting: ${endpoint.name} (${endpoint.method} ${endpoint.path})`);
    
    const options = {
      hostname: '127.0.0.1',
      port: 5000,
      path: endpoint.path,
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    await new Promise((resolve) => {
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          console.log(`Status: ${res.statusCode}`);
          if (res.statusCode === 200 || res.statusCode === 401) {
            try {
              const json = JSON.parse(data);
              console.log('Response:', JSON.stringify(json, null, 2).substring(0, 200) + '...');
            } catch {
              console.log('Response:', data.substring(0, 200));
            }
          } else {
            console.log('Response:', data.substring(0, 200));
          }
          resolve();
        });
      });

      req.on('error', (e) => {
        console.log('Error:', e.message);
        resolve();
      });

      req.end();
    });
  }
};

testEndpoints().then(() => {
  console.log('\n✓ Testing complete');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
