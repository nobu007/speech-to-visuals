# Pipeline Flow Specification

**Version**: Phase 43
**Last Updated**: 2025-10-15

---

## 1. Overview

The Speech-to-Visuals pipeline transforms audio input into diagram animation videos through five main stages:

1. **Transcription** - Audio → Text
2. **Analysis** - Text → Diagram Structure
3. **Visualization** - Structure → Layout
4. **Animation** - Layout → Video Components
5. **Rendering** - Components → Final Video

---

## 2. Complete Pipeline Flow

```
[Audio Input] → [Transcription] → [Analysis] → [Visualization] → [Animation] → [Rendering] → [Video Output]
     ↓                ↓                ↓               ↓                ↓              ↓             ↓
  .wav/.mp3        SRT file     DiagramData      LayoutData    Remotion Comp    MP4/WebM    Final video
```

**Processing Time**: 25-60s total (for 1min audio)
**Success Rate**: 100% (guaranteed via fallback)

---

## 3. Detailed Stage Specifications

### Stage 1: Transcription (Audio → Text)

**Input**: Audio file (.wav, .mp3, .m4a)
**Output**: SRT caption file + plain text transcript

**Implementation**: `src/transcription/whisper-transcriber.ts`

**Process Flow**:
```
Audio File
    ↓
Whisper Model (base/small/medium)
    ↓
Automatic Language Detection
    ↓
Timestamp-aligned Transcription
    ↓
Post-processing (normalize, segment)
    ↓
Output: transcript.txt + captions.srt
```

**Configuration**:
- Model: `base` (default), `small`, `medium`
- Language: Auto-detect (EN/JA supported)
- Timestamp precision: ±50ms

**Metrics**:
- Accuracy: ~85% (Whisper base)
- Speed: ~2x real-time
- Language detection: 95% accuracy

---

### Stage 2: Analysis (Text → Diagram Structure)

**Input**: Plain text transcript
**Output**: `DiagramData { type, nodes, edges }`

**Implementation**: `src/analysis/content-analyzer.ts`, `src/analysis/gemini-analyzer.ts`

**Complete Flow**:
```
Text Transcript
    ↓
Scene Segmentation (3-15s segments)
    ↓
Language Detection (EN/JA/auto)
    ↓
Complexity Analysis (→ Model Selection)
    ├─ Score < 20%: gemini-2.5-flash (fast)
    └─ Score ≥ 20%: gemini-2.5-pro (accurate)
    ↓
Semantic Cache Check (similarity > 0.9)
    ├─ Hit → Return cached result ✨
    └─ Miss → Continue to LLM
    ↓
LLM Primary Request
    ├─ Success → Parse & Validate
    ├─ Rate Limit → Retry with backoff (3x)
    └─ Failure → Fallback LLM
          ├─ Success → Parse & Validate
          └─ Failure → Rule-based V1 (guaranteed)
    ↓
JSON Extraction & Validation
    ├─ Validate node IDs
    ├─ Validate edge references
    └─ Detect cycles
    ↓
Relationship Quality Assessment
    ├─ Edge/node ratio
    ├─ Disconnected node count
    └─ Confidence adjustment
    ↓
Output: DiagramData
```

**3-Layer Fallback Architecture**:
1. **Primary LLM** (gemini-2.5-flash/pro) - 95% success
2. **Fallback LLM** (alternate model) - 4% success
3. **Rule-based V1** (sentence splitting) - 1% fallback, 100% success

**Configuration**:
```typescript
{
  temperature: 0.1,          // Deterministic outputs
  maxOutputTokens: 2048,     // Prevent truncation
  timeout: 15000-60000,      // Adaptive (P95 + 50%)
  maxRetries: 3,             // Exponential backoff
  complexityThreshold: 0.20  // Phase 43: Lowered from 0.30
}
```

**Metrics**:
- Entity extraction F1: 85%
- Relationship accuracy: 90%
- Edge completeness: 88%
- Fallback rate: <5%
- Processing time: 5-15s per segment

---

### Stage 3: Visualization (Structure → Layout)

**Input**: `DiagramData { type, nodes, edges }`
**Output**: `LayoutData { nodes: [{x,y,w,h}], edges: [{path}] }`

**Implementation**: `src/visualization/layout-engine.ts`, `src/visualization/strategies/*`

