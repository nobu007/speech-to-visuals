# speech-to-visuals API エンドポイント仕様

**作成日**: 2026-04-27
**最終更新**: 2026-05-01（第24回検証: Kairo設計再検証・要件カバレッジ100%維持確認・設計整合性確認）
**関連設計**: [architecture.md](architecture.md)
**関連要件定義**: [requirements.md](requirements.md)

**【信頼性レベル凡例】**:
- 🔵 **青信号**: 要件定義書・設計文書・既存API仕様を参考にした確実な定義
- 🟡 **黄信号**: 要件定義書・設計文書・既存API仕様から妥当な推測による定義
- 🔴 **赤信号**: 参照資料にない自動推定による定義

---

## 共通仕様

### アーキテクチャ 🔵

**信頼性**: 🔵 *src/api/batch-processing-api.ts・supabase/functions/ より*

APIは2種類の実装で構成:
1. **Express REST API**: バッチ処理・ジョブ管理（`src/api/batch-processing-api.ts`）
2. **Supabase Edge Functions**: 動画レンダリング・文字起こし・シーン生成（`supabase/functions/`）

### 認証 🔵

**信頼性**: 🔵 *要件定義NFR-102・supabase/migrations/ RLSより*

- Express API: Supabase Auth JWT（Authorization: Bearer {token}）
- Edge Functions: Supabase Auth コンテキスト
- 未認証アクセスは401エラー

### セキュリティ 🔵

**信頼性**: 🔵 *要件定義NFR-103・package.json 依存関係より*

- express-rate-limit: レート制限
- helmet: セキュリティヘッダー（CSP, HSTS, X-Frame-Options 等）
- CORS: 許可オリジン設定

### エラーレスポンス共通フォーマット 🔵

