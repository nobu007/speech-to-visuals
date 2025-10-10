#!/usr/bin/env node
/**
 * Iteration 67 Phase B2: API Server Test Script
 * カスタムインストラクション準拠 - 段階的APIテスト
 *
 * 目的: APIサーバーが正常に起動し、全エンドポイントが動作するか検証
 */

interface TestResult {
  endpoint: string;
  method: string;
  status: 'pass' | 'fail';
  responseTime: number;
  statusCode?: number;
  error?: string;
}

interface APITestSummary {
  timestamp: string;
  iteration: string;
  totalTests: number;
  passed: number;
  failed: number;
  successRate: number;
  results: TestResult[];
}

/**
 * Wait for server to be ready
 */
async function waitForServer(url: string, maxRetries = 10): Promise<boolean> {
  console.log(`🔄 Waiting for server at ${url}...\n`);

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log(`✅ Server is ready!\n`);
        return true;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
    process.stdout.write(`  Attempt ${i + 1}/${maxRetries}...\r`);
  }

  console.log(`\n❌ Server failed to start within ${maxRetries} seconds\n`);
  return false;
}

/**
 * Test helper function
 */
async function testEndpoint(
  url: string,
  method: string = 'GET',
  body?: any,
  headers?: Record<string, string>
): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const responseTime = Date.now() - startTime;

    return {
      endpoint: url,
      method,
      status: response.ok ? 'pass' : 'fail',
      responseTime,
      statusCode: response.status
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;

    return {
      endpoint: url,
      method,
      status: 'fail',
      responseTime,
      error: error.message
    };
  }
}

/**
 * Iteration 1: Health Check Test
 */
async function testIteration1(baseUrl: string): Promise<TestResult[]> {
  console.log('[Iteration 67.B2.Test.1] ヘルスチェックエンドポイントのテスト中...\n');

  const results: TestResult[] = [];

  // Test 1: Main health endpoint
  const healthResult = await testEndpoint(`${baseUrl}/health`);
  results.push(healthResult);

  if (healthResult.status === 'pass') {
    console.log(`  ✅ /health - ${healthResult.statusCode} (${healthResult.responseTime}ms)`);
  } else {
    console.log(`  ❌ /health - Failed: ${healthResult.error || healthResult.statusCode}`);
  }

  return results;
}

/**
 * Iteration 2: Authentication Endpoints Test
 */
async function testIteration2(baseUrl: string): Promise<TestResult[]> {
  console.log('\n[Iteration 67.B2.Test.2] 認証エンドポイントのテスト中...\n');

  const results: TestResult[] = [];

  // Test 1: Register endpoint (expect to work)
  const registerResult = await testEndpoint(
    `${baseUrl}/api/v1/auth/register`,
    'POST',
    {
      email: `test-${Date.now()}@example.com`,
      password: 'Test123!@#',
      name: 'Test User'
    }
  );
  results.push(registerResult);

  if (registerResult.status === 'pass') {
    console.log(`  ✅ POST /api/v1/auth/register - ${registerResult.statusCode} (${registerResult.responseTime}ms)`);
  } else {
    console.log(`  ⚠️  POST /api/v1/auth/register - ${registerResult.statusCode} (${registerResult.responseTime}ms)`);
  }

  // Test 2: Login endpoint (expect to work with test credentials)
  const loginResult = await testEndpoint(
    `${baseUrl}/api/v1/auth/login`,
    'POST',
    {
      email: 'test@example.com',
      password: 'password123'
    }
  );
  results.push(loginResult);

  if (loginResult.statusCode === 200 || loginResult.statusCode === 401) {
    console.log(`  ✅ POST /api/v1/auth/login - ${loginResult.statusCode} (${loginResult.responseTime}ms)`);
  } else {
    console.log(`  ⚠️  POST /api/v1/auth/login - ${loginResult.statusCode} (${loginResult.responseTime}ms)`);
  }

  return results;
}

/**
 * Iteration 3: Workspace Endpoints Test
 */
async function testIteration3(baseUrl: string): Promise<TestResult[]> {
  console.log('\n[Iteration 67.B2.Test.3] ワークスペースエンドポイントのテスト中...\n');

  const results: TestResult[] = [];

  // For workspace tests, we need a token
  // We'll test the endpoint existence, not full functionality
  const testToken = 'test-token-for-endpoint-check';

  // Test 1: List workspaces endpoint
  const listResult = await testEndpoint(
    `${baseUrl}/api/v1/workspaces`,
    'GET',
    undefined,
    { 'Authorization': `Bearer ${testToken}` }
  );
  results.push(listResult);

  // Expect 401 (unauthorized) which means endpoint exists
  if (listResult.statusCode === 401 || listResult.statusCode === 200) {
    console.log(`  ✅ GET /api/v1/workspaces - Endpoint exists (${listResult.responseTime}ms)`);
  } else {
    console.log(`  ⚠️  GET /api/v1/workspaces - ${listResult.statusCode} (${listResult.responseTime}ms)`);
  }

  // Test 2: Create workspace endpoint
  const createResult = await testEndpoint(
    `${baseUrl}/api/v1/workspaces`,
    'POST',
    {
      name: 'Test Workspace',
      slug: 'test-workspace'
    },
    { 'Authorization': `Bearer ${testToken}` }
  );
  results.push(createResult);

  if (createResult.statusCode === 401 || createResult.statusCode === 200 || createResult.statusCode === 201) {
    console.log(`  ✅ POST /api/v1/workspaces - Endpoint exists (${createResult.responseTime}ms)`);
  } else {
    console.log(`  ⚠️  POST /api/v1/workspaces - ${createResult.statusCode} (${createResult.responseTime}ms)`);
  }

  return results;
}