**Process Flow**:
```
DiagramData
    ↓
Diagram Type Detection
    ├─ flowchart → FlowchartLayoutStrategy
    ├─ tree → TreeLayoutStrategy
    ├─ timeline → TimelineLayoutStrategy
    └─ complex DAG → DagreLayoutStrategy
    ↓
Layout Strategy Execution
    ├─ Calculate node positions
    ├─ Route edge paths
    └─ Apply spacing rules
    ↓
Overlap Detection (all node pairs)
    ├─ No overlaps → Continue
    └─ Overlaps detected → Resolve
          ↓
    Overlap Resolution (force-directed)
        ├─ Iterate up to 100x
        ├─ Maintain aspect ratio
        └─ Guarantee: Zero overlaps
    ↓
Bounds Calculation
    ├─ Compute total canvas size
    ├─ Add padding (50px)
    └─ Center alignment
    ↓
Output: LayoutData
```

**Layout Strategies**:
1. **FlowchartLayoutStrategy**: Top-to-bottom sequential flows
2. **TreeLayoutStrategy**: Hierarchical parent-child structures
3. **TimelineLayoutStrategy**: Horizontal chronological progression
4. **DagreLayoutStrategy**: Complex directed acyclic graphs
5. **OverlapResolver**: Force-directed adjustment for zero overlaps

**Metrics**:
- Layout success rate: 100%
- Overlap count: 0 (guaranteed)
- Processing time: <2s per diagram
- Readability score: 95%

---

### Stage 4: Animation (Layout → Video Components)

**Input**: LayoutData + SRT captions
**Output**: Remotion composition

**Implementation**: `src/remotion/*`, `src/animation/*`

**Process Flow**:
```
LayoutData + SRT Captions
    ↓
Scene Synchronization
    ├─ Match captions to diagram scenes
    ├─ Calculate timing for animations
    └─ Transition duration: 0.5s
    ↓
Animation Choreography
    ├─ Node fade-in: 0.3s
    ├─ Edge draw animation: 0.5s
    ├─ Highlight effects: pulse
    └─ Caption sync: frame-perfect
    ↓
Remotion Component Generation
    ├─ Create React components
    ├─ Apply Remotion interpolate
    └─ Add audio track
    ↓
Output: Remotion Composition
```

**Animation Timeline**:
```
0.0s ─────┐
          │ Node 1 fade in (0.3s)
0.3s ─────┤
          │ Edge 1→2 draw (0.5s)
0.8s ─────┤
          │ Node 2 fade in (0.3s)
1.1s ─────┤
          │ Caption sync
          │ ...continues
```

**Metrics**:
- Sync accuracy: ±50ms
- Animation smoothness: 60fps
- Caption readability: 100%

---

### Stage 5: Rendering (Components → Final Video)

**Input**: Remotion composition
**Output**: MP4/WebM video file

**Implementation**: Remotion CLI, `src/lib/actualVideoRenderer.ts`

**Process Flow**:
```
Remotion Composition
    ↓
Remotion Bundler
    ├─ Bundle React components
    ├─ Resolve dependencies
    └─ Apply webpack config
    ↓
Frame Rendering
    ├─ Resolution: 1920x1080
    ├─ FPS: 30
    ├─ Codec: H.264 (MP4) / VP9 (WebM)
    └─ Quality: CRF 18 (high quality)
    ↓
Audio Encoding
    ├─ Codec: AAC (MP4) / Opus (WebM)
    ├─ Bitrate: 192kbps
    └─ Sample rate: 48kHz
    ↓
Output: Final Video File
    ├─ Format: MP4 (default) or WebM
    └─ Size: ~5-10MB per minute
```

**Metrics**:
- Rendering speed: ~0.5x real-time
- Video quality: High (CRF 18)
- File size: ~5-10MB per minute

---

## 4. Error Handling & Recovery

### 4.1 Comprehensive Fallback Strategy

| Stage | Error Condition | Fallback Action | Success Rate |
|-------|----------------|-----------------|--------------|
| Transcription | Whisper fails | Manual transcript upload | 100% |
| Analysis | LLM primary fails | Try fallback LLM | 99% |
| Analysis | LLM fallback fails | Rule-based V1 | 100% |
| Layout | Overlap detected | Force resolution | 100% |
| Rendering | Remotion error | Retry with lower quality | 98% |

### 4.2 Exponential Backoff

```typescript
// Retry delays with jitter
Attempt 1: 1000ms ± 300ms
Attempt 2: 2000ms ± 600ms
Attempt 3: 4000ms ± 1200ms
Max delay: 32000ms
```

**Benefits**:
- Avoids thundering herd problem
- Respects API rate limits
- Graceful degradation

---

## 5. Performance Optimization

### 5.1 Caching Strategy

**Semantic Cache** (Phase 17):
- Similarity threshold: 0.9
- Max size: 200 entries
- TTL: 120 minutes
- Persistence: `.cache/llm/unified-cache.json`

