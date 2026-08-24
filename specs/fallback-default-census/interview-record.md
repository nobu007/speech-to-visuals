# fallback-default census — 自動分析記録

<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals 設計自動分析記録](../speech-to-visuals/design-interview.md)
>
> - parent: `speech-to-visuals/design-interview.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-24
**分析実施**: step4 既存情報ベースの差分分析と自動統合

## 分析目的

同一 field chain への primitive literal fallback の混在が本 repo に実在するか
を機械的 discovery で確定する — cluster 全数・mixed cluster の有無・各 cluster
の分類（ALLOWED）と unify の是非・既存 test への影響を既存正典と照合して
要件化の前提を確定する。

## 分析項目と判断

### A1: class の実在性（mixed-literal cluster の全数計測）

**カテゴリ**: 優先順位
**背景**: 欠損時の代替値が site 間で不一致する chain が実在するか。auth role
不一致等の単発修正はあるが、chain 単位の組合せは計測されたことがない。

**判断**: production surface（repo src/ + @stv/core core-four）を
`<chain> (??|\|\|) <primitive literal>`（chain-adjacency + standalone-RHS
lookahead）で sweep し、literal を canonical 化して clustering した結果:
**site 327 / cluster 200 中、mixed cluster 10 件（32 site）**。うち 3 site は
real inconsistency（unify）、29 site は domain 理由付き ALLOWED。class は
実在するが大半は same-token 別 domain の偶然 — census は「本物の不一致だけを
抜き出して閉じる」ために必要。

**根拠**: discovery 実行結果（/tmp 計測 script が guard の正規表現と同一）。

**信頼性への影響**: REQ-405-001〜004 を 🔵 で確定（file:line 付き実測）。

### A2: unify 3 site の選定と影響範囲

**カテゴリ**: 設計判断
**背景**: mixed cluster をどこまで統一するか。統一は behavior 変更を伴う。

**判断**: 「同一の量・claim を読む」cluster のみ unify した:
(1) `scene.durationMs` — actual-video-renderer の `|| 10000` は
`DEFAULT_SCENE_DURATION_MS`（scene-duration-limits 正典・orchestrator/
smoke/video-generator の three-path agreement）の 2 倍。到達は falsy
durationMs = scene-builder 契約違反時のみで、そのときだけ 10000→5000 に
変化。空 scene 分岐は `DEFAULT_SCENE_DURATION_MS * 2` で旧 10000ms を保存。
(2) `gateResult.reason` — 同一 function の throw が同じ欠損に 'unknown' を
充てる（QualityGateError が gateName を含む message を構成するため旧 default
は二重報告だった）。(3) `decoded.role` — HTTP auth middleware と同じ claim。
socket.data.user.role に他の consumer なし・test の pin なし。残り 10 cluster
は domain 理由（route 別 400 copy・label vs lookup-lane・canvas vs node box・
tier enum vs compression fraction・machine '' vs human label・health vs
iteration status・retry profile・per-strategy tuning〔2026-08-08f refutation〕）
で ALLOWED。

**根拠**: 35 site の context 全読み + consumer grep + relevant test suite 実行。

**信頼性への影響**: REQ-405-003 を 🔵 で確定。

### A3: discovery 正規表現の偽 cluster 排除

**カテゴリ**: 技術的制約
**背景**: 初期の緩い正規表現は LHS の末尾 identifier のみを捕まえ、generic
token（`stage`・`width`）を全 receiver にわたって誤 join した（141 site 未分類）。

**判断**: (a) chain は演算子直前の完全 dotted path のみ（call-wrapped LHS・
cast・`counts.get(k) || 0` の Map seed を除外 — `)*` 許容が ProductionDashboard
7-site 偽 cluster を作った実測で排除）、(b) standalone-RHS lookahead
（`'X' in window || 'Y' in window` の probe OR を除外）、(c) site key =
`file:line:chain`（同一行の width/height 複数 default を分離）、
(d) canonical literal（`60.0`≡`60`・`'x'`≡`"x"`）。結果 327/200/10 が
judgable set として安定。

**根拠**: 反復計測（141 未分類 → 正規化後 0 未分類）。

**信頼性への影響**: REQ-405-001/002 を 🔵、REQ-405-009 を 🟡 で確定。

### A4: make-run steering の具体名検証（phantom 記録）

**カテゴリ**: プロセス
**背景**: 今期の steering は EDGE-130 multi-token coverage bonus・EDGE-131
"hidden value leaks into visible signal" sweep・SampleDetailModal・
ヨガ体験予約フォーム等の具体名を挙げた。

**判断**: `grep -rn` で全 repo 検索した結果、EDGE-130/131・SampleDetailModal・
ヨガ体験予約フォームは**本 repo に zero hit**（cross-repo phantom —
memory の Phantom-feedback trap と一致）。高レベル intent のみ採用:
(1) commit-splitting 指摘（child-spec commit が parent 登録を残す）→
REQ-405-007 として guard・MW・receipt・spec landing・parent 側登録を
単一 commit に同梱、(2) "hidden value leak" sweep → 欠損時の代替値不一致
（まさに hidden な value leak）の機械的 census として本要件で実装。

**根拠**: grep 実行結果（zero hit）+ 過去 92/96-98/108/162/164/166 の
cross-repo contamination 記録。

**信頼性への影響**: 影響なし（要件の実体は A1-A3 に依存）。

### A5: MW-069 mutation 検証の副次発見

**カテゴリ**: 検証
**背景**: guard の teeth を 3 独立 mutation で実証する際、期待 RED 数が
初期に合わなかった。

**判断**: (1) mutation (a) の旧 `|| 10000` revert が最初 2 failed しか出さ
なかったのは ERADICATED key を bare `durationMs` で書いていたため —
eradicated-reappear が vacuous pass。chain 表記
（`src/pipeline/actual-video-renderer.ts:226:scene.durationMs`）に修正したら
3 failed（completeness + eradicated-reappear + mode anchor）。(2) mutation (b)
の probe を `opts.stage ?? 'render'` と書いても bare `stage` cluster に join
しない（textual attribution ceiling）— probe は bare `stage` で書いて
1 failed を実測。両方とも REQ-405-009 の ceiling として明文化。

**根拠**: mutation 実行ログ（RED-count 2→3・0→1 の差分）。

**信頼性への影響**: REQ-405-008 を 🔵 で確定。
