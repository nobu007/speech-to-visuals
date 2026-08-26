# Active AUTO Decisions (cache) — safe to delete

## AUTO:Bootstrap:concept-enrichment-direct-entry
- Status: ACTIVE
- Chosen: 初回生成の概念充実フェーズでは 11_repo_autopilot 起動判断 Q3 の指示に従い
  ontology.yml へ直接 term を投入した（36 terms・各々 code+test/spec の一次資料2件以上で evidence 検証済み）。
  以後の新語は term_queue.yml 入国審査経由のみとする（B-8）。
- Policy: parent-instruction precedence + evidence-first
- Expires After Runs: 20
- Linked: （なし・bootstrap 決定）
- Revert Triggers: primary_evidence_contradiction

## AUTO:QualityMonitor.scale:dual-with-guard
- Status: ACTIVE
- Chosen: 二重スケール維持 + REQ-382/TC-366-01 の4-leg guard で交叉配線検出
- Policy: reversibility + blast_radius_min
- Expires After Runs: 20
- Linked: AMB-QUAL-001
- Revert Triggers: primary_evidence_contradiction, major_test_failure

## AUTO:QualityMonitor.metrics:fail-closed-defaults
- Status: ACTIVE
- Chosen: transcriptionAccuracy/avgSceneQuality は正解ラベル入手まで実測化せず fail-closed 継続
- Policy: safety（捏造 metric 禁止）+ reversibility
- Expires After Runs: 20
- Linked: AMB-QUAL-002
- Revert Triggers: primary_evidence_contradiction

## AUTO:LayoutEngine.overlapDetectionMode:latent-documented
- Status: ACTIVE
- Chosen: overlapDetectionMode は生成時未読のまま文書化して維持
- Policy: blast_radius_min
- Expires After Runs: 20
- Linked: AMB-VIS-001
- Revert Triggers: primary_evidence_contradiction

## AUTO:ConceptSync.Q3-denominator:bug-class-coverage
- Status: ACTIVE
- Chosen: Q3（invariant 抽出率）は bug-class 網羅基準で運用し、テスト全ファイル比は参考値。
  16→26 invariants へ増産（guards の census / mutation-pinning から抽出）。全ファイル比 50% は
  386 invariants を要求し Rule 7（統合優先）と構造的に衝突するため分母を再定義した。
- Policy: integration-first（Rule 7 統合優先）+ blast_radius_min
- Expires After Runs: 20
- Linked: AMB-PROC-001
- Revert Triggers: primary_evidence_contradiction

## AUTO:ExportEngine.pdfColorFill.invalid-length:fail-open
- Status: ACTIVE
- Chosen: backgroundColor 契約外長度 (#RGBA 等) は現行 per-channel fail-open (NaN→1.000) を維持。
  test leg (tests/unit/export/multi-format-exporter.test.ts) で方針を文書化 —
  fail-fast 化・#RGBA 対応は意図した契約変更として扱う。
- Policy: reversibility + blast_radius_min（既存 NaN→1 fallback と同一）
- Expires After Runs: 20
- Linked: AMB-EXP-001
- Revert Triggers: primary_evidence_contradiction, security_risk

## AUTO:Concept.run_id.monotonic-union
- Status: ACTIVE
- Chosen: last_run_id は max(既存 last_run_id, claims.ndjson 内の max run_id, wall clock) を採用。
  並行 PR が JST local 時刻を Z 接尾で stamp した為 (2026-08-27T08:40:00Z ≒ 実 2026-08-26T23:40Z)、
  union 時に last_run_id が時系列逆行した (23:05Z → 08:40Z)。stamp 系列の最大値に合わせる事で
  monotonic を保証し、wall clock が系列 max を下回る場合は系列 max を維持する。
- Policy: bookkeeping 一貫性 (monotonic) + 最小差分
- Expires After Runs: 20
- Linked: （なし・運用決定）
- Revert Triggers: run_id を実 UTC 生成 (source clock 修正) に切り替える場合
