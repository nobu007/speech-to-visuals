-- audio バケット作成
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio',
  'audio',
  true,
  52428800, -- 50MB
  ARRAY['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/x-m4a']
) ON CONFLICT (id) DO NOTHING;

-- 公開読み取りポリシー
CREATE POLICY "audio_bucket_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'audio');

-- 認証済みユーザーの書き込みポリシー（自分のフォルダのみ）
CREATE POLICY "audio_bucket_authenticated_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'audio'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 認証済みユーザーの削除ポリシー（自分のフォルダのみ）
CREATE POLICY "audio_bucket_authenticated_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'audio'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
