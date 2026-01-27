import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';
const userId = '70ee3f4d-fec6-42b0-a84b-f57c59134320';

async function testMembershipEndpoints() {
  try {
    console.log('Testing membership endpoints...\n');

    // Test 1: GET memberships for user
    console.log('1. Testing GET /api/admin/users/:id/memberships');
    const getMembershipResponse = await fetch(
      `${BASE_URL}/api/admin/users/${userId}/memberships`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`   Status: ${getMembershipResponse.status}`);
    const getMembershipData = await getMembershipResponse.json();
    console.log(`   Response:`, getMembershipData);

    if (getMembershipResponse.status === 200) {
      console.log('   ✅ GET memberships working!\n');
    } else {
      console.log('   ❌ GET memberships failed\n');
    }

    // Test 2: POST create membership
    console.log('2. Testing POST /api/admin/memberships');
    const postMembershipResponse = await fetch(
      `${BASE_URL}/api/admin/memberships`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          estateId: 'a92f385d-33db-4fd1-87f8-310e3854a51f',
          role: 'resident',
          isActive: true,
          permissions: ['view', 'submit_request'],
        }),
      }
    );

    console.log(`   Status: ${postMembershipResponse.status}`);
    const postMembershipData = await postMembershipResponse.json();
    console.log(`   Response:`, postMembershipData);

    if (postMembershipResponse.status === 201 || postMembershipResponse.status === 409) {
      console.log('   ✅ POST memberships working!\n');
    } else {
      console.log('   ❌ POST memberships failed\n');
    }

    console.log('✅ Membership endpoints test complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testMembershipEndpoints();
