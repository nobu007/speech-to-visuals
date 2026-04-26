-- ============================================================
-- Migration: 00001_create_diagram_projects
-- Description: Create diagram_projects table with full schema,
--              RLS policies, indexes, and auto-update trigger
-- ============================================================

-- Drop existing table and related objects if they exist (for clean migration)
DROP TRIGGER IF EXISTS set_updated_at ON public.diagram_projects;
DROP TRIGGER IF EXISTS diagram_projects_set_updated_at ON public.diagram_projects;
DROP FUNCTION IF EXISTS public.handle_updated_at();
DROP FUNCTION IF EXISTS public.set_updated_at();
DROP TABLE IF EXISTS public.diagram_projects;

-- diagram_projects テーブル作成
CREATE TABLE IF NOT EXISTS public.diagram_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  audio_file_path TEXT,
  audio_duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'idle',
  transcription JSONB,
  scenes JSONB,
  video_url TEXT,
  quality_score NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS 有効化
ALTER TABLE public.diagram_projects ENABLE ROW LEVEL SECURITY;

-- RLS ポリシー
CREATE POLICY "diagram_projects_select_own" ON public.diagram_projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "diagram_projects_insert_own" ON public.diagram_projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "diagram_projects_update_own" ON public.diagram_projects
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "diagram_projects_delete_own" ON public.diagram_projects
  FOR DELETE USING (auth.uid() = user_id);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_diagram_projects_user_id ON public.diagram_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_diagram_projects_status ON public.diagram_projects(status);
CREATE INDEX IF NOT EXISTS idx_diagram_projects_created_at ON public.diagram_projects(created_at DESC);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER diagram_projects_set_updated_at
  BEFORE UPDATE ON public.diagram_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
