#!/usr/bin/env node
/**
 * Phase B1: Workspace Management - Comprehensive Test Suite
 * AutoDiagram Video Generator - Iteration 67
 *
 * Tests:
 * - Module structure validation
 * - API server integration
 * - Workspace CRUD operations
 * - Member management
 * - Permission system
 * - Activity logging
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

// ============================================================================
// Test Configuration
// ============================================================================

const API_BASE_URL = 'http://localhost:3001';
const TEST_USER = {
  email: 'testuser@example.com',
  password: 'testpass123',
};

let authToken = '';
let testWorkspaceId = '';
let serverProcess = null;

// ============================================================================
// Test Results Tracking
// ============================================================================

const testResults = {
  passed: 0,
  failed: 0,
  tests: [],
};

function logTest(name, passed, details = '') {
  const status = passed ? '✅' : '❌';
  console.log(`${status} ${name}`);
  if (details && !passed) {
    console.log(`   Details: ${details}`);
  }
  testResults.tests.push({ name, passed, details });
  if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
}

// ============================================================================
// Phase 1: Module Structure Validation
// ============================================================================

async function testModuleStructure() {
  console.log('\n📦 Phase 1: Module Structure Validation');
  console.log('─'.repeat(70));

  const requiredFiles = [
    'src/types/workspace.ts',
    'src/services/workspace-manager.ts',
    'src/routes/workspace.routes.ts',
  ];

  for (const file of requiredFiles) {
    try {
      await fs.access(file);
      logTest(`Module file exists: ${file}`, true);
    } catch (error) {
      logTest(`Module file exists: ${file}`, false, error.message);
    }
  }

  // Check TypeScript compilation
  try {
    const { stdout, stderr } = await execAsync(
      'npx tsc --noEmit --skipLibCheck src/types/workspace.ts src/services/workspace-manager.ts src/routes/workspace.routes.ts'
    );
    logTest('TypeScript compilation', !stderr.includes('error'));
  } catch (error) {
    logTest('TypeScript compilation', false, error.message);
  }
}

// ============================================================================
// Phase 2: API Server Integration
// ============================================================================

async function startServer() {
  console.log('\n🚀 Starting API server...');

  const childProcess = await import('child_process');

  return new Promise((resolve, reject) => {
    serverProcess = childProcess.spawn('npm', ['run', 'api:server'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    let started = false;

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Server running on') && !started) {
        started = true;
        setTimeout(resolve, 1000); // Give server time to fully initialize
      }
    });

    serverProcess.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Error') && !started) {
        reject(new Error(output));
      }
    });

    setTimeout(() => {
      if (!started) {
        reject(new Error('Server failed to start within timeout'));
      }
    }, 10000);
  });
}

async function stopServer() {
  if (serverProcess) {
    console.log('\n🛑 Stopping API server...');
    serverProcess.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function testServerHealth() {
  console.log('\n🏥 Phase 2: API Server Health Check');
  console.log('─'.repeat(70));

  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    const data = await response.json();

    logTest(
      'Server health endpoint responds',
      response.status === 200 && data.success
    );
  } catch (error) {
    logTest('Server health endpoint responds', false, error.message);
  }
}

// ============================================================================
// Phase 3: Authentication
// ============================================================================

async function testAuthentication() {
  console.log('\n🔐 Phase 3: Authentication');
  console.log('─'.repeat(70));

  try {
    // Login
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_USER),
    });

    const data = await response.json();

    if (response.status === 200 && data.success && data.data.token) {
      authToken = data.data.token.token;
      logTest('User authentication successful', true);
    } else {
      logTest('User authentication successful', false, JSON.stringify(data));
    }
  } catch (error) {
    logTest('User authentication successful', false, error.message);
  }
}

// ============================================================================
// Phase 4: Workspace CRUD Operations
// ============================================================================

async function testWorkspaceCRUD() {
  console.log('\n🏢 Phase 4: Workspace CRUD Operations');
  console.log('─'.repeat(70));

  // Create workspace
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        name: 'Test Workspace',
        slug: 'test-workspace',
        description: 'A test workspace for Phase B1',
      }),
    });

    const data = await response.json();

    if (response.status === 201 && data.success && data.data.id) {
      testWorkspaceId = data.data.id;
      logTest(
        'Create workspace',
        true,
        `Created workspace: ${testWorkspaceId}`
      );
    } else {
      logTest('Create workspace', false, JSON.stringify(data));
    }
  } catch (error) {
    logTest('Create workspace', false, error.message);
  }

  // List workspaces
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/workspaces`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const data = await response.json();

    logTest(
      'List workspaces',
      response.status === 200 &&
        data.success &&
        data.data.workspaces.length > 0
    );
  } catch (error) {
    logTest('List workspaces', false, error.message);
  }

  // Get workspace details
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/workspaces/${testWorkspaceId}`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    const data = await response.json();

    logTest(
      'Get workspace details',
      response.status === 200 &&
        data.success &&
        data.data.id === testWorkspaceId
    );
  } catch (error) {
    logTest('Get workspace details', false, error.message);
  }

  // Update workspace
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/workspaces/${testWorkspaceId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: 'Updated Test Workspace',
          description: 'Updated description',
        }),
      }
    );

    const data = await response.json();

    logTest(
      'Update workspace',
      response.status === 200 &&
        data.success &&
        data.data.name === 'Updated Test Workspace'
    );
  } catch (error) {
    logTest('Update workspace', false, error.message);
  }
}

// ============================================================================
// Phase 5: Member Management
// ============================================================================

async function testMemberManagement() {
  console.log('\n👥 Phase 5: Member Management');
  console.log('─'.repeat(70));

  // Invite member
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/workspaces/${testWorkspaceId}/members/invite`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          email: 'newmember@example.com',
          role: 'editor',
          message: 'Welcome to the team!',
        }),
      }
    );

    const data = await response.json();

    logTest(
      'Invite workspace member',
      response.status === 201 && data.success && data.data.id
    );
  } catch (error) {
    logTest('Invite workspace member', false, error.message);
  }
}

// ============================================================================
// Phase 6: Activity Logging
// ============================================================================

async function testActivityLogging() {
  console.log('\n📝 Phase 6: Activity Logging');
  console.log('─'.repeat(70));

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/workspaces/${testWorkspaceId}/activities`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    const data = await response.json();

    logTest(
      'Get workspace activities',
      response.status === 200 &&
        data.success &&
        data.data.activities.length > 0
    );
  } catch (error) {
    logTest('Get workspace activities', false, error.message);
  }
}

// ============================================================================
// Phase 7: Permission System
// ============================================================================

async function testPermissionSystem() {
  console.log('\n🔒 Phase 7: Permission System');
  console.log('─'.repeat(70));

  // Test unauthorized access (no token)
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/workspaces/${testWorkspaceId}`,
      {
        headers: {}, // No auth header
      }
    );

    logTest(
      'Reject unauthorized workspace access',
      response.status === 401 || response.status === 403
    );
  } catch (error) {
    logTest('Reject unauthorized workspace access', false, error.message);
  }

  // Test invalid token
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/workspaces/${testWorkspaceId}`,
      {
        headers: { Authorization: 'Bearer invalid-token-12345' },
      }
    );

    logTest(
      'Reject invalid authentication token',
      response.status === 401 || response.status === 403
    );
  } catch (error) {
    logTest('Reject invalid authentication token', false, error.message);
  }
}

// ============================================================================
// Cleanup
// ============================================================================

async function cleanup() {
  console.log('\n🧹 Cleanup: Deleting test workspace');
  console.log('─'.repeat(70));

  if (testWorkspaceId && authToken) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/workspaces/${testWorkspaceId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      const data = await response.json();

      logTest(
        'Delete test workspace',
        response.status === 200 && data.success
      );
    } catch (error) {
      logTest('Delete test workspace', false, error.message);
    }
  }
}

// ============================================================================
// Report Generation
// ============================================================================

async function generateReport() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 Phase B1 Test Results Summary');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`✅ Passed: ${testResults.passed}/${testResults.tests.length}`);
  console.log(`❌ Failed: ${testResults.failed}/${testResults.tests.length}`);
  console.log(
    `📈 Success Rate: ${((testResults.passed / testResults.tests.length) * 100).toFixed(1)}%`
  );
  console.log('═══════════════════════════════════════════════════════════════');

  const report = {
    timestamp: new Date().toISOString(),
    phase: 'B1 - Workspace Management',
    summary: {
      total: testResults.tests.length,
      passed: testResults.passed,
      failed: testResults.failed,
      successRate: (testResults.passed / testResults.tests.length) * 100,
    },
    tests: testResults.tests,
  };

  const reportPath = `phase-b1-test-report-${Date.now()}.json`;
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n📄 Detailed report saved to: ${reportPath}\n`);

  return testResults.failed === 0;
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function runTests() {
  console.log('🚀 Phase B1: Workspace Management - Test Suite');
  console.log('AutoDiagram Video Generator - Iteration 67');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // Phase 1: Module structure
    await testModuleStructure();

    // Phase 2: Start server and health check
    await startServer();
    await testServerHealth();

    // Phase 3: Authentication
    await testAuthentication();

    // Phase 4: Workspace CRUD
    await testWorkspaceCRUD();

    // Phase 5: Member management
    await testMemberManagement();

    // Phase 6: Activity logging
    await testActivityLogging();

    // Phase 7: Permission system
    await testPermissionSystem();

    // Cleanup
    await cleanup();

    // Generate report
    const allPassed = generateReport();

    // Stop server
    await stopServer();

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('❌ Test suite error:', error);
    await stopServer();
    process.exit(1);
  }
}

// Run tests
runTests();