/**
 * Iteration 4: Performance Metrics
 */
async function testIteration4(baseUrl: string): Promise<TestResult[]> {
  console.log('\n[Iteration 67.B2.Test.4] パフォーマンスメトリクスの測定中...\n');

  const results: TestResult[] = [];

  // Run health check 10 times to measure average response time
  const iterations = 10;
  const healthResults: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const result = await testEndpoint(`${baseUrl}/health`);
    healthResults.push(result.responseTime);
  }

  const avgResponseTime = healthResults.reduce((a, b) => a + b, 0) / healthResults.length;
  const minResponseTime = Math.min(...healthResults);
  const maxResponseTime = Math.max(...healthResults);

  console.log(`  📊 Health Endpoint Performance (${iterations} requests):`);
  console.log(`     Average: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`     Min: ${minResponseTime}ms`);
  console.log(`     Max: ${maxResponseTime}ms`);

  // Performance criteria: average response time should be < 100ms
  if (avgResponseTime < 100) {
    console.log(`     ✅ Performance target met (< 100ms)`);
    results.push({
      endpoint: `${baseUrl}/health (avg)`,
      method: 'GET',
      status: 'pass',
      responseTime: avgResponseTime
    });
  } else {
    console.log(`     ⚠️  Performance target not met (>= 100ms)`);
    results.push({
      endpoint: `${baseUrl}/health (avg)`,
      method: 'GET',
      status: 'fail',
      responseTime: avgResponseTime,
      error: 'Average response time exceeds 100ms'
    });
  }

  return results;
}

/**
 * Main test execution
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🧪 Iteration 67 Phase B2: API Server Test');
  console.log('   カスタムインストラクション準拠 - 段階的APIテスト');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const baseUrl = process.env.API_URL || 'http://localhost:3001';

  // Wait for server
  const serverReady = await waitForServer(`${baseUrl}/health`);

  if (!serverReady) {
    console.log('❌ Server is not running. Please start the server first with:');
    console.log('   npm run api:dev\n');
    process.exit(1);
  }

  const allResults: TestResult[] = [];

  // Iteration 1: Health Check
  const iter1Results = await testIteration1(baseUrl);
  allResults.push(...iter1Results);

  // Only proceed if health check passed
  if (iter1Results.every(r => r.status === 'pass')) {
    // Iteration 2: Authentication
    const iter2Results = await testIteration2(baseUrl);
    allResults.push(...iter2Results);

    // Iteration 3: Workspace
    const iter3Results = await testIteration3(baseUrl);
    allResults.push(...iter3Results);

    // Iteration 4: Performance
    const iter4Results = await testIteration4(baseUrl);
    allResults.push(...iter4Results);
  } else {
    console.log('\n⚠️ Health check failed. Skipping remaining tests.\n');
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 API Test Results Summary');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const passed = allResults.filter(r => r.status === 'pass').length;
  const failed = allResults.filter(r => r.status === 'fail').length;
  const total = allResults.length;
  const successRate = (passed / total) * 100;

  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${failed}/${total}`);
  console.log(`📈 Success Rate: ${successRate.toFixed(1)}%\n`);

  // Failed tests detail
  if (failed > 0) {
    console.log('❌ Failed Tests:');
    allResults
      .filter(r => r.status === 'fail')
      .forEach(r => {
        console.log(`  - ${r.method} ${r.endpoint}`);
        if (r.error) console.log(`    Error: ${r.error}`);
        if (r.statusCode) console.log(`    Status: ${r.statusCode}`);
      });
    console.log();
  }

  // Next steps
  console.log('📋 Next Steps:');
  if (successRate >= 90) {
    console.log('  ✅ API server is healthy and ready');
    console.log('  1. Proceed with Phase B2 implementation');
    console.log('  2. Enhance quality monitoring');
    console.log('  3. Add comprehensive integration tests');
  } else {
    console.log('  ⚠️  API server needs attention');
    console.log('  1. Review failed endpoints');
    console.log('  2. Fix issues and restart server');
    console.log('  3. Re-run this test script');
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');

  // Save report
  const summary: APITestSummary = {
    timestamp: new Date().toISOString(),
    iteration: '67.B2.Test',
    totalTests: total,
    passed,
    failed,
    successRate,
    results: allResults
  };

  const fs = await import('fs/promises');
  const reportPath = `api-test-report-iteration-67-b2-${Date.now()}.json`;
  await fs.writeFile(reportPath, JSON.stringify(summary, null, 2));
  console.log(`💾 Test report saved: ${reportPath}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

// Execute
main().catch(error => {
  console.error('❌ Test script error:', error);
  process.exit(1);
});
