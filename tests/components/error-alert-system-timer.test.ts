/**
 * Static-analysis test verifying ErrorAlertSystem.tsx no longer has
 * untracked setTimeout calls inside state updater functions.
 *
 * Bug: setTimeout was called inside setAlerts(prev => {...}) which is a
 * React anti-pattern (side effects in reducers) and the timer was not
 * tracked for cleanup, causing potential setState-after-unmount.
 *
 * Fix: setTimeout is now called outside the state updater, tracked in a
 * useRef Set, and cleared in the useEffect cleanup function.
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
    // Check that setTimeout is NOT between setAlerts(prev => { and the matching return
    const setAlertsMatch = content.match(/setAlerts\(prev\s*=>\s*\{[\s\S]*?\}\)/);
    if (setAlertsMatch) {
      expect(setAlertsMatch[0]).not.toContain('setTimeout');
    }
  });

  it('should track auto-hide timers in a ref for cleanup', () => {
    expect(content).toContain('autoHideTimers');
    expect(content).toMatch(/autoHideTimers\s*=\s*useRef/);
  });

  it('should clear all tracked timers in useEffect cleanup', () => {
    expect(content).toContain('autoHideTimers.current.forEach');
    expect(content).toContain('clearTimeout');
    expect(content).toContain('autoHideTimers.current.clear()');
  });

  it('should add timers to the tracking set when created', () => {
    expect(content).toContain('autoHideTimers.current.add(timer)');
  });

  it('should remove timers from tracking set after they fire', () => {
    expect(content).toContain('autoHideTimers.current.delete(timer)');
  });
});
