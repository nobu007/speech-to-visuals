# Iteration 67 実行計画 - カスタムインストラクション準拠版

**作成日**: 2025-10-10
**ベース**: ITERATION_67_PLAN.md + カスタムインストラクション統合
**実行モード**: 段階的・再帰的開発サイクル

---

## 🎯 実行方針

### カスタムインストラクション原則の適用

```yaml
execution_philosophy:
  incremental: "小さく作り、確実に動作確認" ✅
  recursive: "動作→評価→改善→コミットの繰り返し" ✅
  modular: "疎結合なモジュール設計" ✅
  testable: "各段階で検証可能な出力" ✅
  transparent: "処理過程の可視化" ✅
```

### イテレーションサイクル定義

```typescript
interface Iteration67Cycle {
  phase: 'Phase A' | 'Phase B' | 'Phase C';
  maxIterations: number;
  successCriteria: string[];
  failureRecovery: string;
  commitTrigger: 'on_success' | 'on_checkpoint';
}

const PHASE_A_CYCLE: Iteration67Cycle = {
  phase: 'Phase A',
  maxIterations: 5,
  successCriteria: [
    'API エンドポイント動作 100%',
    'JWT認証成功率 > 99%',
    'WebSocket接続安定性 > 99%'
  ],
  failureRecovery: '最小構成に戻して段階的に再実装',
  commitTrigger: 'on_success'
};
```

---

## 📋 Phase A: API開発・統合（1-2日）

### Iteration A1: 最小REST API実装

#### 目標
- 単一エンドポイント動作確認
- 基本認証なし（まずは動作優先）
- Hello World レベルの成功

#### アクション
```bash
# ステップ1: API基盤構築
mkdir -p src/api
npm install express cors body-parser

# ステップ2: 最小サーバー実装
# src/api/minimal-server.ts を作成

# ステップ3: 動作確認
npm run api:dev
curl http://localhost:3001/api/health
# 期待出力: {"status":"ok"}
```

#### 成功基準
```typescript
const iteration_a1_criteria = {
  serverStarts: true,
  healthEndpointResponds: true,
  responseTime: '<100ms',
  noErrors: true
};
```

#### コミットタイミング
```bash
# 成功時即座にコミット
git add src/api/minimal-server.ts package.json
git commit -m "feat(api): Add minimal REST API server [iteration-67-A1]"
```

---

### Iteration A2: 認証システム追加

#### 目標
- JWT認証実装
- ログインエンドポイント動作
- トークン検証機能

#### アクション
```bash
# ステップ1: JWT依存追加
npm install jsonwebtoken bcrypt @types/jsonwebtoken @types/bcrypt

# ステップ2: 認証モジュール実装
# src/api/auth.ts を作成

# ステップ3: テスト
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}'
# 期待出力: {"token":"eyJhbGc..."}
```

#### 成功基準
```typescript
const iteration_a2_criteria = {
  loginEndpointWorks: true,
  tokenGenerated: true,
  tokenValidation: true,
  authMiddlewareWorks: true
};
```

#### 改善ポイント評価
```typescript
// 自動評価スクリプト
async function evaluateA2() {
  const tests = [
    { name: '正常ログイン', result: await testLogin() },
    { name: '不正パスワード拒否', result: await testInvalidPassword() },
    { name: 'トークン検証', result: await testTokenValidation() },
    { name: '期限切れトークン拒否', result: await testExpiredToken() }
  ];

  const successRate = tests.filter(t => t.result).length / tests.length;

  if (successRate >= 0.9) {
    console.log('✅ Iteration A2 成功 - コミット可能');
    return { success: true, needsIteration: false };
  } else {
    console.log('⚠️ Iteration A2 要改善 - 再実装必要');
    return { success: false, needsIteration: true };
  }
}
```

#### コミットタイミング
```bash
# 全テスト成功時のみコミット
git add src/api/auth.ts src/api/middleware/
git commit -m "feat(api): Add JWT authentication system [iteration-67-A2]"
```

---

### Iteration A3: 音声処理APIエンドポイント

#### 目標
- `/api/v1/transcribe` エンドポイント実装
- 既存transcriptionモジュール統合
- マルチパートファイルアップロード対応