**信頼性**: 🔵 *src/types/api/・PIPELINE_FLOW.md §7.2 より*

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "エラーメッセージ",
    "details": {}
  }
}
```

---

## Express REST API エンドポイント

### ベースURL 🔵

**信頼性**: 🔵 *src/api/batch-processing-api.ts より*

```
http://localhost:3001/api/v1
```

起動コマンド: `npm run api:dev`

---

### バッチジョブ管理

#### POST /api/v1/batch/jobs 🔵

**信頼性**: 🔵 *要件定義REQ-201・src/api/batch-processing-api.ts より*

**関連要件**: REQ-201

**説明**: バッチ処理ジョブの作成

**リクエスト**:
```json
{
  "files": [
    {
      "path": "/path/to/audio1.mp3",
      "options": {
        "language": "auto",
        "model": "base"
      }
    },
    {
      "path": "/path/to/audio2.wav"
    }
  ],
  "concurrency": 3,
  "options": {
    "rendering": {
      "fps": 30,
      "resolution": "1080p",
      "codec": "h264"
    }
  }
}
```

**レスポンス（成功）**:
```json
{
  "success": true,
  "data": {
    "jobId": "batch-job-uuid",
    "status": "queued",
    "totalFiles": 2,
    "createdAt": "2026-04-27T10:00:00Z"
  }
}
```

**エラーコード**:
- `VALIDATION_ERROR`: リクエストパラメータ不正
- `TOO_MANY_FILES`: ファイル数制限超過

---

#### GET /api/v1/batch/jobs/:jobId 🔵

**信頼性**: 🔵 *要件定義REQ-201・src/api/batch-processing-api.ts より*

**関連要件**: REQ-201

**説明**: バッチジョブのステータス取得

**パスパラメータ**:
- `jobId`: ジョブID

**レスポンス（成功）**:
```json
{
  "success": true,
  "data": {
    "id": "batch-job-uuid",
    "status": "processing",
    "progress": 45,
    "eta": 30,
    "files": [
      {
        "filename": "audio1.mp3",
        "status": "complete",
        "qualityScore": 0.92
      },
      {
        "filename": "audio2.wav",
        "status": "analyzing",
        "qualityScore": null
      }
    ],
    "createdAt": "2026-04-27T10:00:00Z",
    "updatedAt": "2026-04-27T10:00:30Z"
  }
}
```

**エラーコード**:
- `JOB_NOT_FOUND`: ジョブが見つからない

---

#### POST /api/v1/batch/jobs/:jobId/cancel 🔵

**信頼性**: 🔵 *src/api/batch-processing-api.ts より*

**説明**: バッチジョブのキャンセル

**パスパラメータ**:
- `jobId`: ジョブID

**レスポンス（成功）**:
```json
{
  "success": true,
  "data": {
    "id": "batch-job-uuid",
    "status": "cancelled"
  }
}
```

**エラーコード**:
- `JOB_NOT_FOUND`: ジョブが見つからない
- `JOB_ALREADY_COMPLETED`: ジョブは既に完了している

---

## Supabase Edge Functions

### POST /functions/v1/transcribe-audio 🔵

**信頼性**: 🔵 *supabase/functions/・PIPELINE_FLOW.md Stage 1・要件定義REQ-001より*

**関連要件**: REQ-001, REQ-003, REQ-004

**説明**: 音声ファイルの文字起こし

**リクエスト**:
```json
{
  "audioUrl": "supabase-storage://audio/user-id/file.mp3",
  "options": {
    "model": "base",
    "language": "auto"
  }
}
```

**レスポンス（成功）**:
```json
{
  "success": true,
  "data": {
    "transcript": "文字起こしされたテキスト...",
    "srt": "1\n00:00:00,000 --> 00:00:03,500\nこんにちは...",
    "language": "ja",
    "segments": [
      {
        "startMs": 0,
        "endMs": 3500,
        "text": "こんにちは"
      }
    ],
    "durationMs": 60000
  }
}
```

**エラーコード**:
- `INVALID_AUDIO_FORMAT`: 対応外の音声形式
- `FILE_TOO_LARGE`: 50MB超過
- `EMPTY_FILE`: 空ファイル
- `TRANSCRIPTION_FAILED`: 文字起こし失敗

---

### POST /functions/v1/generate-scenes 🔵

**信頼性**: 🔵 *supabase/functions/・PIPELINE_FLOW.md Stage 2・要件定義REQ-006より*

**関連要件**: REQ-005, REQ-006, REQ-007, REQ-008

**説明**: テキストから図解シーンデータの生成

**リクエスト**:
```json
{
  "transcript": "文字起こしテキスト...",
  "language": "ja",
  "options": {
    "preferredModel": "auto",
    "enableCache": true
  }
}
```

**レスポンス（成功）**:
```json
{
  "success": true,
  "data": {
    "scenes": [
      {
        "type": "flow",
        "nodes": [
          { "id": "n1", "label": "開始" },
          { "id": "n2", "label": "処理" }
        ],
        "edges": [
          { "from": "n1", "to": "n2", "label": "実行" }
        ],
        "startMs": 0,
        "durationMs": 15000,
        "summary": "プロセスの開始から処理まで",
        "keyphrases": ["開始", "処理"]
      }
    ],
    "metadata": {
      "model": "gemini-2.5-flash",
      "fromCache": false,
      "complexity": {
        "score": 0.15,
        "recommendedModel": "gemini-2.5-flash"
      }
    }
  }
}
```

**エラーコード**:
- `LLM_TIMEOUT`: LLM API タイムアウト
- `LLM_RATE_LIMITED`: レートリミット（429）
- `FALLBACK_USED`: フォールバック使用（成功）

---

### POST /functions/v1/render-video 🔵

**信頼性**: 🔵 *supabase/functions/・PIPELINE_FLOW.md Stage 4-5・要件定義REQ-301より*

**関連要件**: REQ-301

**説明**: シーンデータから動画レンダリング

**リクエスト**:
```json
{
  "scenes": [...],
  "audioUrl": "supabase-storage://audio/user-id/file.mp3",
  "srt": "1\n00:00:00,000 --> ...",
  "options": {
    "fps": 30,
    "resolution": "1080p",
    "codec": "h264"
  }
}
```

**レスポンス（成功）**:
```json
{
  "success": true,
  "data": {
    "videoUrl": "supabase-storage://videos/user-id/output.mp4",
    "duration": 60,
    "fileSize": 5242880,
    "resolution": "1920x1080",
    "fps": 30,
    "codec": "h264"
  }
}
```

**エラーコード**:
- `RENDER_FAILED`: レンダリング失敗
- `LOW_QUALITY_RETRY`: 低品質設定で再試行中

---

### POST /api/v1/transcribe/streaming 🔵

**信頼性**: 🔵 *src/transcription/streaming-transcriber.ts・要件定義REQ-036より*

**関連要件**: REQ-036

**説明**: ストリーミング音声文字起こし（チャンク単位逐次処理）

**リクエスト**:
```json
{
  "audioData": "base64-encoded-audio-chunk",
  "chunkIndex": 0,
  "totalChunks": 10,
  "options": {
    "chunkSizeMs": 3000,
    "overlapMs": 500,
    "minConfidence": 0.7,
    "language": "auto"
  }
}
```

**レスポンス（成功）**:
```json
{
  "success": true,
  "data": {
    "segment": "文字起こしされたテキスト",
    "confidence": 0.92,
    "progress": {
      "processedDuration": 3000,
      "totalDuration": 60000,
      "segmentCount": 1,
      "averageConfidence": 0.92
    }
  }
}
```

**エラーコード**:
- `STREAMING_NOT_SUPPORTED`: ブラウザがストリーミング非対応
- `CHUNK_PROCESSING_FAILED`: チャンク処理失敗（継続可能）

---

### POST /api/v1/errors/:errorId/recover 🔵

**信頼性**: 🔵 *src/quality/user-guided-error-recovery.ts・要件定義REQ-037より*

**関連要件**: REQ-037

**説明**: エラー回復アクションの実行

**パスパラメータ**:
- `errorId`: エラーID

**リクエスト**:
```json
{
  "strategyId": "retry-with-fallback",
  "userChoice": "auto",
  "context": {
    "pipelineStage": "analysis",
    "originalError": "LLM_TIMEOUT"
  }
}
```

**レスポンス（成功）**:
```json
{
  "success": true,
  "data": {
    "recovered": true,
    "strategyUsed": "fallback-llm",
    "processingResumed": true
  }
}
```

**エラーコード**:
- `RECOVERY_FAILED`: 回復失敗
- `INVALID_STRATEGY`: 無効な戦略ID

---

### GET /api/v1/errors/:errorId/options 🔵

**信頼性**: 🔵 *src/quality/user-guided-error-recovery.ts・要件定義REQ-037より*

**関連要件**: REQ-037

**説明**: エラーに対する回復オプション一覧取得

**パスパラメータ**:
- `errorId`: エラーID

**レスポンス（成功）**:
```json
{
  "success": true,
  "data": {
    "category": "analysis",
    "severity": "high",
    "userMessage": "内容分析に失敗しました",
    "recoveryStrategies": [
      {
        "id": "retry-fallback",
        "name": "フォールバックモデルで再試行",
        "description": "より軽量なモデルで再分析します",
        "automated": true,
        "estimatedTime": 10,
        "successRate": 0.85
      },
      {
        "id": "rule-based",
        "name": "ルールベース処理",
        "description": "AIを使わずルールベースで図解を生成します",
        "automated": true,
        "estimatedTime": 2,
        "successRate": 0.99
      }
    ],
    "preventionTips": ["音声品質を確認してください"]
  }
}
```

---

## WebSocket イベント（Socket.IO）

### 認証 🔵

**信頼性**: 🔵 *src/api/websocket-handler.ts・要件定義REQ-046 より*

WebSocket 接続時には JWT 認証が必須です:

```javascript
const socket = io(SERVER_URL, {
  auth: { token: jwtToken }
});
```

未認証接続は `Authentication required` エラーで拒否されます。

### クライアント → サーバー 🔵

**信頼性**: 🔵 *src/api/websocket-handler.ts・要件定義REQ-046 より*

| イベント | ペイロード | 説明 |
|---------|-----------|------|
| `join:job` | `{ jobId: string }` | ジョブ進捗のリアルタイム監視開始 |
| `leave:job` | `{ jobId: string }` | ジョブ監視の終了 |

### サーバー → クライアント 🔵

**信頼性**: 🔵 *src/api/websocket-handler.ts・要件定義REQ-046 より*

| イベント | ペイロード | 説明 |
|---------|-----------|------|
| `job:joined` | `{ jobId }` | ルーム参加確認 |
| `job:progress` | `{ jobId, total, completed, failed, percentage }` | ジョブ進捗更新 |
| `job:complete` | `{ jobId, timestamp, progress }` | ジョブ完了通知 |
| `job:error` | `{ jobId, error, fileId? }` | ジョブエラー通知 |
| `file:status` | `{ jobId, fileId, status, qualityScore? }` | ファイル処理ステータス |
| `stage:progress` | `{ jobId, fileId, stage, progress }` | ステージ別進捗（transcription/visualization等） |
| `streaming:segment` | `{ sessionId, segment, confidence, progress }` | ストリーミング文字起こしセグメント通知 🔵 *REQ-036* |
| `streaming:complete` | `{ sessionId, fullTranscript, statistics }` | ストリーミング文字起こし完了 🔵 *REQ-036* |
| `error:recovery` | `{ errorId, category, severity, strategies }` | エラー回復オプション通知 🔵 *REQ-037* |
| `error:recovered` | `{ errorId, strategy, success }` | エラー回復結果通知 🔵 *REQ-037* |

---

## レート制限 🟡

**信頼性**: 🟡 *要件定義NFR-103・package.json express-rate-limit より*

- 認証済みユーザー: 100リクエスト/15分
- バッチジョブ: 最大10ファイル/ジョブ

レート制限超過時のレスポンス:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "レート制限を超過しました",
    "details": {
      "retryAfter": 900
    }
  }
}
```

