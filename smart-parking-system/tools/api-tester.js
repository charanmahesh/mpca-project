#!/usr/bin/env node
/**
 * API Tester - Test all parking system endpoints
 * 
 * Usage:
 *   npm run api:test
 * 
 * Tests:
 *   - Health check
 *   - User balance
 *   - Entry/exit simulation
 *   - Session history
 *   - Transaction log
 */

const http = require('http');
const BASE_URL = 'http://localhost:3000/api/parking';

const tests = [];

// Utility: Make HTTP request
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: JSON.parse(data),
            headers: res.headers
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            body: data,
            headers: res.headers
          });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Test runner
async function runTests() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 Smart Parking API Test Suite');
  console.log('='.repeat(70));
  console.log(`Base URL: ${BASE_URL}\n`);

  let passed = 0, failed = 0;

  for (const test of tests) {
    try {
      console.log(`\n📝 ${test.name}`);
      const result = await test.fn();
      if (result) {
        console.log(`   ✅ PASSED`);
        passed++;
      } else {
        console.log(`   ❌ FAILED`);
        failed++;
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`📊 Results: ${passed} passed, ${failed} failed out of ${tests.length}`);
  console.log('='.repeat(70) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

// Define tests
tests.push({
  name: 'Health Check - GET /health',
  fn: async () => {
    const res = await request('GET', '/health');
    console.log(`   Status: ${res.status}`);
    console.log(`   Response: ${JSON.stringify(res.body)}`);
    return res.status === 200 && res.body.status === 'ok';
  }
});

tests.push({
  name: 'Get Active Sessions - GET /active',
  fn: async () => {
    const res = await request('GET', '/active');
    console.log(`   Status: ${res.status}`);
    console.log(`   Sessions: ${res.body.data?.length || 0}`);
    return res.status === 200 && Array.isArray(res.body.data);
  }
});

tests.push({
  name: 'Check User Balance - GET /users/A1B2C3D4/balance',
  fn: async () => {
    const res = await request('GET', '/users/A1B2C3D4/balance');
    console.log(`   Status: ${res.status}`);
    console.log(`   Balance: ₹${res.body.data?.balance}`);
    return res.status === 200 && res.body.data?.balance !== undefined;
  }
});

tests.push({
  name: 'Get Session History - GET /users/A1B2C3D4/sessions',
  fn: async () => {
    const res = await request('GET', '/users/A1B2C3D4/sessions');
    console.log(`   Status: ${res.status}`);
    console.log(`   Sessions: ${res.body.data?.length || 0}`);
    return res.status === 200 && Array.isArray(res.body.data);
  }
});

tests.push({
  name: 'List All Users - GET /users',
  fn: async () => {
    const res = await request('GET', '/users');
    console.log(`   Status: ${res.status}`);
    console.log(`   Users: ${res.body.data?.length || 0}`);
    return res.status === 200 && Array.isArray(res.body.data);
  }
});

tests.push({
  name: 'Topup User Balance - POST /users/A1B2C3D4/topup',
  fn: async () => {
    const res = await request('POST', '/users/A1B2C3D4/topup', {
      amount: 100,
      reason: 'API Test'
    });
    console.log(`   Status: ${res.status}`);
    console.log(`   New Balance: ₹${res.body.data?.new_balance}`);
    return res.status === 200 && res.body.success === true;
  }
});

tests.push({
  name: 'Invalid Input - POST /users/invalid/topup',
  fn: async () => {
    const res = await request('POST', '/users/invalid/topup', {
      amount: 'not-a-number'
    });
    console.log(`   Status: ${res.status}`);
    console.log(`   Error: ${res.body.message}`);
    return res.status === 400; // Should reject invalid input
  }
});

// Start tests
if (require.main === module) {
  runTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { request, runTests };
