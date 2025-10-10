# カスタムインストラクション実行計画

**作成日時**: 2025-10-10
**ステータス**: 即実行可能
**目的**: カスタムインストラクション完全準拠 (98.7% → 100%)

---

## 🎯 即座に実行すべきアクション

### オプション 1: コミット戦略の完全自動化 (推奨)

**所要時間**: 1-2時間
**効果**: カスタムインストラクション準拠率 98.7% → 100%

#### 実装ステップ:

```bash
# Step 1: Git タグ自動付与スクリプト作成
mkdir -p scripts/git-automation
cat > scripts/git-automation/auto-tag-commit.sh << 'EOF'
#!/bin/bash
# カスタムインストラクション準拠: 自動タグ付けスクリプト

# 最新コミットからイテレーション番号を抽出
ITERATION=$(git log -1 --pretty=%B | grep -oP 'iteration-\K\d+' || echo "unknown")
PHASE=$(git log -1 --pretty=%B | grep -oP 'phase-\K[A-C]' || echo "")

# タグ名生成
if [ "$PHASE" != "" ]; then
  TAG="iteration-${ITERATION}-phase-${PHASE}"
else
  TAG="iteration-${ITERATION}-$(date +%Y%m%d-%H%M%S)"
fi

# タグ作成
git tag -a "$TAG" -m "Auto-tagged commit for iteration $ITERATION" 2>/dev/null

if [ $? -eq 0 ]; then
  echo "✅ Created tag: $TAG"
else
  echo "⚠️ Tag already exists or error occurred"
fi
EOF

chmod +x scripts/git-automation/auto-tag-commit.sh

# Step 2: Pre-commit hook 設定
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# カスタムインストラクション準拠チェック

# ITERATION_LOG.md 更新チェック
if ! git diff --cached --name-only | grep -q "\.module/ITERATION_LOG\.md"; then
  echo "⚠️ [Custom Instruction] ITERATION_LOG.md not updated."
  echo "   Consider documenting your changes before committing."
fi

# 30分以上の作業後の確認
LAST_COMMIT_TIME=$(git log -1 --format=%ct)
CURRENT_TIME=$(date +%s)
TIME_DIFF=$((CURRENT_TIME - LAST_COMMIT_TIME))
THIRTY_MINUTES=$((30 * 60))

if [ $TIME_DIFF -gt $THIRTY_MINUTES ]; then
  echo "✅ [Custom Instruction] Good timing - last commit was >30 minutes ago"
fi

exit 0
EOF

chmod +x .git/hooks/pre-commit

# Step 3: Post-commit hook (自動タグ付与)
cat > .git/hooks/post-commit << 'EOF'
#!/bin/bash
# 自動タグ付与実行
scripts/git-automation/auto-tag-commit.sh
EOF

chmod +x .git/hooks/post-commit

echo "✅ Git automation setup complete!"
```

---

### オプション 2: Iteration 67 実行開始 (エンタープライズ対応)

**所要時間**: 3-4日間
**効果**: エンタープライズスケーリング実現

#### カスタムインストラクション準拠実行プラン:

