/**
 * Static-analysis test verifying ErrorAlertSystem.tsx properly tracks
 * and cleans up setTimeout calls to prevent timer leaks.
 *
 * The component uses a local Set<ReturnType<typeof setTimeout>> inside
 * useEffect to track auto-hide timers, and clears them in cleanup.
 */
import * as fs from 'fs';
import * as path from 'path';

function findProjectRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 20; i++) {
    if (fs.existsSync(path.join(dir, 'jest.config.cjs'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

describe('ErrorAlertSystem timer leak fix', () => {
  const projectRoot = findProjectRoot();
  const filePath = path.join(projectRoot, 'src/components/ErrorAlertSystem.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  it('should not call setTimeout inside a state updater function', () => {
    // The anti-pattern is: setSomething(prev => { ... setTimeout(...) ... })
    const setAlertsMatch = content.match(/setAlerts\(prev\s*=>\s*\{[\s\S]*?\}\)/);
    if (setAlertsMatch) {
      expect(setAlertsMatch[0]).not.toContain('setTimeout');
    }
  });

  it('should track timers in a Set for cleanup', () => {
    expect(content).toMatch(/Set<ReturnType<typeof setTimeout>>/);
  });

  it('should add timers to the tracking set when created', () => {
    expect(content).toContain('timers.add(timer)');
  });

  it('should remove timers from tracking set after they fire', () => {
    expect(content).toContain('timers.delete(timer)');
  });

  it('should clear all tracked timers in useEffect cleanup', () => {
    expect(content).toContain('timers.forEach');
    expect(content).toContain('clearTimeout');
  });
});
