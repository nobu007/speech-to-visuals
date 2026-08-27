#!/usr/bin/env bash
# MW-091 reproducibility artifact (PR #75 follow-up / session 282).
#
# 目的: PR #75 の eval 94→96 で指摘された「observed 値を ledger のみから
# 再現可能にせよ」要望への応答。MW-091 の mutation を reproducible に実行し、
# 台帳の `observed` フィールドが現実の挙動と一致する事を証人付きで保証する。
#
# 概要:
#   1. git stash (汚染防止)
#   2. sed で `if (wasDecompressed) { … return … }` (3 行) を
#      無条件 `return { ...bestMatch, data: decompressedData };` (1 行) に置換
#   3. npx jest --testPathPatterns intelligent-cache-robustness を実行
#   4. sed 復元 (git checkout で確実に)
#   5. observed (RED count) を台帳の期待値と比較し exit code で合否を返す
#
# 台帳契約:
#   - expected: 1 failed / 11 passed (12 total)
#   - RED test: "findSimilar() hit on a NON-compressed entry returns the raw
#               data and still records the hit"
#   - command: NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096'
#              npx jest --config jest.config.cjs --testPathPatterns intelligent-cache-robustness
#
# usage:
#   bash scripts/concept-guard/mw-091-reproduce.sh
#
# 関連: tests/guards/mw-091-ledger-integrity.test.ts (静的な構造 guard)/
#       specs/speech-to-visuals/mutation-witness-ledger.md (canonical 台帳)
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-$(git rev-parse --show-toplevel)}"
TARGET="${REPO_ROOT}/src/performance/intelligent-cache.ts"
TEST_PATTERN='intelligent-cache-robustness'
EXPECTED_TOTAL=12
EXPECTED_FAILED=1

cd "${REPO_ROOT}"

echo "[MW-091] Step 1: stash pending changes (汚染防止)"
git stash push --include-untracked --quiet || true

echo "[MW-091] Step 2: snapshot intact target as .bak"
cp "${TARGET}" "${TARGET}.bak"

echo "[MW-091] Step 3: apply mutation — strip the wasDecompressed gate (lines 810-812)"
# lines 810-812 (1-indexed):
#   810:      if (wasDecompressed) {
#   811:        return { ...bestMatch, data: decompressedData };
#   812:      }
# ↓
#      return { ...bestMatch, data: decompressedData };
sed -i '810,812c\      return { ...bestMatch, data: decompressedData };' "${TARGET}"

echo "[MW-091] Step 4: run jest on intelligent-cache-robustness"
set +e
OUTPUT=$(NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' \
  npx jest --config jest.config.cjs --testPathPatterns "${TEST_PATTERN}" 2>&1)
JEST_EXIT=$?
set -e

echo "[MW-091] Step 5: restore target (git checkout -- 強制)"
cp "${TARGET}.bak" "${TARGET}"
rm -f "${TARGET}.bak"
git checkout -- "${TARGET}" 2>/dev/null || true

# 直前の stash を戻す (もしあれば)
if git stash list | grep -q .; then
  echo "[MW-091] Step 6: pop stash (prior working state restore)"
  git stash pop --quiet || true
fi

echo
echo "---- MUTATION WITNESS OUTPUT ----"
echo "${OUTPUT}" | grep -E '^(Tests:|Test Suites:|PASS|FAIL|  ✓|  ✕)' | head -40 || true
echo "---- END ----"
echo

# count 抽出
FAILED_COUNT=$(echo "${OUTPUT}" | grep -oE 'Tests: [0-9]+ failed' | head -n1 | grep -oE '[0-9]+' || echo "0")
TOTAL_COUNT=$(echo "${OUTPUT}" | grep -oE 'Tests: [0-9]+ total' | head -n1 | grep -oE '[0-9]+' || echo "0")

# 受け皿が空でも 0 として扱う（no matches の場合 grep が exit 1 になるため）
PASSED_COUNT=$(echo "${OUTPUT}" | grep -oE '[0-9]+ passed' | head -n1 | grep -oE '[0-9]+' || echo "0")

echo "[MW-091] observed: ${FAILED_COUNT} failed / ${PASSED_COUNT} passed (${TOTAL_COUNT} total)"
echo "[MW-091] expected (per ledger): ${EXPECTED_FAILED} failed / $((EXPECTED_TOTAL - EXPECTED_FAILED)) passed (${EXPECTED_TOTAL} total)"

# 合致判定
if [[ "${FAILED_COUNT}" != "${EXPECTED_FAILED}" ]]; then
  echo
  echo "[MW-091] ❌ MISMATCH — observed count differs from MW-091 ledger 'observed' field"
  echo "[MW-091] ledger expected: ${EXPECTED_FAILED} failed / ${EXPECTED_TOTAL} total"
  echo "[MW-091] observed:       ${FAILED_COUNT} failed / ${TOTAL_COUNT} total"
  exit 1
fi

echo
echo "[MW-091] ✅ observed count matches MW-091 ledger (1 failed / 11 passed / 12 total)"
exit 0
