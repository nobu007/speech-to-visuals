/**
 * @jest-environment node
 */
/**
 * toast-whitespace-pre-line-guard.test.ts — TC-311
 *
 * Pins the toast newline-preservation fix at `src/components/ui/sonner.tsx`
 * against silent regression. Sibling of the iteration-18 CaptionOverlay
 * `white-space: pre-line` fix (CSS `\n` collapse class — the MISSED-SIBLING
 * lesson: when fixing one site, grep ALL same-class siblings).
 *
 * THE BUG CLASS. CSS `white-space: normal` (the browser default for text)
 * collapses every newline in a string to a single space when that string is
 * rendered as a DOM text node. Sonner renders a toast's title (the message
 * passed to `toast.error(msg)` / `toast.warning(msg)`) and description as plain
 * text nodes inside `<div>`s whose default `white-space` is `normal`, so any
 * `\n` in the message is flattened — multiple lines slam onto one.
 *
 * THE LIVE SITE. `EnhancedFileUploader.handleFileSelection` joins a variable
 * number of validation findings with `\n` before showing them:
 *   const errorMsg = validation.errors.join('\n') || '...';
 *   toast.error(errorMsg);                          // title = multi-line
 *   toast.warning(validation.warnings.join('\n'));   // title = multi-line
 * `validateAudioFile` accumulates errors WITHOUT early-return (empty-file check
 * + size-limit check + type check all `push` independently), so a 0-byte file
 * with an unsupported extension yields TWO joined errors — a real, reachable
 * `\n` that the toast flattened into "Audio file is empty (0 bytes) Unsupported
 * audio file: ...". The on-screen `<AlertDescription>` for the SAME string was
 * already correct (`whitespace-pre-line`); only the toast path collapsed.
 *
 * THE FIX. The shared `<Toaster>` (sonner.tsx) now applies the Tailwind utility
 * `whitespace-pre-line` (= CSS `white-space: pre-line`) to BOTH the `title` and
 * `description` classNames it hands to Sonner. `pre-line` preserves `\n` as line
 * breaks (and wraps long lines) while still collapsing runs of spaces/tabs —
 * identical to `normal` for single-line toasts, so no existing toast changes
 * appearance; only multi-line messages render their structure.
 *
 * WHY A SOURCE-ANCHOR PIN (not a behavioral render). The defect is a layout
 * engine behavior (text reflow collapses `\n`), and jsdom does NOT perform
 * layout — `textContent` keeps the `\n` regardless of CSS, so no jsdom render
 * can witness the collapse. (The project mocks Sonner in component tests
 * precisely because its portal/timer-driven rendering is non-trivial in jsdom.)
 * The source anchor is therefore the correct, honest guard form: it goes RED
 * the moment a future "cleanup" drops the utility class, independent of any
 * behavioral file. Layer 2 ties the class to the exact keys that carry
 * multi-line text so the pin survives unrelated classNames refactors.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';

const GUARD_FILE = 'src/components/ui/sonner.tsx';

const src = (): string => readFileSync(GUARD_FILE, 'utf8');

describe('Toast newline preservation — source anchors pinned (TC-311)', () => {
  it('applies whitespace-pre-line to the toast TITLE (the message text)', () => {
    // The title carries `toast.error(msg)` / `toast.warning(msg)` text, where
    // multi-line validation messages live. Dropping the class re-collapses
    // every `\n` → RED. Anchored to the `title:` classNames key so a class
    // move to another key does not false-pass.
    expect(src()).toMatch(/title:\s*"[^"]*\bwhitespace-pre-line\b[^"]*"/);
  });

  it('applies whitespace-pre-line to the toast DESCRIPTION', () => {
    // Descriptions (`toast(title, { description })`) can also carry `\n`.
    // Anchored to the `description:` classNames key.
    expect(src()).toMatch(/description:\s*"[^"]*\bwhitespace-pre-line\b[^"]*"/);
  });

  it('does not regress to the pre-fix description value (whitespace-flattening form)', () => {
    // The pre-fix description was exactly "group-[.toast]:text-muted-foreground"
    // with no newline-preserving utility. If someone reverts to that exact
    // string the title/description anchors above already catch it; this pin
    // makes the intent explicit so the regression is self-documenting.
    expect(src()).not.toMatch(
      /description:\s*"group-\[\.toast\]:text-muted-foreground"\s*,/,
    );
  });
});