#### アクション
```typescript
// src/api/routes/transcription.ts
import { Router } from 'express';
import multer from 'multer';
import { RealAudioOptimizer } from '../../transcription/real-audio-optimizer';

const router = Router();
const upload = multer({ dest: 'uploads/' });

router.post('/transcribe', upload.single('audio'), async (req, res) => {
  console.log('[API] Transcription request received');

  try {
    // 1. ファイル検証
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // 2. 既存モジュール呼び出し
    const optimizer = new RealAudioOptimizer();
    const result = await optimizer.processAudio(req.file.path);

    // 3. 結果返却
    res.json({
      success: true,
      transcription: result.captions,
      metadata: result.metadata,
      processingTime: result.processingTime
    });

    console.log('✅ Transcription completed successfully');

  } catch (error) {
    console.error('❌ Transcription failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
```

#### 成功基準
```typescript
const iteration_a3_criteria = {
  fileUploadWorks: true,
  transcriptionModuleIntegration: true,
  errorHandlingComplete: true,
  processingTime: '<30s for 1min audio'
};
```

#### テスト手順
```bash
# 実音声ファイルでテスト
curl -X POST http://localhost:3001/api/v1/transcribe \
  -H "Authorization: Bearer $TOKEN" \
  -F "audio=@test-audio.mp3"

# 期待出力:
# {
#   "success": true,
#   "transcription": [...],
#   "processingTime": 2500
# }
```

#### コミット
```bash
git add src/api/routes/transcription.ts
git commit -m "feat(api): Add audio transcription endpoint [iteration-67-A3]"
```

---

### Iteration A4: WebSocket統合

#### 目標
- Socket.io統合
- リアルタイム進捗配信
- 接続管理・エラーハンドリング

#### アクション
```bash
# ステップ1: Socket.io追加
npm install socket.io @types/socket.io

# ステップ2: WebSocketサーバー実装
# src/api/websocket-server.ts
```

```typescript
// src/api/websocket-server.ts
import { Server } from 'socket.io';
import { Server as HTTPServer } from 'http';

export class WebSocketServer {
  private io: Server;

  constructor(httpServer: HTTPServer) {
    this.io = new Server(httpServer, {
      cors: { origin: '*' }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log('[WebSocket] Client connected:', socket.id);

      socket.on('job:start', async (data) => {
        console.log('[WebSocket] Job started:', data.jobId);

        // 進捗を段階的に送信
        for (let progress = 0; progress <= 100; progress += 10) {
          await this.delay(500);
          socket.emit('job:progress', {
            jobId: data.jobId,
            progress,
            stage: this.getStage(progress),
            estimatedTimeRemaining: (100 - progress) * 0.5
          });
        }

        socket.emit('job:complete', {
          jobId: data.jobId,
          result: { success: true }
        });
      });

      socket.on('disconnect', () => {
        console.log('[WebSocket] Client disconnected:', socket.id);
      });
    });
  }

  private getStage(progress: number): string {
    if (progress < 25) return 'transcription';
    if (progress < 50) return 'analysis';
    if (progress < 75) return 'visualization';
    return 'rendering';
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

#### 成功基準
```typescript
const iteration_a4_criteria = {
  socketConnectionWorks: true,
  progressEventsReceived: true,
  reconnectionWorks: true,
  latency: '<50ms'
};
```

#### テスト
```javascript
// クライアント側テストコード
const socket = io('http://localhost:3001');

socket.on('connect', () => {
  console.log('✅ Connected');

  socket.emit('job:start', { jobId: 'test-123' });
});

socket.on('job:progress', (data) => {
  console.log(`Progress: ${data.progress}% - ${data.stage}`);
});

socket.on('job:complete', (data) => {
  console.log('✅ Job completed:', data);
});
```

#### コミット
```bash
git add src/api/websocket-server.ts
git commit -m "feat(api): Add WebSocket real-time progress system [iteration-67-A4]"
```

---

### Iteration A5: OpenAPI仕様書生成

#### 目標
- Swagger/OpenAPI仕様書自動生成
- API ドキュメントUI
- エンドポイントテストUI

#### アクション
```bash
npm install swagger-ui-express swagger-jsdoc

