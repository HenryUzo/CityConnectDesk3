#!/usr/bin/env node

const API_BASE = 'http://localhost:5000';

async function testCompaniesEndpoint() {
  try {
    console.log('Testing GET /api/admin/companies...');
    const response = await fetch(`${API_BASE}/api/admin/companies`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
    });
    
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('✓ Companies endpoint working!');
      console.log('Companies count:', Array.isArray(data) ? data.length : 'N/A');
    } else {
      console.log('✗ Error response:', response.status, data);
    }
  } catch (error) {
    console.error('✗ Request failed:', error.message);
  }
}

testCompaniesEndpoint().catch(console.error);
