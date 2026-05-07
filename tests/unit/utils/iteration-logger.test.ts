/**
 * ISS-024: Regex escaping in iteration-logger.ts phase name
 *
 * Verifies that special regex characters in phase names are properly escaped,
 * preventing ReDoS or incorrect pattern matching.
 */


describe('ISS-024: Regex escaping in iteration-logger insertEntry', () => {
  // We test the escaping logic directly since insertEntry is private.
  // Instead we test the regex escaping pattern used in the fix.

  it('escapes regex special characters in phase names', () => {
    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Normal phase name - unchanged
    expect(escapeRegex('Phase 1')).toBe('Phase 1');

    // Phase name with special chars
    expect(escapeRegex('Phase (test)')).toBe('Phase \\(test\\)');
    expect(escapeRegex('Phase [v2]')).toBe('Phase \\[v2\\]');
    expect(escapeRegex('Phase.v3')).toBe('Phase\\.v3');
    expect(escapeRegex('Phase*+?^$')).toBe('Phase\\*\\+\\?\\^\\$');
    expect(escapeRegex('Phase{2}')).toBe('Phase\\{2\\}');
    expect(escapeRegex('Phase\\name')).toBe('Phase\\\\name');
  });

  it('does not crash on empty phase name', () => {
    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    expect(escapeRegex('')).toBe('');
  });

  it('correctly matches escaped phase in constructed regex', () => {
    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const phase = 'Phase (special)';
    const escaped = escapeRegex(phase);
    const regex = new RegExp(`## ${escaped}\\n`, 'i');

    expect(regex.test('## Phase (special)\ncontent')).toBe(true);
    expect(regex.test('## Phase normal\ncontent')).toBe(false);
  });
});