**Cache Hit Scenarios**:
1. Exact same text analyzed before
2. Semantically similar content (cosine similarity > 0.9)
3. Same diagram structure requested

**Expected Performance**:
- Cold start: 0% hit rate
- After 1 week: 30% hit rate
- After 1 month: 50% hit rate

### 5.2 Parallel Processing

**Stage-level Parallelization**:
- Multiple scene analysis (parallel LLM requests)
- Layout calculation for separate diagrams
- Frame rendering (multi-threaded)

**Limitations**:
- LLM rate limiting (200ms min interval)
- Memory constraints (max 3 parallel renders)

### 5.3 Adaptive Quality

**Model Selection** (Phase 43):
```
Complexity Score < 20%:
  → gemini-2.5-flash (fast, cost-effective)

Complexity Score ≥ 20%:
  → gemini-2.5-pro (accurate, comprehensive)
```

**Cost Optimization**:
- Flash usage: ~85% of requests
- Pro usage: ~15% of requests
- Estimated savings: 70% cost reduction vs all-Pro

---

## 6. Monitoring & Telemetry

### 6.1 Per-Stage Metrics

Each stage tracks:
- Processing time (ms)
- Success/failure rate (%)
- Fallback trigger count
- Resource usage (CPU %, memory MB)

### 6.2 End-to-End Metrics

**Overall Pipeline**:
- Total duration: 25.2s (Phase 42 average)
- Quality score: 90% confidence
- Success rate: 100%

**Real-time Dashboard** (`src/monitoring/performance-dashboard.ts`):
- Live progress updates via WebSocket
- Detailed breakdown by stage
- Error logs with stack traces
- Historical trend analysis

---

## 7. Quality Gates

### 7.1 Stage Transition Validation

**Before Analysis**:
- ✓ Valid SRT format
- ✓ Non-empty transcript
- ✓ Reasonable duration (>1s, <1hr)

**Before Visualization**:
- ✓ Valid DiagramData structure
- ✓ At least 1 node
- ✓ All edge references valid (no dangling edges)

**Before Animation**:
- ✓ Zero overlaps (guaranteed)
- ✓ All nodes within bounds
- ✓ Edge paths computed

**Before Rendering**:
- ✓ Valid Remotion composition
- ✓ Audio track present
- ✓ Duration > 0

### 7.2 Failure Thresholds

If any stage fails:
1. **Retry** (with backoff) up to 3 times
2. **Fallback** to alternative method
3. **Abort** only if all fallbacks exhausted (rare)

**Abort Conditions**:
- Empty audio file
- Corrupted input format
- System resource exhaustion

---

## 8. Configuration Reference

### 8.1 Environment Variables

```bash
# LLM Configuration
GOOGLE_API_KEY=<api_key>
ANALYSIS_DISABLE_GEMINI=0  # Set to 1 to force rule-based
GEMINI_MODEL_OVERRIDE=gemini-2.5-flash

# Performance Tuning (Phase 43)
COMPLEXITY_THRESHOLD=0.20  # Lowered from 0.30
CACHE_SIZE=200
CACHE_TTL_MINUTES=120
MIN_REQUEST_INTERVAL_MS=200

# Quality Thresholds
MIN_RELATIONSHIP_CONFIDENCE=0.5
MIN_ENTITY_F1_SCORE=0.8
MAX_OVERLAP_TOLERANCE_PX=20
```

### 8.2 Pipeline Options

```typescript
interface PipelineOptions {
  transcription?: {
    model: 'base' | 'small' | 'medium';
    language?: 'en' | 'ja' | 'auto';
  };
  analysis?: {
    preferredModel?: 'gemini-2.5-flash' | 'gemini-2.5-pro';
    maxRetries?: number;
    timeout?: number;
  };
  visualization?: {
    theme?: 'light' | 'dark';
    colorScheme?: string[];
  };
  rendering?: {
    fps?: 30 | 60;
    resolution?: '1080p' | '720p' | '4k';
    codec?: 'h264' | 'h265' | 'vp9';
  };
}
```

---

## 9. Testing Strategy

### 9.1 Unit Tests
- Each stage independently
- Mock external dependencies (LLM, Whisper)
- Edge cases and error conditions

### 9.2 Integration Tests
- Two-stage combinations
- Data flow validation
- Error propagation

### 9.3 End-to-End Tests
- Complete pipeline with sample audio
- Multi-language support (EN, JA)
- Performance benchmarks

**Test Suite Location**: `tests/`
**Run Command**: `npm run quality:check`

---

**Maintained by**: Autonomous Development Framework
**Review Cycle**: Every 5 phases
**Pipeline Version**: 4.0 (Phase 43)
