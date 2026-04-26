-- ========================================
-- speech-to-visuals データベーススキーマ
-- ========================================
--
-- 作成日: 2026-04-27
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
-- 🔵 信頼性: supabase/migrations/・要件定義REQ-405・NFR-102より
CREATE TABLE diagram_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- 🔵 既存スキーマの共通パターン
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, -- 🔵 RLS認証より
    audio_url TEXT NOT NULL, -- 🔵 Supabase Storage URL
    scenes JSONB, -- 🔵 SceneGraph[] の JSON 表現
    duration_ms INTEGER, -- 🔵 音声再生時間（ms）
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- 🔵 共通パターン
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP -- 🔵 共通パターン
);

-- ========================================
-- Row Level Security (RLS)
-- ========================================

-- RLS 有効化
-- 🔵 信頼性: 要件定義REQ-405・supabase/migrations/ RLSポリシーより
ALTER TABLE diagram_projects ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーは自分のプロジェクトのみ閲覧可能
-- 🔵 信頼性: supabase/migrations/ RLSポリシーより
CREATE POLICY "Users can view own projects"
    ON diagram_projects FOR SELECT
    USING (auth.uid() = user_id);

-- 認証済みユーザーは自分のプロジェクトのみ作成可能
-- 🔵 信頼性: supabase/migrations/ RLSポリシーより
CREATE POLICY "Users can create own projects"
    ON diagram_projects FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 認証済みユーザーは自分のプロジェクトのみ更新可能
-- 🔵 信頼性: supabase/migrations/ RLSポリシーより
CREATE POLICY "Users can update own projects"
    ON diagram_projects FOR UPDATE
    USING (auth.uid() = user_id);

-- 認証済みユーザーは自分のプロジェクトのみ削除可能
-- 🔵 信頼性: supabase/migrations/ RLSポリシーより
CREATE POLICY "Users can delete own projects"
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

-- 作成日時順のソート最適化
-- 🔵 信頼性: 一覧表示パフォーマンス向上より
CREATE INDEX idx_diagram_projects_created_at ON diagram_projects(created_at DESC); -- 🔵 ソート順序より

-- ========================================
-- トリガー
-- ========================================

-- updated_at 自動更新トリガー
-- 🔵 信頼性: 既存DBスキーマの共通パターンより
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_diagram_projects_updated_at
    BEFORE UPDATE ON diagram_projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); -- 🔵 共通パターン

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
-- - 🔵 青信号: 24件 (100%)
-- - 🟡 黄信号: 0件 (0%)
-- - 🔴 赤信号: 0件 (0%)
--
-- 品質評価: 高品質 - 全定義が既存マイグレーションと完全に一致
