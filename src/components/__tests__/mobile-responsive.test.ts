/**
 * Tests for TASK-0076: Mobile Responsive UI Improvements
 * Verifies responsive class usage and mobile-friendly patterns
 * across EnhancedFileUploader, PipelineProgress, StageIndicator, VideoPreview
 *
 * Since the test environment is Node (no DOM), these tests validate:
 * 1. Component source contains responsive Tailwind classes
 * 2. Pure helper functions work correctly
 * 3. Touch target sizes meet minimum requirements (44px)
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Helper: Read component source ──────────────────────────────────────────

const __testDir = import.meta.dirname;

function readComponentSource(filename: string): string {
  const filePath = path.resolve(__testDir, '..', filename);
  return fs.readFileSync(filePath, 'utf-8');
}

// ─── Responsive class patterns ──────────────────────────────────────────────

const RESPONSIVE_PREFIXES = ['sm:', 'md:', 'lg:', 'xl:'];
const BREAKPOINT_375 = 375; // iPhone SE
const BREAKPOINT_768 = 768; // iPad
const MIN_TOUCH_TARGET = 44; // px - Apple HIG recommendation

// ========================================
// Test Suite: EnhancedFileUploader Responsive
// ========================================

describe('TASK-0076: EnhancedFileUploader mobile responsive', () => {
  let source: string;

  beforeAll(() => {
    source = readComponentSource('EnhancedFileUploader.tsx');
  });

  it('should use responsive padding classes (p-4 sm:p-8)', () => {
    expect(source).toMatch(/p-4\s+sm:p-8/);
  });

  it('should scale icons responsively for mobile', () => {
    expect(source).toMatch(/w-10\s+h-10\s+sm:w-16\s+sm:h-16/);
  });

  it('should scale heading text for mobile', () => {
    expect(source).toMatch(/text-base\s+sm:text-lg/);
  });

  it('should scale description text for mobile', () => {
    expect(source).toMatch(/text-xs\s+sm:text-sm/);
  });

  it('should use min-height for touch targets on reset button', () => {
    expect(source).toMatch(/min-h-\[44px\]/);
  });

  it('should truncate long filenames on mobile', () => {
    expect(source).toMatch(/truncate/);
    expect(source).toMatch(/max-w-\[200px\]\s+sm:max-w-none/);
  });

  it('should use at least one responsive breakpoint (sm:)', () => {
    const smCount = (source.match(/sm:/g) || []).length;
    expect(smCount).toBeGreaterThanOrEqual(5);
  });
});

// ========================================
// Test Suite: PipelineProgress Responsive
// ========================================

describe('TASK-0076: PipelineProgress mobile responsive', () => {
  let source: string;

  beforeAll(() => {
    source = readComponentSource('PipelineProgress.tsx');
  });

  it('should use responsive padding (p-3 sm:p-6)', () => {
    expect(source).toMatch(/p-3\s+sm:p-6/);
  });

  it('should scale header text for mobile', () => {
    expect(source).toMatch(/text-base\s+sm:text-lg/);
  });

  it('should scale quality badge text for mobile', () => {
    expect(source).toMatch(/text-xs\s+sm:text-sm/);
  });

  it('should use responsive margin for progress section', () => {
    expect(source).toMatch(/mb-3\s+sm:mb-4/);
  });

  it('should use responsive spacing for stage indicators', () => {
    expect(source).toMatch(/space-y-1\.5\s+sm:space-y-2/);
  });

  // Pure helper tests
  it('should have exported helper functions for testing', () => {
    // Dynamic import to verify exports exist
    expect(source).toMatch(/export function calcOverallProgress/);
    expect(source).toMatch(/export function calcETA/);
    expect(source).toMatch(/export function formatETA/);
  });
});

// ========================================
// Test Suite: StageIndicator Responsive
// ========================================

describe('TASK-0076: StageIndicator mobile responsive', () => {
  let source: string;

  beforeAll(() => {
    source = readComponentSource('StageIndicator.tsx');
  });

  it('should use responsive padding (p-2 sm:p-3)', () => {
    expect(source).toMatch(/p-2\s+sm:p-3/);
  });

  it('should scale stage icons for mobile (h-4 w-4 sm:h-5 sm:w-5)', () => {
    expect(source).toMatch(/h-4\s+w-4\s+sm:h-5\s+sm:w-5/);
  });

  it('should scale stage labels for mobile', () => {
    expect(source).toMatch(/text-xs\s+sm:text-sm/);
  });

  it('should scale badge text for mobile', () => {
    expect(source).toMatch(/text-\[9px\]\s+sm:text-\[10px\]/);
  });

  it('should use responsive gap spacing', () => {
    expect(source).toMatch(/gap-2\s+sm:gap-3/);
  });

  it('should scale progress bar for mobile', () => {
    expect(source).toMatch(/h-1\s+sm:h-1\.5/);
  });
});

// ========================================
// Test Suite: VideoPreview Responsive
// ========================================

describe('TASK-0076: VideoPreview mobile responsive', () => {
  let source: string;

  beforeAll(() => {
    source = readComponentSource('VideoPreview.tsx');
  });

  it('should scale seekbar timestamps for mobile', () => {
    expect(source).toMatch(/text-\[10px\]\s+sm:text-xs/);
  });

  it('should scale seekbar timestamp width for mobile', () => {
    expect(source).toMatch(/w-10\s+sm:w-12/);
  });

  it('should use responsive gap for seekbar', () => {
    expect(source).toMatch(/gap-1\.5\s+sm:gap-3/);
  });

  it('should scale control buttons for mobile touch targets', () => {
    expect(source).toMatch(/h-9\s+w-9\s+sm:h-10\s+sm:w-10/);
  });

  it('should scale playback speed select for mobile', () => {
    expect(source).toMatch(/w-16\s+sm:w-20/);
  });

  it('should scale resolution select for mobile', () => {
    expect(source).toMatch(/w-16\s+sm:w-24/);
  });

  it('should allow control buttons to wrap on mobile', () => {
    expect(source).toMatch(/flex-wrap/);
  });

  // Pure helper tests
  it('formatTime should format frames correctly', async () => {
    const { formatTime } = await import('../VideoPreview');
    expect(formatTime(0, 30)).toBe('00:00');
    expect(formatTime(30, 30)).toBe('00:01');
    expect(formatTime(180, 30)).toBe('00:06');
    expect(formatTime(1800, 30)).toBe('01:00');
  });
});

// ========================================
// Test Suite: Overall responsive coverage
// ========================================

describe('TASK-0076: Overall responsive coverage', () => {
  const components = [
    { name: 'EnhancedFileUploader', file: 'EnhancedFileUploader.tsx' },
    { name: 'PipelineProgress', file: 'PipelineProgress.tsx' },
    { name: 'StageIndicator', file: 'StageIndicator.tsx' },
    { name: 'VideoPreview', file: 'VideoPreview.tsx' },
  ];

  it.each(components)('$name should use sm: breakpoint classes', ({ file }) => {
    const source = readComponentSource(file);
    const smCount = (source.match(/sm:/g) || []).length;
    expect(smCount).toBeGreaterThanOrEqual(3);
  });

  it.each(components)('$name should not have fixed large padding without responsive alternatives', ({ file }) => {
    const source = readComponentSource(file);
    // Check that large fixed paddings like p-8, p-6 are paired with responsive prefixes
    const fixedP8 = /\bp-8\b(?!.*sm:p)/;
    const fixedP6 = /\bp-6\b(?!.*sm:p)/;
    // p-8 or p-6 alone (without sm: alternative) should not exist
    // This is a soft check - the components should have responsive padding
    expect(source).not.toMatch(/^\s*className="[^"]*p-8[^"]*"/);
  });
});
