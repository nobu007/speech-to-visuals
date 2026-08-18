# Testing Guide - Speech-to-Visuals System

## Quick Start

### Manual Testing via Web Interface

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Access the testing interface:
   - **Simple Pipeline**: http://localhost:8080/simple (Recommended)
   - **Standard Interface**: http://localhost:8080/

3. Upload a test audio file (see [Test Audio Files](#test-audio-files) below)

4. Monitor processing in real-time

## Test Audio Files

Repository-bundled test assets (all paths exist in the repo):

- `public/jfk.wav` - Short English speech sample (used by `npm run transcribe` and the Phase 29 E2E validation)
- `public/srt/jfk.srt` / `public/srt/jfk.captions.json` - Captions matching `jfk.wav`
- `public/audio/test-audio.txt` - Japanese sample transcript for text-based pipeline tests
- `public/audio/sample-info.json` - Metadata describing a sample diagram-explanation audio

For additional audio, prepare your own MP3/WAV/OGG/M4A file (max 50MB) or generate one from the sample texts above with the TTS of your choice.

## Testing Workflow

1. **Upload**: Select audio file (MP3/WAV/OGG/M4A, max 50MB)
2. **Configure**: Choose options (video generation, etc.)
3. **Process**: Click "Process" button
4. **Monitor**: Watch real-time progress indicators
5. **Download**: Get results (JSON + MP4 if enabled)

## Supported Features

### Audio Formats
- MP3, WAV, OGG, M4A (up to 50MB)

### Diagram Types

11 types (canonical set defined by `DIAGRAM_TYPES` in `src/types/diagram.ts`):
- flow (プロセスフロー) / flowchart (フローチャート)
- tree (階層構造) / timeline (タイムライン) / matrix (比較表) / cycle (循環プロセス)
- comparison (比較) / network (ネットワーク) / conceptmap (コンセプトマップ) / mindmap (マインドマップ) / general (一般)

### Output Formats
- JSON (diagram data and metadata)
- MP4 (animated video via Remotion)

## Troubleshooting

### Common Issues

**File upload fails**
- Check file size (max 50MB)
- Verify supported format (MP3/WAV/OGG/M4A)

**Processing hangs**
- Check browser console for errors
- Reload page and retry

**Video not generated**
- Ensure "Generate Video" is checked
- Wait for processing to complete

## Development Testing

### Unit Tests
```bash
npm run test
```

### Build Verification
```bash
npm run build
```

### Type Checking
```bash
npm run type-check
```

### Test Script Variants

All variants are defined in `package.json` and run Jest with `jest.config.cjs`.

| Command | Purpose | Preconditions / Notes |
|---|---|---|
| `npm run test:coverage` | Runs the full Jest suite with coverage collection | Statements coverage target is >= 75% (`CLAUDE.md`) |
| `npm run test:memory` | Runs the suite with heap usage logging per test (`--expose-gc`, `JEST_MEMORY_LOG=1`) | Use to hunt memory leaks / regressions; compare heap logs across runs |
| `npm run test:fuzz` | Runs only the security fuzz suites (mutation-fuzz, content-validator fuzz, sanitize-fuzz, property-based XSS, guard fuzz, guard red-phase verification) | Fast local pass over the fuzz suite |
| `npm run test:fuzz:multi-seed` | Same fuzz suites with `FUZZ_SEEDS=3` (multiple random seeds per generator) | Also what CI's `security-fuzz` job runs (`.github/workflows/ci.yml`) |
| `npm run test:mutation` | Runs the mutation tests under `tests/mutation/` | Verifies monitoring/optimization logic against mutated inputs |

For non-test npm scripts (lint, build, preview, Remotion, API server, pipeline runners, quality/audit/validation commands), see the "主要スクリプト一覧" table in `README.md`. (The dead entries `pipeline:test:e2e`, `test:phase33`, and `test:phase43` — whose target files never existed in the tree — were removed from `package.json` on 2026-08-18; use `pipeline:test:audio` for E2E audio validation.)

## Resources

- **Main Documentation**: `README.md`
- **Test Audio**: `public/jfk.wav`, `public/audio/` (see [Test Audio Files](#test-audio-files))

---

**Version**: 2.0.0
**Last Updated**: 2025-10-11
**Simplified**: Removed deprecated test scripts and outdated references