```yaml
iteration_67_custom_instruction_compliant_plan:

  # Day 1: Phase A - API開発
  day_1_morning:
    1_start:
      - action: "現状確認"
        command: "ls -la src/ && git status"
      - action: "依存関係チェック"
        command: "npm list --depth=0 | grep -E '(express|fastify|socket)'"
      - action: "前回の状態復元"
        file: ".module/ITERATION_LOG.md"

    2_implement:
      - action: "最小実装: RESTful APIサーバー"
        file: "src/api/rest-api-server.ts"
        code: |
          import express from 'express';

          export class RestApiServer {
            private app = express();

            constructor(private port: number = 3000) {
              this.setupMiddleware();
              this.setupRoutes();
            }

            private setupMiddleware() {
              this.app.use(express.json());
              // 最小限のミドルウェアのみ
            }

            private setupRoutes() {
              // 最小限のエンドポイント
              this.app.get('/health', (req, res) => {
                res.json({ status: 'ok' });
              });

              this.app.post('/api/v1/transcribe', async (req, res) => {
                // TODO: 実装
                res.json({ message: 'Not implemented yet' });
              });
            }

            start() {
              this.app.listen(this.port, () => {
                console.log(`✅ API Server running on port ${this.port}`);
              });
            }
          }

    3_test:
      - action: "単体テスト: ヘルスチェック"
        command: "curl http://localhost:3000/health"
      - action: "統合テスト: エンドポイント"
        file: "tests/api/rest-api-server.test.ts"

    4_evaluate:
      - action: "成功基準チェック"
        criteria:
          - "サーバー起動成功: true"
          - "ヘルスチェック応答: <10ms"
          - "エンドポイント定義: 完了"

    5_iterate:
      - action: "問題特定"
        issue: "レスポンスタイム測定がない"
      - action: "改善実装"
        code: "// レスポンスタイム測定ミドルウェア追加"

    6_commit:
      - action: "変更内容整理"
        command: "git diff --cached"
      - action: "コミット"
        message: "feat(iteration-67): Implement RESTful API server [iteration-1] [phase-A]"
      - action: "タグ付け (自動)"
        tag: "iteration-67-phase-A-iteration-1"

  day_1_afternoon:
    # 同様のサイクルで WebSocket 実装
    implement: "WebSocket統合"
    commit: "feat(iteration-67): Add WebSocket integration [iteration-2] [phase-A]"

  # Day 2: Phase B - チーム・権限管理
  day_2_morning:
    implement: "ワークスペース管理"
    commit: "feat(iteration-67): Implement workspace management [iteration-3] [phase-B]"

  day_2_afternoon:
    implement: "RBAC権限システム"
    commit: "feat(iteration-67): Add RBAC system [iteration-4] [phase-B]"

  # Day 3-4: Phase C - スケーリング
  day_3_4:
    implement: "負荷分散、監視統合"
    commit: "feat(iteration-67): Complete scaling infrastructure [iteration-5] [phase-C]"
```

---

### オプション 3: 現在のシステムのデモ・検証

**所要時間**: 30分-1時間
**効果**: 現在の実装状況の確認

#### 実行ステップ:

```bash
# Step 1: システム起動
npm run dev

# Step 2: Remotion Studio 起動
npm run remotion:studio

# Step 3: E2Eテスト実行 (実音声ファイルで)
# (音声ファイルをアップロード → 動画生成まで確認)

# Step 4: 品質メトリクス確認
node scripts/iteration-66-validation-test.mjs

# Step 5: レポート確認
cat .module/SYSTEM_STATUS_SUMMARY.md
```

---

### オプション 4: 特定機能の強化

**所要時間**: 半日-1日
**効果**: 特定の課題解決

#### 候補機能:

1. **AI駆動の図解タイプ推薦**
   - カスタムインストラクション準拠: イテレーション改善サイクル適用
   - 実装: `src/ai/diagram-type-recommender.ts`
   - 評価: 推薦精度 >85%

2. **リアルタイムストリーミング処理**
   - カスタムインストラクション準拠: 段階的実装
   - 実装: `src/streaming/real-time-processor.ts`
   - 評価: レイテンシ <100ms

3. **モバイル対応強化**
   - カスタムインストラクション準拠: UI/UX段階的改善
   - 実装: レスポンシブデザイン拡張
   - 評価: モバイルユーザビリティスコア >90%

---

## 🔧 自動化ツールの実装

### ツール 1: イテレーション管理スクリプト

```bash
# scripts/iteration-manager.sh
#!/bin/bash

# カスタムインストラクション準拠: イテレーション管理

ITERATION_NUM=$1
PHASE=$2

if [ -z "$ITERATION_NUM" ]; then
  echo "Usage: ./iteration-manager.sh <iteration_number> <phase>"
  exit 1
fi

# 1. 現状確認
echo "🔍 [Start] Checking current state..."
git status
npm list --depth=0

# 2. イテレーション開始記録
echo "📝 Starting Iteration $ITERATION_NUM Phase $PHASE" >> .module/ITERATION_LOG.md
echo "Timestamp: $(date)" >> .module/ITERATION_LOG.md

# 3. ブランチ作成 (オプション)
BRANCH_NAME="iteration-${ITERATION_NUM}-phase-${PHASE}"
git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"

echo "✅ Iteration $ITERATION_NUM Phase $PHASE started"
echo "📌 Branch: $BRANCH_NAME"
```

---

### ツール 2: 品質チェック自動化

