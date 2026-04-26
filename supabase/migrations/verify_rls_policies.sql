-- ============================================================
-- Verification: RLS policies for diagram_projects
-- Description: Verify table structure, RLS policies, indexes,
--              and triggers are correctly configured
-- ============================================================

-- テーブル確認
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'diagram_projects';

-- RLS ポリシー確認
SELECT * FROM pg_policies WHERE tablename = 'diagram_projects';

-- インデックス確認
SELECT * FROM pg_indexes WHERE tablename = 'diagram_projects';

-- トリガー確認
SELECT * FROM information_schema.triggers WHERE event_object_table = 'diagram_projects';
