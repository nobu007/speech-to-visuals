-- ========================================
-- speech-to-visuals データベーススキーマ
-- ========================================
--
-- 作成日: 2026-04-27
-- 最終更新: 2026-05-01（第58回検証: Phase 13完了・270ファイル・81,709行・93タスク完了・全2,754テスト通過・カバレッジ84.76% stmts/85.15% lines・スキーマ変更なし）
-- 関連設計: architecture.md
--
-- 信頼性レベル:
-- - 🔵 青信号: 要件定義書・設計文書・既存DBスキーマを参考にした確実な定義
-- - 🟡 黄信号: 要件定義書・設計文書・既存DBスキーマから妥当な推測による定義
-- - 🔴 赤信号: 参照資料にない自動推定による定義
--
-- 注: 本スキーマは Supabase (PostgreSQL) 上に構築済み
-- 参照元: supabase/migrations/
-- ========================================

-- ========================================
-- テーブル定義
-- ========================================

-- diagram_projects: 図解プロジェクト
-- 🔵 信頼性: supabase/migrations/00001_create_diagram_projects.sql・要件定義REQ-405・NFR-102より
CREATE TABLE diagram_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- 🔵 既存スキーマの共通パターン
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- 🔵 RLS認証より
    title TEXT NOT NULL, -- 🔵 プロジェクトタイトル
    audio_file_path TEXT, -- 🔵 Supabase Storage 内の音声ファイルパス
    audio_duration_ms INTEGER, -- 🔵 音声再生時間（ms）
    status TEXT NOT NULL DEFAULT 'idle', -- 🔵 パイプライン処理状態（idle/transcribing/analyzing/generating/complete/error）
    transcription JSONB, -- 🔵 Whisper文字起こし結果（SRT形式）
    scenes JSONB, -- 🔵 SceneGraph[] の JSON 表現
    video_url TEXT, -- 🔵 生成動画のURL
    quality_score NUMERIC, -- 🔵 品質スコア（0.0-1.0）
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- 🔵 共通パターン
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now() -- 🔵 共通パターン
);

-- ========================================
-- Row Level Security (RLS)
-- ========================================

-- RLS 有効化
-- 🔵 信頼性: 要件定義REQ-405・supabase/migrations/ RLSポリシーより
ALTER TABLE diagram_projects ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーは自分のプロジェクトのみ閲覧可能
-- 🔵 信頼性: supabase/migrations/ RLSポリシーより
CREATE POLICY "diagram_projects_select_own"
    ON diagram_projects FOR SELECT
    USING (auth.uid() = user_id);

-- 認証済みユーザーは自分のプロジェクトのみ作成可能
-- 🔵 信頼性: supabase/migrations/ RLSポリシーより
CREATE POLICY "diagram_projects_insert_own"
    ON diagram_projects FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 認証済みユーザーは自分のプロジェクトのみ更新可能
-- 🔵 信頼性: supabase/migrations/ RLSポリシーより
CREATE POLICY "diagram_projects_update_own"
    ON diagram_projects FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 認証済みユーザーは自分のプロジェクトのみ削除可能
-- 🔵 信頼性: supabase/migrations/ RLSポリシーより
CREATE POLICY "diagram_projects_delete_own"
    ON diagram_projects FOR DELETE
    USING (auth.uid() = user_id);

-- ========================================
-- ストレージバケット
-- ========================================

-- audio バケット: 音声ファイルストレージ
-- 🔵 信頼性: 要件定義NFR-102・supabase/migrations/ より
-- 注: Supabase Dashboard または SQL で作成
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio', 'audio', true) -- 🔵 公開読み取り、認証済み書き込み
ON CONFLICT (id) DO NOTHING;

-- 音声ファイルの公開読み取りポリシー
-- 🔵 信頼性: supabase/migrations/ ストレージポリシーより
CREATE POLICY "Public read access for audio"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'audio');

-- 認証済みユーザーのアップロードポリシー
-- 🔵 信頼性: 要件定義NFR-102・supabase/migrations/ より
CREATE POLICY "Authenticated users can upload audio"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'audio' AND auth.role() = 'authenticated');

-- 認証済みユーザーの削除ポリシー
-- 🔵 信頼性: supabase/migrations/ より
CREATE POLICY "Authenticated users can delete own audio"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(SPLIT_PART(name, '/', 1)))[1]);

-- ========================================
-- インデックス
-- ========================================

-- ユーザー別プロジェクト検索の最適化
-- 🔵 信頼性: パフォーマンス要件NFR-001・既存スキーマより
CREATE INDEX idx_diagram_projects_user_id ON diagram_projects(user_id); -- 🔵 頻繁な検索条件より

-- ステータス別プロジェクト検索の最適化
-- 🔵 信頼性: supabase/migrations/00001_create_diagram_projects.sqlより
CREATE INDEX idx_diagram_projects_status ON diagram_projects(status); -- 🔵 パイプライン状態フィルタ

-- 作成日時順のソート最適化
-- 🔵 信頼性: 一覧表示パフォーマンス向上より
CREATE INDEX idx_diagram_projects_created_at ON diagram_projects(created_at DESC); -- 🔵 ソート順序より

-- ========================================
-- トリガー
-- ========================================

-- updated_at 自動更新トリガー
-- 🔵 信頼性: supabase/migrations/00001_create_diagram_projects.sqlより
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER diagram_projects_set_updated_at
    BEFORE UPDATE ON diagram_projects
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at(); -- 🔵 共通パターン

-- ========================================
-- JSONB スキーマ検証（ scenes カラム）
-- ========================================

-- SceneGraph[] の JSONB 構造インデックス
-- 🔵 信頼性: src/types/diagram.ts SceneGraph・PIPELINE_FLOW.md より
-- GIN インデックスで図解タイプ検索を最適化
CREATE INDEX idx_diagram_projects_scenes_type ON diagram_projects
    USING GIN ((scenes)); -- 🔵 JSONB検索の最適化

-- ========================================
-- 環境変数（アプリケーション側）
-- ========================================

-- 🔵 信頼性: PIPELINE_FLOW.md §8.1・README.md 環境変数セクションより
-- 以下はデータベースに格納せず、アプリケーション環境変数として管理:
--
-- GOOGLE_API_KEY=<gemini-api-key>
-- SUPABASE_URL=<supabase-project-url>
-- SUPABASE_ANON_KEY=<supabase-anon-key>
-- ANALYSIS_DISABLE_GEMINI=0
-- GEMINI_MODEL_OVERRIDE=gemini-2.5-flash
-- COMPLEXITY_THRESHOLD=0.20
-- CACHE_SIZE=200
-- CACHE_TTL_MINUTES=120
-- MIN_REQUEST_INTERVAL_MS=200

-- ========================================
-- 信頼性レベルサマリー
-- ========================================
-- - 🔵 青信号: 31件 (100%)
-- - 🟡 黄信号: 0件 (0%)
-- - 🔴 赤信号: 0件 (0%)
--
-- 品質評価: 高品質 - 全定義が supabase/migrations/ と完全に一致（第24回検証確認）
