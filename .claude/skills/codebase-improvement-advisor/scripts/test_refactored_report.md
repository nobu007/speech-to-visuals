# コードベース改善提案レポート

生成日時: 2025-12-06 17:15:40

## 📊 サマリー

- **分析ファイル数**: 9 ファイル
- **総コード行数**: 2,793 行
- **発見された問題**: 725 件
  - 🔴 高優先度: 124 件
  - 🟡 中優先度: 601 件
  - 🟢 低優先度: 0 件

## 💡 推奨事項

- 🔴 優先度の高い問題が124件あります。まずこれらの対処を推奨します。
- ⏱️ 全問題の修正には約792.5日を見積もります。

## 🎯 優先度別タスクリスト

### 🔴 高優先度 (124件)

#### 1. 関数が長すぎます

**ファイル**: `codebase_analyzer.py:117`

**説明**: この関数は1532行あり、推奨される50行を超えています。

**提案**: 関数を複数の小さな関数に分割してください。

**見積もり**: 4h

---

#### 2. 関数が長すぎます

**ファイル**: `refactoring_helper.py:40`

**説明**: この関数は285行あり、推奨される50行を超えています。

**提案**: 関数を複数の小さな関数に分割してください。

**見積もり**: 4h

---

#### 3. セキュリティ上の懸念

**ファイル**: `modules/main_analyzer.py:261`

**説明**: eval()の使用はセキュリティリスク

**提案**: より安全な代替方法を使用してください。

**見積もり**: 4h

---

#### 4. 重複クラス: CodeIssue

**ファイル**: `/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.py:62`

**説明**: このクラスは/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.pyのクラスと同一実装です。

**提案**: 基底クラスとして抽出してください。

**見積もり**: 4h

---

#### 5. 重複クラス: CodeIssue

**ファイル**: `/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.py:62`

**説明**: このクラスは/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.pyのクラスと同一実装です。

**提案**: 基底クラスとして抽出してください。

**見積もり**: 4h

---

#### 6. 重複クラス: CodeIssue

**ファイル**: `/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.py:62`

**説明**: このクラスは/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.pyのクラスと同一実装です。

**提案**: 基底クラスとして抽出してください。

**見積もり**: 4h

---

#### 7. 重複クラス: CodeIssue

**ファイル**: `/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/modules/models.py:8`

**説明**: このクラスは/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.pyのクラスと同一実装です。

**提案**: 基底クラスとして抽出してください。

**見積もり**: 4h

---

#### 8. 重複クラス: CodeIssue

**ファイル**: `/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.py:62`

**説明**: このクラスは/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.pyのクラスと同一実装です。

**提案**: 基底クラスとして抽出してください。

**見積もり**: 4h

---

#### 9. 重複クラス: CodeIssue

**ファイル**: `/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/modules/models.py:8`

**説明**: このクラスは/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.pyのクラスと同一実装です。

**提案**: 基底クラスとして抽出してください。

**見積もり**: 4h

---

#### 10. 重複クラス: CodeIssue

**ファイル**: `/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.py:62`

**説明**: このクラスは/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.pyのクラスと同一実装です。

**提案**: 基底クラスとして抽出してください。

**見積もり**: 4h

---

... さらに 114 件の問題

### 🟡 中優先度 (601件)

#### 1. 重複関数: generate_markdown_report

**ファイル**: `/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.py:1649`

**説明**: この関数は/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.pyの関数と同一実装です。

**提案**: 共通ユーティリティ関数として抽出してください。

**見積もり**: 1h

---

#### 2. 重複関数: generate_markdown_report

**ファイル**: `/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.py:1649`

**説明**: この関数は/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.pyの関数と同一実装です。

**提案**: 共通ユーティリティ関数として抽出してください。

**見積もり**: 1h

---

#### 3. 重複関数: generate_markdown_report

**ファイル**: `/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.py:1649`

**説明**: この関数は/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.pyの関数と同一実装です。

**提案**: 共通ユーティリティ関数として抽出してください。

**見積もり**: 1h

---

#### 4. 重複関数: generate_markdown_report

**ファイル**: `/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.py:1649`

**説明**: この関数は/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.pyの関数と同一実装です。

**提案**: 共通ユーティリティ関数として抽出してください。

**見積もり**: 1h

---

#### 5. 重複関数: generate_markdown_report

**ファイル**: `/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.py:1649`

**説明**: この関数は/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.pyの関数と同一実装です。

**提案**: 共通ユーティリティ関数として抽出してください。

**見積もり**: 1h

---

#### 6. 重複関数: generate_markdown_report

**ファイル**: `/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.py:1649`

**説明**: この関数は/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.pyの関数と同一実装です。

**提案**: 共通ユーティリティ関数として抽出してください。

**見積もり**: 1h

---

#### 7. 重複関数: generate_markdown_report

**ファイル**: `/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.py:1649`

**説明**: この関数は/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.pyの関数と同一実装です。

**提案**: 共通ユーティリティ関数として抽出してください。

**見積もり**: 1h

---

#### 8. 重複関数: generate_markdown_report

**ファイル**: `/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.py:1649`

**説明**: この関数は/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.pyの関数と同一実装です。

**提案**: 共通ユーティリティ関数として抽出してください。

**見積もり**: 1h

---

#### 9. 重複関数: main

**ファイル**: `/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.py:1803`

**説明**: この関数は/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.pyの関数と同一実装です。

**提案**: 共通ユーティリティ関数として抽出してください。

**見積もり**: 1h

---

#### 10. 重複関数: main

**ファイル**: `/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.py:1803`

**説明**: この関数は/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.pyの関数と同一実装です。

**提案**: 共通ユーティリティ関数として抽出してください。

**見積もり**: 1h

---

... さらに 591 件の問題

## 📈 問題タイプ別分析

### 複雑度 (2件)

**問題の多いファイル**:
- `codebase_analyzer.py`: 1件
- `refactoring_helper.py`: 1件

### セキュリティ (1件)

**問題の多いファイル**:
- `modules/main_analyzer.py`: 1件

### 重複コード (721件)

**問題の多いファイル**:
- `/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.py`: 496件
- `/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/refactoring_helper.py`: 105件
- `/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/modules/main_analyzer.py`: 68件
- `/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/modules/models.py`: 24件
- `/home/jinno/computer-use-windsurf/.claude/skills/codebase-improvement-advisor/scripts/modules/jscpd_analyzer.py`: 18件

### テスト (1件)

**問題の多いファイル**:
- `プロジェクト全体`: 1件

## 🌐 言語別統計

| 言語 | ファイル数 | コード行数 | 関数数 | クラス数 | 平均複雑度 |
|------|----------|----------|--------|--------|------------|
| python | 9 | 2,793 | 100 | 25 | 25.6 |
