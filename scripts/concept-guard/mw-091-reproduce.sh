#!/usr/bin/env bash
# MW-091 reproducibility artifact (PR #75 follow-up / session 282).
#
# 目的: PR #75 eval の「observed 値を ledger のみから再現可能にせよ」要望への応答。
# MW-091 の mutation (wasDecompressed gate 剥離) を reproducible に実行し、
# 台帳の `observed` フィールドが現実の挙動と一致する事を証人付きで保証する。
#
# 台帳契約 (specs/speech-to-visuals/mutation-witness-ledger.md MW-091):
#   - target: src/performance/intelligent-cache.ts の `if (wasDecompressed)` 周辺 3 行
#   - mutation: gate を剥離し無条件 return 1 行に置換
#   - expected: 1 failed / 11 passed (12 total)
#
# 動的 line 解決: sed 行番号を magic number で持たず、`grep -n 'if (wasDecompressed)'`
# で取得した行を起点に 3 行 (gate/return/closing brace) を置換する。
#
# usage:
#   bash scripts/concept-guard/mw-091-reproduce.sh
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-$(git rev-parse --show-toplevel)}"
TARGET="${REPO_ROOT}/src/performance/intelligent-cache.ts"
TEST_PATTERN='intelligent-cache-robustness'
EXPECTED_FAILED=1
EXPECTED_TOTAL=12

cd "${REPO_ROOT}"

# Step 1: 汚染防止 — stash pending changes
git stash push --include-untracked --quiet || true

# Step 2: 動的 line 解決 (magic number 排除)
GATE_LINE=$(grep -n 'if (wasDecompressed)' "${TARGET}" | head -n1 | cut -d: -f1)
if [ -z "${GATE_LINE}" ]; then
  echo "[MW-091] ❌ cannot locate 'if (wasDecompressed)' in ${TARGET}"
  exit 2
fi
END_LINE=$((GATE_LINE + 2))

# Step 3: mutation 適用 — gate 3 行を無条件 return 1 行に置換
cp "${TARGET}" "${TARGET}.bak"
sed -i "${GATE_LINE},${END_LINE}c\      return { ...bestMatch, data: decompressedData };" "${TARGET}"

# Step 4: jest 実行
set +e
OUTPUT=$(NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' \
  npx jest --config jest.config.cjs --testPathPatterns "${TEST_PATTERN}" 2>&1)
JEST_EXIT=$?
set -e

# Step 5: 復元 (必ず .bak を戻し、念のため git checkout で sync)
cp "${TARGET}.bak" "${TARGET}"
rm -f "${TARGET}.bak"
git checkout -- "${TARGET}" 2>/dev/null || true
git stash pop --quiet 2>/dev/null || true

# count 抽出 (no matches の場合 grep が exit 1 になるため || echo "0" で受け皿)
FAILED=$(echo "${OUTPUT}" | grep -oE 'Tests: [0-9]+ failed' | head -n1 | grep -oE '[0-9]+' || echo "0")
TOTAL=$(echo "${OUTPUT}" | grep -oE 'Tests: [0-9]+ total' | head -n1 | grep -oE '[0-9]+' || echo "0")
PASSED=$(echo "${OUTPUT}" | grep -oE '[0-9]+ passed' | head -n1 | grep -oE '[0-9]+' || echo "0")

echo
echo "---- MUTATION WITNESS OUTPUT ----"
echo "${OUTPUT}" | grep -E '^(Tests:|Test Suites:|PASS|FAIL|  ✓|  ✕)' | head -40 || true
echo "---- END ----"
echo

echo "[MW-091] observed: ${FAILED} failed / ${PASSED} passed (${TOTAL} total)"
echo "[MW-091] expected: ${EXPECTED_FAILED} failed / $((EXPECTED_TOTAL - EXPECTED_FAILED)) passed (${EXPECTED_TOTAL} total)"

if [[ "${FAILED}" != "${EXPECTED_FAILED}" ]]; then
  echo "[MW-091] ❌ MISMATCH — observed count differs from MW-091 ledger 'observed' field"
  exit 1
fi

echo "[MW-091] ✅ observed count matches MW-091 ledger (1 failed / 11 passed / 12 total)"
exit 0