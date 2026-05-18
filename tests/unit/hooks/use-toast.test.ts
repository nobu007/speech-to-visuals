/**
 * REQ-136: use-toast.ts Reducer Unit Tests
 *
 * Tests the exported reducer (pure function) covering:
 * - ADD_TOAST with TOAST_LIMIT enforcement
 * - UPDATE_TOAST
 * - DISMISS_TOAST (specific + all)
 * - REMOVE_TOAST (specific + all)
 * - Edge cases: empty state, multiple toasts
 *
 * The reducer is tested directly (no React) for determinism and correctness.
 */

import { jest } from '@jest/globals';

// Use fake timers to control setTimeout in addToRemoveQueue side-effect
jest.useFakeTimers();

import { reducer } from '../../../src/hooks/use-toast';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeToast = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  title: `Toast ${id}`,
  description: `Description ${id}`,
  open: true,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('use-toast reducer (REQ-136)', () => {
  const initialState = { toasts: [] };

  // =========================================================================
  // ADD_TOAST
  // =========================================================================

  describe('ADD_TOAST', () => {
    test('should add a toast to empty state', () => {
      const toast = makeToast('1');
      const next = reducer(initialState, { type: 'ADD_TOAST', toast });
      expect(next.toasts).toHaveLength(1);
      expect(next.toasts[0].id).toBe('1');
    });

    test('should enforce TOAST_LIMIT=1: new toast replaces old', () => {
      const state = { toasts: [makeToast('old')] };
      const next = reducer(state, { type: 'ADD_TOAST', toast: makeToast('new') });
      expect(next.toasts).toHaveLength(1);
      expect(next.toasts[0].id).toBe('new');
    });

    test('should prepend new toast at front of array', () => {
      // Even with limit 1, verify the ordering logic before slice
      const toast = makeToast('front');
      const next = reducer(initialState, { type: 'ADD_TOAST', toast });
      expect(next.toasts[0].id).toBe('front');
    });

    test('should preserve all toast properties', () => {
      const toast = makeToast('1', {
        title: 'Hello',
        description: 'World',
        variant: 'destructive' as const,
      });
      const next = reducer(initialState, { type: 'ADD_TOAST', toast });
      expect(next.toasts[0]).toMatchObject({
        id: '1',
        title: 'Hello',
        description: 'World',
        variant: 'destructive',
      });
    });
  });

  // =========================================================================
  // UPDATE_TOAST
  // =========================================================================

  describe('UPDATE_TOAST', () => {
    test('should update matching toast by id', () => {
      const state = { toasts: [makeToast('1', { title: 'Old' }), makeToast('2')] };
      const next = reducer(state, {
        type: 'UPDATE_TOAST',
        toast: { id: '1', title: 'New' },
      });
      expect(next.toasts[0].title).toBe('New');
      expect(next.toasts[1].title).toBe('Toast 2'); // unchanged
    });

    test('should return same state if no toast matches id', () => {
      const state = { toasts: [makeToast('1')] };
      const next = reducer(state, {
        type: 'UPDATE_TOAST',
        toast: { id: 'nonexistent', title: 'Nope' },
      });
      expect(next.toasts[0].title).toBe('Toast 1');
    });

    test('should merge partial update with existing properties', () => {
      const state = { toasts: [makeToast('1', { title: 'A', description: 'B' })] };
      const next = reducer(state, {
        type: 'UPDATE_TOAST',
        toast: { id: '1', description: 'Updated' },
      });
      expect(next.toasts[0].title).toBe('A'); // preserved
      expect(next.toasts[0].description).toBe('Updated'); // changed
    });
  });

  // =========================================================================
  // DISMISS_TOAST
  // =========================================================================

  describe('DISMISS_TOAST', () => {
    test('should set open=false for specific toastId', () => {
      const state = { toasts: [makeToast('1', { open: true }), makeToast('2', { open: true })] };
      const next = reducer(state, { type: 'DISMISS_TOAST', toastId: '1' });
      expect(next.toasts[0].open).toBe(false);
      expect(next.toasts[1].open).toBe(true);
    });

    test('should dismiss all toasts when toastId is undefined', () => {
      const state = { toasts: [makeToast('1', { open: true }), makeToast('2', { open: true })] };
      const next = reducer(state, { type: 'DISMISS_TOAST', toastId: undefined });
      expect(next.toasts.every(t => t.open === false)).toBe(true);
    });

    test('should not modify toast array length on dismiss', () => {
      const state = { toasts: [makeToast('1'), makeToast('2')] };
      const next = reducer(state, { type: 'DISMISS_TOAST', toastId: '1' });
      expect(next.toasts).toHaveLength(2);
    });

    test('should handle dismissing non-existent toast id gracefully', () => {
      const state = { toasts: [makeToast('1', { open: true })] };
      const next = reducer(state, { type: 'DISMISS_TOAST', toastId: 'nonexistent' });
      expect(next.toasts[0].open).toBe(true);
    });
  });

  // =========================================================================
  // REMOVE_TOAST
  // =========================================================================

  describe('REMOVE_TOAST', () => {
    test('should remove specific toast by id', () => {
      const state = { toasts: [makeToast('1'), makeToast('2')] };
      const next = reducer(state, { type: 'REMOVE_TOAST', toastId: '1' });
      expect(next.toasts).toHaveLength(1);
      expect(next.toasts[0].id).toBe('2');
    });

    test('should clear all toasts when toastId is undefined', () => {
      const state = { toasts: [makeToast('1'), makeToast('2')] };
      const next = reducer(state, { type: 'REMOVE_TOAST', toastId: undefined });
      expect(next.toasts).toHaveLength(0);
    });

    test('should handle removing from empty state', () => {
      const next = reducer(initialState, { type: 'REMOVE_TOAST', toastId: '1' });
      expect(next.toasts).toHaveLength(0);
    });

    test('should handle removing non-existent id gracefully', () => {
      const state = { toasts: [makeToast('1')] };
      const next = reducer(state, { type: 'REMOVE_TOAST', toastId: 'nonexistent' });
      expect(next.toasts).toHaveLength(1);
      expect(next.toasts[0].id).toBe('1');
    });
  });

  // =========================================================================
  // Lifecycle: ADD → DISMISS → REMOVE flow
  // =========================================================================

  describe('toast lifecycle', () => {
    test('ADD → DISMISS → REMOVE produces empty state', () => {
      let state = reducer(initialState, { type: 'ADD_TOAST', toast: makeToast('1') });
      expect(state.toasts).toHaveLength(1);

      state = reducer(state, { type: 'DISMISS_TOAST', toastId: '1' });
      expect(state.toasts[0].open).toBe(false);
      expect(state.toasts).toHaveLength(1);

      state = reducer(state, { type: 'REMOVE_TOAST', toastId: '1' });
      expect(state.toasts).toHaveLength(0);
    });

    test('rapid ADD cycle respects limit', () => {
      let state = reducer(initialState, { type: 'ADD_TOAST', toast: makeToast('1') });
      state = reducer(state, { type: 'ADD_TOAST', toast: makeToast('2') });
      state = reducer(state, { type: 'ADD_TOAST', toast: makeToast('3') });
      // TOAST_LIMIT = 1, only the latest survives
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0].id).toBe('3');
    });
  });

  // =========================================================================
  // REQ-136 Acceptance Criteria
  // =========================================================================

  describe('REQ-136 acceptance criteria', () => {
    test('TC-136-01: reducer handles ADD_TOAST with complete toast object', () => {
      const toast = makeToast('tc1', {
        title: 'Test Title',
        description: 'Test Description',
        action: undefined,
      });
      const next = reducer(initialState, { type: 'ADD_TOAST', toast });
      expect(next.toasts[0]).toMatchObject({
        id: 'tc1',
        title: 'Test Title',
        description: 'Test Description',
      });
    });

    test('TC-136-02: TOAST_LIMIT is exactly 1', () => {
      // Add two toasts; only the second should survive
      let state = reducer(initialState, { type: 'ADD_TOAST', toast: makeToast('first') });
      state = reducer(state, { type: 'ADD_TOAST', toast: makeToast('second') });
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0].id).toBe('second');
    });

    test('TC-136-03: UPDATE_TOAST merges partial properties', () => {
      const state = { toasts: [makeToast('u1', { title: 'Original', description: 'Desc' })] };
      const next = reducer(state, {
        type: 'UPDATE_TOAST',
        toast: { id: 'u1', title: 'Changed' },
      });
      expect(next.toasts[0].title).toBe('Changed');
      expect(next.toasts[0].description).toBe('Desc');
    });

    test('TC-136-04: DISMISS_TOAST sets open=false without removing', () => {
      const state = { toasts: [makeToast('d1', { open: true })] };
      const next = reducer(state, { type: 'DISMISS_TOAST', toastId: 'd1' });
      expect(next.toasts[0].open).toBe(false);
      expect(next.toasts).toHaveLength(1);
    });

    test('TC-136-05: REMOVE_TOAST with undefined clears all', () => {
      const state = { toasts: [makeToast('r1'), makeToast('r2')] };
      const next = reducer(state, { type: 'REMOVE_TOAST', toastId: undefined });
      expect(next.toasts).toEqual([]);
    });
  });
});
