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
