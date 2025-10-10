# Speech-to-Visuals: 音声→図解動画自動生成システム

音声ファイルから自動的に図解とアニメーション動画を生成するシステムです。

## 主要機能

- **音声認識**: Whisper + Web Speech API による高精度文字起こし
- **図解自動生成**: AI による内容分析と図解タイプ自動検出
- **動画作成**: Remotion による高品質アニメーション動画出力
- **リアルタイムUI**: 処理進捗とメトリクスのリアルタイム表示

## クイックスタート

```sh
# 1. 依存関係のインストール
npm install

# 2. 開発サーバーの起動
npm run dev

# 3. ブラウザでアクセス
# http://localhost:8080/simple (推奨 - Simple Pipeline)
# http://localhost:8080/ (標準インターフェース)
```

詳細は [QUICK_START.md](QUICK_START.md) を参照してください。

## 技術スタック

### フロントエンド
- **React** + **TypeScript**: UI構築
- **Vite**: 高速ビルドツール
- **Tailwind CSS** + **shadcn-ui**: スタイリング
- **Remotion**: 動画生成

### バックエンド・処理
- **Whisper**: 音声文字起こし
- **Web Speech API**: ブラウザ音声認識
- **Dagre**: グラフレイアウト生成

## 対応ファイル形式

- **音声**: MP3, WAV, OGG, M4A (最大50MB)
- **出力**: JSON (図解データ), MP4 (動画)

## 図解タイプ

- マインドマップ (概念関係性)
- フローチャート (プロセス説明)
- ツリー構造 (階層関係)
- タイムライン (時系列)
- 概念図 (一般的関係)

## 開発コマンド

```sh
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# 型チェック
npm run type-check

# Remotion Studio
npm run remotion:studio
```

## ドキュメント

- [QUICK_START.md](QUICK_START.md) - クイックスタートガイド
- [TESTING_GUIDE.md](TESTING_GUIDE.md) - テストガイド

## ライセンス

MIT License
