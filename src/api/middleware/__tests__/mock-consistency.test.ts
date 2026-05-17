/**
 * REQ-112: jsonwebtoken モック整合性自動検証
 *
 * Verifies that the manual mock at tests/mocks/jsonwebtoken.ts stays aligned
 * with the JWT methods actually used by auth.ts.  If auth.ts starts using
 * a new JWT method (e.g. jwt.decode) that the mock doesn't provide, this
 * test will fail — preventing false-green tests.
 *
 * TC-112-01: Mock exports verify/sign/decode
 * TC-112-02: auth.ts jwt.verify usage maps to mock's verify
 * TC-112-E01: Missing mock method detection (fail-safe)
 */
import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

const projectRoot = process.cwd();

// ---------------------------------------------------------------------------
// TC-112-01: Verify mock file exports the expected functions
// ---------------------------------------------------------------------------

describe('REQ-112: jsonwebtoken mock consistency', () => {
  const mockPath = path.resolve(projectRoot, 'tests', 'mocks', 'jsonwebtoken.ts');
  const authPath = path.resolve(projectRoot, 'src', 'api', 'middleware', 'auth.ts');

  it('TC-112-01: mock exports verify, sign, and decode as jest.fn()', async () => {
    // Dynamic-import the mock to check its exports
    const mock = await import(mockPath);

    // Named exports
    expect(typeof mock.verify).toBe('function');
    expect(typeof mock.sign).toBe('function');
    expect(typeof mock.decode).toBe('function');

    // Default export
    expect(mock.default).toBeDefined();
    expect(typeof mock.default.verify).toBe('function');
    expect(typeof mock.default.sign).toBe('function');
    expect(typeof mock.default.decode).toBe('function');
  });

  it('TC-112-02: auth.ts uses jwt.verify which maps to mock verify', async () => {
    const authSource = fs.readFileSync(authPath, 'utf-8');

    // Verify auth.ts imports and uses jwt.verify
    expect(authSource).toMatch(/import\s+\*\s+as\s+jwt\s+from\s+['"]jsonwebtoken['"]/);
    expect(authSource).toMatch(/jwt\.verify\s*\(/);

    // Load the mock and confirm verify is present
    const mock = await import(mockPath);
    expect(mock.verify).toBeDefined();
    expect(typeof mock.verify).toBe('function');
  });

  it('TC-112-E01: detects if auth.ts uses a JWT method not present in mock', async () => {
    const authSource = fs.readFileSync(authPath, 'utf-8');
    const mockSource = fs.readFileSync(mockPath, 'utf-8');

    // Extract all jwt.XXX() calls from auth.ts
    const jwtMethodCalls = authSource.match(/jwt\.\w+\s*\(/g) ?? [];
    const usedMethods = [...new Set(
      jwtMethodCalls.map(call => call.replace(/jwt\./, '').replace(/\s*\($/, ''))
    )];

    // Extract all exported function names from mock
    // Matches patterns: `const verify = jest.fn()` and `export { verify, sign, decode }`
    const constDeclarations = mockSource.match(/const\s+(\w+)\s*=\s*jest\.fn\(\)/g) ?? [];
    const mockMethodNames = new Set(
      constDeclarations.map(d => d.replace(/const\s+/, '').replace(/\s*=\s*jest\.fn\(\)/, ''))
    );

    // Every JWT method used in auth.ts must be present in the mock
    const missingMethods = usedMethods.filter(m => !mockMethodNames.has(m));
    expect(missingMethods).toEqual([]);
    // Descriptive error via explicit check
    if (missingMethods.length > 0) {
      // This line is unreachable when the test passes, but provides context on failure
      throw new Error(
        `auth.ts uses jwt.${missingMethods.join('(), jwt.')}() but ` +
        `tests/mocks/jsonwebtoken.ts does not export them. ` +
        `Add the missing methods to the mock to prevent false-green tests.`
      );
    }
  });
});
