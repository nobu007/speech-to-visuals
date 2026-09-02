/**
 * Diagram-type detection evaluation dataset (REQ-421 / D-3).
 *
 * Ground-truth text → expected `DiagramType` pairs for measuring the rule-based
 * detector's agreement rate (`DiagramDetector.detect(null, segments)` — the
 * production path used by main-pipeline / pipeline-orchestrator /
 * simple-pipeline; passing `analysisResult: null` measures the keyword engine
 * alone, which is deterministic and offline).
 *
 * Conventions (pinned by tests/scripts/measure-diagram-detection-accuracy.test.ts):
 *   - every canonical `DIAGRAM_TYPES` entry has >= MIN_CASES_PER_TYPE cases,
 *     with at least one Japanese and one English case per type
 *   - ids are kebab-case and unique across the dataset
 *   - texts are natural (transcription-shaped) monologues that a human labeler
 *     would assign the expected type to — they are NOT tuned to the detector
 *   - labels are HUMAN ground truth, not detector output: cases the detector
 *     currently misses stay in the set (see `note`) so the measured agreement
 *     rate cannot be inflated by dropping hard cases
 *   - each case maps to a single ContentSegment (keyphrases empty) — `detect()`
 *     joins segment text, so a single segment is the canonical minimal shape
 */
import type { DiagramType } from '@stv/core/types/diagram';

export type DiagramEvalLanguage = 'ja' | 'en';

export interface DiagramTypeEvalCase {
  /** Unique kebab-case id, stable across dataset versions. */
  id: string;
  language: DiagramEvalLanguage;
  /** Human ground truth — the type a human labeler assigns to `text`. */
  expectedType: DiagramType;
  text: string;
  /** Provenance / intent of the case (e.g. known detector miss kept honest). */
  note?: string;
}

/** Minimum number of cases per canonical diagram type (dataset contract). */
export const MIN_CASES_PER_TYPE = 3;

