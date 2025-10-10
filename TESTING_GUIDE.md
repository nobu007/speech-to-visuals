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

3. Upload test audio file from `test-audio/` directory

4. Monitor processing in real-time

## Test Audio Files

Available in `test-audio/` directory:
- `test-audio-3sec.wav` - 3 second sample
- `test-explanation-10sec.wav` - 10 second explanation sample
- `sample-english.txt` - Sample English text
- `sample-japanese.txt` - Sample Japanese text
- `test-metadata.json` - Metadata configuration

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
- Mind Map (概念関係性)
- Flowchart (プロセス説明)
- Tree Structure (階層関係)
- Timeline (時系列)
- Concept Diagram (一般的関係)

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

## Resources

- **Quick Start Guide**: `QUICK_START.md`
- **Main Documentation**: `README.md`
- **Test Audio**: `test-audio/` directory

---

**Version**: 2.0.0
**Last Updated**: 2025-10-11
**Simplified**: Removed deprecated test scripts and outdated references
