#!/usr/bin/env node
/**
 * Phase B1: Workspace Management - Simple Test
 * Quick validation without server restart
 */

const API_BASE_URL = 'http://localhost:3001';
const TEST_USER = {
  email: 'demo@example.com',  // Using hardcoded demo user from auth.routes.ts
  password: 'demo123',
};

let authToken = '';
let testWorkspaceId = '';
let passed = 0;
let failed = 0;

function log(name, success, details = '') {
  const status = success ? '✅' : '❌';
  console.log(`${status} ${name}`);
  if (details && !success) console.log(`   ${details}`);
  if (success) passed++;
  else failed++;
}

async function test() {
  console.log('🚀 Phase B1: Workspace Management - Quick Test\n');

  // 1. Health check
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    const data = await res.json();
    log('Server health check', res.ok && data.success);
  } catch (e) {
    log('Server health check', false, e.message);
    return;
  }

  // 2. Login
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_USER),
    });
    const data = await res.json();
    if (res.ok && data.data?.token?.token) {
      authToken = data.data.token.token;
      log('User authentication', true);
    } else {
      log('User authentication', false, JSON.stringify(data));
      return;
    }
  } catch (e) {
    log('User authentication', false, e.message);
    return;
  }

  // 3. Create workspace
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        name: 'Test Workspace Phase B1',
        slug: 'test-workspace-b1',
        description: 'Testing workspace management',
      }),
    });
    const data = await res.json();
    if (res.status === 201 && data.data?.id) {
      testWorkspaceId = data.data.id;
      log('Create workspace', true);
    } else {
      log('Create workspace', false, JSON.stringify(data));
    }
  } catch (e) {
    log('Create workspace', false, e.message);
  }

  // 4. List workspaces
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/workspaces`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();
    log(
      'List workspaces',
      res.ok && data.data?.workspaces?.length > 0
    );
  } catch (e) {
    log('List workspaces', false, e.message);
  }

  // 5. Get workspace
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/workspaces/${testWorkspaceId}`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );
    const data = await res.json();
    log('Get workspace details', res.ok && data.data?.id === testWorkspaceId);
  } catch (e) {
    log('Get workspace details', false, e.message);
  }

  // 6. Update workspace
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/workspaces/${testWorkspaceId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: 'Updated Workspace',
          description: 'Updated via API',
        }),
      }
    );
    const data = await res.json();
    log('Update workspace', res.ok && data.data?.name === 'Updated Workspace');
  } catch (e) {
    log('Update workspace', false, e.message);
  }

  // 7. Invite member
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/workspaces/${testWorkspaceId}/members/invite`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          email: 'member@example.com',
          role: 'editor',
        }),
      }
    );
    const data = await res.json();
    log('Invite member', res.status === 201 && data.success);
  } catch (e) {
    log('Invite member', false, e.message);
  }

  // 8. Get activities
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/workspaces/${testWorkspaceId}/activities`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );
    const data = await res.json();
    log('Get workspace activities', res.ok && data.data?.activities?.length > 0);
  } catch (e) {
    log('Get workspace activities', false, e.message);
  }

  // 9. Permission test - unauthorized access
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/workspaces/${testWorkspaceId}`
    );
    log('Reject unauthorized access', res.status === 401 || res.status === 403);
  } catch (e) {
    log('Reject unauthorized access', false, e.message);
  }

  // 10. Delete workspace (cleanup)
  if (testWorkspaceId) {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/workspaces/${testWorkspaceId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      log('Delete workspace', res.ok);
    } catch (e) {
      log('Delete workspace', false, e.message);
    }
  }

  // Results
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 Phase B1 Test Results');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`✅ Passed: ${passed}/${passed + failed}`);
  console.log(`❌ Failed: ${failed}/${passed + failed}`);
  console.log(
    `📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`
  );
  console.log('═══════════════════════════════════════════════════════════\n');

  const report = {
    timestamp: new Date().toISOString(),
    phase: 'B1 - Workspace Management',
    passed,
    failed,
    total: passed + failed,
    successRate: (passed / (passed + failed)) * 100,
  };

  await import('fs/promises').then((fs) =>
    fs.writeFile(
      `phase-b1-test-result-${Date.now()}.json`,
      JSON.stringify(report, null, 2)
    )
  );

  process.exit(failed === 0 ? 0 : 1);
}

test();