export const DIAGRAM_TYPE_EVAL_DATASET: readonly DiagramTypeEvalCase[] = [
  // ---- flow ----
  {
    id: 'flow-en-1',
    language: 'en',
    expectedType: 'flow',
    text: 'The onboarding process works as follows. First, the user submits a form. Next, the system validates the input. Then the account is created. Finally, a welcome email is sent.',
  },
  {
    id: 'flow-ja-1',
    language: 'ja',
    expectedType: 'flow',
    text: 'このシステムの処理手順は次の通りです。まずユーザーがフォームを送信します。次にシステムが入力を検証します。その後、アカウントが作成され、最後に確認メールが送信されます。',
  },
  {
    id: 'flow-ja-2',
    language: 'ja',
    expectedType: 'flow',
    text: 'レシピの手順はこうです。最初に野菜を切り、その後鍋で炒めます。それから水を加えて20分煮込み、最後に味付けをして完成です。',
  },
  // ---- tree ----
  {
    id: 'tree-en-1',
    language: 'en',
    expectedType: 'tree',
    text: 'The company organization is a hierarchy. The CEO oversees three directors. Each director manages several departments. Departments contain teams, and every employee belongs to one team.',
  },
  {
    id: 'tree-ja-1',
    language: 'ja',
    expectedType: 'tree',
    text: '組織は階層構造になっています。社長の下に3人の部長がおり、各部長は複数の部門を管理します。部門はいくつかのチームに分類され、全従業員はいずれかのチームに属します。',
  },
  {
    id: 'tree-en-2',
    language: 'en',
    expectedType: 'tree',
    text: 'The taxonomy of living things branches from domains into kingdoms, then phyla and classes. Each category contains narrower subcategories, and species sit at the leaves of the classification.',
  },
  // ---- timeline ----
  {
    id: 'timeline-en-1',
    language: 'en',
    expectedType: 'timeline',
    text: 'The project started in January. In March we released the alpha version. By June the beta was complete. The official launch happened in September, and in December we reached one million users.',
  },
  {
    id: 'timeline-ja-1',
    language: 'ja',
    expectedType: 'timeline',
    text: 'プロジェクトは2024年1月に開始しました。3月にアルファ版をリリースし、6月までにベータ版が完成。9月に正式リリースとなり、12月にはユーザーが100万人に達しました。',
  },
  {
    id: 'timeline-ja-2',
    language: 'ja',
    expectedType: 'timeline',
    text: '会社の歴史を振り返ります。2015年に創業し、2017年に最初の製品を発売、2020年に海外展開を開始し、2023年に上場を果たしました。',
  },
  // ---- matrix ----
  {
    id: 'matrix-en-1',
    language: 'en',
    expectedType: 'matrix',
    text: 'Here is a comparison of the two plans. Plan A is faster but costs more. Plan B is cheaper against Plan A but takes longer. Evaluating the criteria, each option has pros and cons.',
  },
  {
    id: 'matrix-ja-1',
    language: 'ja',
    expectedType: 'matrix',
    text: '2つのプランを比較すると、プランAは高速ですがコストが高く、プランBは安い反面、時間がかかります。評価基準で見ると、それぞれ長所と短所があります。',
  },
  {
    id: 'matrix-en-2',
    language: 'en',
    expectedType: 'matrix',
    text: 'We evaluated three databases against four criteria: cost, speed, scalability, and operations. PostgreSQL scores well on operations, MongoDB is faster for writes, and Redis wins on raw speed but costs more to operate.',
  },
  // ---- cycle ----
  {
    id: 'cycle-en-1',
    language: 'en',
    expectedType: 'cycle',
    text: 'The water cycle works continuously. Water evaporates, forms clouds, returns as rain, and flows back to the ocean. This loop repeats forever.',
  },
  {
    id: 'cycle-ja-1',
    language: 'ja',
    expectedType: 'cycle',
    text: '水の循環は繰り返し続きます。水は蒸発し、雲になり、雨として降り、再び海へ戻ります。このサイクルは永遠に反復されます。',
  },
  {
    id: 'cycle-ja-2',
    language: 'ja',
    expectedType: 'cycle',
    text: 'アジャイル開発では、計画、実装、レビュー、振り返りを繰り返します。この反復のループを2週間ごとに一周させ、製品を継続的に改善します。',
  },
  // ---- flowchart ----
  {
    id: 'flowchart-en-1',
    language: 'en',
    expectedType: 'flowchart',
    text: 'When a request arrives, check the user status. If the account is active, route to the main branch; else go to the error path. This decision flow has yes and no outcomes.',
  },
  {
    id: 'flowchart-ja-1',
    language: 'ja',
    expectedType: 'flowchart',
    text: 'リクエストが届いたらユーザー状態を確認します。アカウントが有効な場合はメインの分岐に進み、無効な場合はエラー側に分かれます。この条件分岐にはYESとNOの結果があります。',
  },
  {
    id: 'flowchart-en-2',
    language: 'en',
    expectedType: 'flowchart',
    text: 'The support flow starts with a ticket. If the issue is billing, route it to finance; otherwise it goes to engineering. When engineering cannot reproduce it, the case closes as works-as-designed.',
  },
  // ---- comparison ----
  {
    id: 'comparison-en-1',
    language: 'en',
    expectedType: 'comparison',
    text: 'Cats versus dogs as pets. Cats are independent and quieter. Dogs are loyal but need more exercise. The contrast in maintenance is the biggest difference between the two.',
  },
  {
    id: 'comparison-ja-1',
    language: 'ja',
    expectedType: 'comparison',
    text: 'ペットとしての猫と犬を対比します。猫は独立していて静かです。犬は忠実ですが運動が必要です。どちらが良いかは飼育環境によって変わります。',
  },
  {
    id: 'comparison-ja-2',
    language: 'ja',
    expectedType: 'comparison',
    text: '都市部と地方での生活を対比してみましょう。都市部は交通の便が良い一方、家賃が高い。地方は家賃が安いですが、車が必要です。',
  },
  // ---- network ----
  {
    id: 'network-en-1',
    language: 'en',
    expectedType: 'network',
    text: 'The network connects many servers. Each node links to several peers. The hub manages all connections, and the mesh topology keeps the graph redundant.',
  },
  {
    id: 'network-ja-1',
    language: 'ja',
    expectedType: 'network',
    text: 'このネットワークは多数のサーバーを接続します。各ノードは複数のピアとリンクし、ハブがすべての接続を管理します。メッシュ型のトポロジーでグラフ全体が冗長化されています。',
  },
  {
    id: 'network-ja-2',
    language: 'ja',
    expectedType: 'network',
    text: 'この分散システムでは、各サービスが複数のサービスと接続されています。認証サービスはAPIゲートウェイと繋がり、決済サービスとも関係を持つ、網の目のような構成です。',
  },
  // ---- conceptmap ----
  {
    id: 'conceptmap-en-1',
    language: 'en',
    expectedType: 'conceptmap',
    text: 'This theory explains how concepts relate. Learning connects to memory, which influences understanding. Knowledge maps show that each idea depends on several others.',
  },
  {
    id: 'conceptmap-ja-1',
    language: 'ja',
    expectedType: 'conceptmap',
    text: 'この理論は概念がどう関連するかを説明します。学習は記憶と繋がり、記憶は理解に影響します。概念図では、それぞれの考えが複数の他の考えに依存しています。',
  },
  {
    id: 'conceptmap-ja-2',
    language: 'ja',
    expectedType: 'conceptmap',
    text: '教育学の理論では、動機付けが学習成果に影響し、学習成果は自己効力感と結びつきます。各概念は相互に関連し合っています。',
  },
  // ---- mindmap ----
  {
    id: 'mindmap-en-1',
    language: 'en',
    expectedType: 'mindmap',
    text: 'Let us brainstorm the central topic of city planning. Main branches include transport, housing, and parks. Each branch expands into subtopics and new ideas radiate outward.',
  },
  {
    id: 'mindmap-ja-1',
    language: 'ja',
    expectedType: 'mindmap',
    text: '都市計画という中心トピックでブレインストーミングしましょう。主要な枝は交通、住宅、公園です。各枝はサブトピックへ展開し、アイデアが外へ広がります。',
  },
  {
    id: 'mindmap-en-2',
    language: 'en',
    expectedType: 'mindmap',
    text: 'For the workshop, put the theme in the center: sustainability. Around it, branch into energy, food, transport, and fashion. Under each branch, collect related ideas as they come.',
  },
  // ---- general (no-structure controls — kept honest, known misses stay) ----
  {
    id: 'general-en-1',
    language: 'en',
    expectedType: 'general',
    text: 'The speaker explained the overall idea of the system in plain words, without any particular structure.',
    note: 'no-structure control; known detector miss (rule engine picks mindmap via "idea") — kept in the set so agreement is measured, not inflated',
  },
  {
    id: 'general-ja-1',
    language: 'ja',
    expectedType: 'general',
    text: '話者はシステム全体の概要を平易な言葉で説明しました。特定の構造はありませんでした。',
  },
  {
    id: 'general-en-2',
    language: 'en',
    expectedType: 'general',
    text: 'The talk covered many small topics: the weather, a recent trip, an old friend, and a new restaurant. There was no particular order to the stories.',
  },
];