```typescript
// scripts/quality-check-automation.ts
import { QualityMonitor } from '../src/framework/quality-monitor';
import { CustomInstructionCompliance } from './custom-instruction-compliance';

class AutomatedQualityCheck {
  async run() {
    console.log('🔍 [Quality Check] Starting automated quality assessment...');

    // 1. カスタムインストラクション準拠チェック
    const complianceChecker = new CustomInstructionCompliance();
    const complianceReport = await complianceChecker.check();

    console.log(`📊 Custom Instruction Compliance: ${complianceReport.score}%`);

    // 2. 技術的品質チェック
    const qualityMonitor = new QualityMonitor();
    const qualityReport = await qualityMonitor.runChecks();

    console.log(`📊 Technical Quality Score: ${qualityReport.overallScore}%`);

    // 3. レポート生成
    const combinedReport = {
      timestamp: new Date(),
      compliance: complianceReport,
      quality: qualityReport,
      overallScore: (complianceReport.score + qualityReport.overallScore) / 2,
      recommendations: this.generateRecommendations(complianceReport, qualityReport)
    };

    // 4. レポート保存
    await this.saveReport(combinedReport);

    return combinedReport;
  }

  private generateRecommendations(compliance: any, quality: any): string[] {
    const recommendations: string[] = [];

    if (compliance.score < 100) {
      recommendations.push(`Improve custom instruction compliance: ${compliance.gaps.join(', ')}`);
    }

    if (quality.overallScore < 95) {
      recommendations.push(`Improve technical quality: ${quality.issues.join(', ')}`);
    }

    return recommendations;
  }

  private async saveReport(report: any) {
    const reportPath = `.module/QUALITY_CHECK_REPORT_${new Date().toISOString()}.json`;
    await Bun.write(reportPath, JSON.stringify(report, null, 2));
    console.log(`✅ Report saved: ${reportPath}`);
  }
}

// 実行
const checker = new AutomatedQualityCheck();
checker.run().then(report => {
  console.log('\n📊 Final Score:', report.overallScore, '%');

  if (report.overallScore >= 95) {
    console.log('✅ Quality check PASSED');
    process.exit(0);
  } else {
    console.log('⚠️ Quality check needs improvement');
    console.log('Recommendations:', report.recommendations);
    process.exit(1);
  }
});
```

---

## 📊 成功基準の定義

### カスタムインストラクション完全準拠の定義:

```yaml
full_compliance_criteria:
  compliance_score: 100%

  required_implementations:
    - ✅ 再帰的開発サイクル自動化
    - ✅ 段階的実装プロトコル遵守
    - ✅ 品質メトリクス自動追跡
    - ✅ イテレーションログ自動更新
    - ✅ コミット戦略完全自動化
    - ✅ タグ付け自動化
    - ✅ 30分ルール追跡

  quality_gates:
    - transcription_accuracy: ">= 0.85"
    - scene_segmentation_f1: ">= 0.75"
    - layout_overlap: "== 0"
    - render_time: "<= 30000ms"
    - memory_usage: "<= 512MB"

  documentation:
    - iteration_log: "毎イテレーション更新"
    - quality_metrics: "自動記録"
    - commit_messages: "規則準拠"
```

---

## 🎯 推奨実行シーケンス

### 今すぐ実行すべき順序:

```bash
# 1. コミット戦略の完全自動化 (1-2時間)
bash scripts/setup-git-automation.sh  # 上記のスクリプトをまとめたもの

# 2. 品質チェックの実行 (確認)
npx ts-node scripts/quality-check-automation.ts

# 3. カスタムインストラクション準拠率の最終確認
cat .module/CUSTOM_INSTRUCTION_INTEGRATION_REPORT.md

# 4. Iteration 67 実行開始 (または他のオプション)
./scripts/iteration-manager.sh 67 A
```

---

## 💬 質問・確認事項

次にどのアクションを実行しますか？

### オプション A: コミット戦略の完全自動化 (推奨)
- 所要時間: 1-2時間
- 効果: 即座に100%準拠達成
- 実行: 上記のスクリプトを実装

### オプション B: Iteration 67 実行開始
- 所要時間: 3-4日間
- 効果: エンタープライズ機能実現
- 実行: カスタムインストラクション準拠プランで進行

### オプション C: システムデモ・検証
- 所要時間: 30分-1時間
- 効果: 現在の機能確認
- 実行: E2Eテスト実施

### オプション D: 特定機能の強化
- 所要時間: 半日-1日
- 効果: 特定課題の解決
- 実行: 候補機能から選択

### オプション E: その他のリクエスト
- カスタムインストラクションに関する質問
- 特定のドキュメント参照
- 別のタスク

---

**ステータス**: 準備完了 - 指示待ち
**推奨アクション**: オプション A (コミット戦略自動化) → オプション B (Iteration 67)
