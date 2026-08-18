#!/usr/bin/env bash
#
# verify-red-phase.sh — Pre-merge gate for red-phase compliance
#
# Runs the guard-red-phase-verification test suite and fails (exit 1) if any
# canary payload is NOT detected by the validator. This ensures every security
# detection pattern contributes unique coverage and that tests are genuine
# regression nets — not always-green boilerplate.
#
# Usage:
#   ./scripts/verify-red-phase.sh          # run with default Jest config
#   FUZZ_SEEDS=3 ./scripts/verify-red-phase.sh  # add random seed iterations
#
set -uo pipefail

echo "=== Red-Phase Verification Gate ==="
echo "Running guard-red-phase-verification test suite..."

# Run the red-phase verification tests
# Exit code 0 = all canaries detected (pass)
# Exit code non-0 = at least one canary slipped through (FAIL)
# NODE_OPTIONS matches package.json test scripts: the suite imports
# @stv/core (type:module ESM in node_modules), which needs the VM modules
# runtime — without it jest parses the package's dist as CJS and dies on
# `export` before a single test loads.
NODE_OPTIONS='--experimental-vm-modules' npx jest --config jest.config.cjs \
  --testPathPatterns='guard-red-phase-verification' \
  --verbose \
  --no-coverage

RESULT=$?

if [ $RESULT -eq 0 ]; then
  echo ""
  echo "✅ Red-phase verification PASSED: all canary payloads detected"
  echo "   Every security detection pattern contributes unique coverage."
else
  echo ""
  echo "❌ Red-phase verification FAILED: at least one canary payload was NOT detected"
  echo "   A security detection pattern may have been weakened or removed."
  echo "   Do NOT merge until all canaries are caught again."
  exit 1
fi
