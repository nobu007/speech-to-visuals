-- バケット確認
SELECT id, name, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'audio';

-- ストレージポリシー確認
SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE 'audio_bucket%';

-- ユーザーフォルダ分離テスト（手動実行用コメント）
-- ユーザーAでアップロード → ユーザーBでアクセス不可確認