## CORS設定 🔵

**信頼性**: 🔵 *要件定義NFR-103・src/api/ より*

許可オリジン: `http://localhost:8080`（開発環境）、本番URL（本番環境）

## 関連文書

- **アーキテクチャ**: [architecture.md](architecture.md)
- **型定義**: [interfaces.ts](interfaces.ts)
- **データフロー**: [dataflow.md](dataflow.md)
- **DBスキーマ**: [database-schema.sql](database-schema.sql)
- **要件定義**: [requirements.md](requirements.md)

## 信頼性レベルサマリー

- 🔵 青信号: 42件 (95%)
- 🟡 黄信号: 2件 (5%)
- 🔴 赤信号: 0件 (0%)

**品質評価**: 高品質 - Phase 5 バッチ API・Edge Functions 共通基盤（REQ-043~049）反映済

---

## Phase 5 追加エンドポイント

### GET /api/v1/health 🔵

**信頼性**: 🔵 *src/api/routes/health.ts より*

**説明**: API サーバーのヘルスチェック

**レスポンス（成功）**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": 3600,
    "timestamp": "2026-04-29T10:00:00Z"
  }
}
```

---

### DELETE /api/v1/batch/jobs/:jobId 🔵

**信頼性**: 🔵 *src/api/routes/batch.ts・要件定義REQ-043 より*

**関連要件**: REQ-043

**説明**: バッチジョブのキャンセル（DELETE メソッド版）

**パスパラメータ**:
- `jobId`: ジョブID（UUID v4）

**レスポンス（成功）**:
```json
{
  "success": true,
  "data": {
    "id": "batch-job-uuid",
    "status": "cancelled"
  }
}
```

**エラーコード**:
- `JOB_NOT_FOUND`: ジョブが見つからない（HTTP 404）
- `JOB_ALREADY_COMPLETED`: 完了済みジョブはキャンセル不可（HTTP 409）

---

### バッチ処理アーキテクチャ 🔵

**信頼性**: 🔵 *src/api/routes/batch.ts・要件定義REQ-043 より*

- **BatchJobManager**: インメモリジョブ管理（セマフォパターン）
- **並列制御**: 最大3並列ジョブ、4件目以降はキューイング
- **ジョブID**: UUID v4 による一意識別
- **エラー分類**: BatchValidationError, TooManyFilesError, JobNotFoundError, JobAlreadyCompletedError