# src/api/swagger.ts を作成
```

#### 成功基準
```typescript
const iteration_a5_criteria = {
  swaggerUIAccessible: true,
  allEndpointsDocumented: true,
  testFromUIWorks: true
};
```

#### コミット
```bash
git add src/api/swagger.ts
git commit -m "docs(api): Add OpenAPI/Swagger documentation [iteration-67-A5]"
```

---

## 🔄 Phase A 完了評価

### 自動評価スクリプト

```typescript
// scripts/evaluate-phase-a.ts
async function evaluatePhaseA() {
  const metrics = {
    api_response_time: await measureAPIResponseTime(),
    auth_success_rate: await measureAuthSuccessRate(),
    websocket_latency: await measureWebSocketLatency(),
    documentation_completeness: checkDocumentationCompleteness()
  };

  console.log('📊 Phase A Metrics:', metrics);

  const thresholds = {
    api_response_time: 100, // ms
    auth_success_rate: 0.99,
    websocket_latency: 50, // ms
    documentation_completeness: 1.0
  };

  const passed = Object.keys(metrics).every(key =>
    metrics[key] <= thresholds[key] || metrics[key] >= thresholds[key]
  );

  if (passed) {
    console.log('✅ Phase A 完了 - Phase Bへ移行可能');
    return { phaseComplete: true, score: calculateScore(metrics) };
  } else {
    console.log('⚠️ Phase A 要改善');
    return { phaseComplete: false, improvements: suggestImprovements(metrics) };
  }
}
```

### Phase A コミット
```bash
# 全イテレーション完了時
git add .
git commit -m "feat(iteration-67): Complete Phase A - API Development [score: 98%]"
git tag iteration-67-phase-a-complete
```

---

## 📋 Phase B: チーム・権限管理（実装予定）

### 段階的アプローチ
- Iteration B1: 基本ワークスペース機能
- Iteration B2: メンバー招待システム
- Iteration B3: RBAC基盤
- Iteration B4: カスタムロール
- Iteration B5: 権限監査ログ

（各イテレーションの詳細はPhase A完了後に展開）

---

## 📋 Phase C: スケーリング・インフラ（実装予定）

### 段階的アプローチ
- Iteration C1: マルチテナント基盤
- Iteration C2: 負荷分散設定
- Iteration C3: 監視システム統合
- Iteration C4: アラート設定

（各イテレーションの詳細はPhase B完了後に展開）

---

## 🔧 トラブルシューティングプロトコル

### 問題発生時の対応手順

```typescript
class Iteration67TroubleshootingProtocol {
  async handleFailure(iteration: string, error: Error) {
    console.log(`🔍 Analyzing failure in ${iteration}...`);

    // 1. 状態保存
    await this.saveState();

    // 2. 問題分類
    const category = this.categorizeError(error);

    // 3. 解決策選択
    switch(category) {
      case 'dependency':
        return this.fixDependencies();
      case 'integration':
        return this.rollbackToLastIteration();
      case 'logic':
        return this.refactorLogic();
      default:
        return this.minimalFallback();
    }
  }

  private async rollbackToLastIteration() {
    console.log('↩️ Rolling back to last successful iteration...');
    // git checkout <last-iteration-tag>
    // 問題のある変更のみを段階的に再実装
  }
}
```

---

## 📊 品質メトリクス

### Iteration 67 目標

```yaml
quality_targets:
  phase_a:
    api_response_time: "< 100ms"
    auth_success_rate: "> 99%"
    websocket_latency: "< 50ms"
    documentation: "100%"

  phase_b:
    workspace_creation: "< 2s"
    member_invite_success: "> 99%"
    permission_accuracy: "100%"
    audit_log_completeness: "100%"

  phase_c:
    scaling_response: "< 30s"
    load_balancing_efficiency: "> 95%"
    system_uptime: "> 99.9%"
    monitoring_coverage: "100%"
```

---

## 🎯 実行開始コマンド

```bash
# Phase A 開始
echo "🚀 Starting Iteration 67 - Phase A: API Development"
echo "Following Custom Instruction Principles: Incremental, Recursive, Testable"

# 次のステップ
echo "📋 Ready to execute Iteration A1: Minimal REST API"
echo "Type 'yes' to proceed with implementation..."
```

---

**作成者**: Claude Code AI Assistant
**実行モード**: カスタムインストラクション準拠
**ステータス**: 実行計画完成 - 実装開始待ち
