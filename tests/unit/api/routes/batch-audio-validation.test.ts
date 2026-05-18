/**
 * REQ-148: Batch route audio file metadata validation tests
 *
 * Verifies that the POST /api/v1/batch/jobs endpoint rejects
 * files with unsupported audio formats or invalid sizes at the API boundary.
 */

import { createBatchRouter, BatchJobManager } from '@/api/routes/batch';
import express from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/batch', createBatchRouter());
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('REQ-148: Batch audio file validation at API boundary', () => {
  const app = createApp();

  // --- Accepted formats ---

  const validFormats = [
    { name: 'speech.mp3', desc: 'MP3' },
    { name: 'audio.wav', desc: 'WAV' },
    { name: 'sound.ogg', desc: 'OGG' },
    { name: 'recording.m4a', desc: 'M4A' },
  ];

  test.each(validFormats)('accepts $desc file', async ({ name }) => {
    const res = await request(app)
      .post('/api/v1/batch/jobs')
      .send({ files: [{ name, path: `/audio/${name}` }] });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
  });

  // --- Rejected formats ---

  it('rejects a non-audio file extension', async () => {
    const res = await request(app)
      .post('/api/v1/batch/jobs')
      .send({ files: [{ name: 'document.txt', path: '/audio/doc.txt' }] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('Unsupported audio format');
  });

  it('rejects a video file extension', async () => {
    const res = await request(app)
      .post('/api/v1/batch/jobs')
      .send({ files: [{ name: 'clip.mp4', path: '/audio/clip.mp4' }] });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Unsupported');
  });

  it('rejects a file with no extension', async () => {
    const res = await request(app)
      .post('/api/v1/batch/jobs')
      .send({ files: [{ name: 'rawaudio', path: '/audio/rawaudio' }] });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('none');
  });

  // --- Size validation ---

  it('rejects an empty file (size=0)', async () => {
    const res = await request(app)
      .post('/api/v1/batch/jobs')
      .send({ files: [{ name: 'empty.mp3', path: '/audio/empty.mp3', size: 0 }] });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('empty');
  });

  it('rejects a file exceeding 50MB', async () => {
    const res = await request(app)
      .post('/api/v1/batch/jobs')
      .send({ files: [{ name: 'huge.mp3', path: '/audio/huge.mp3', size: 50 * 1024 * 1024 + 1 }] });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('exceeds maximum');
  });

  it('accepts a valid file with size under limit', async () => {
    const res = await request(app)
      .post('/api/v1/batch/jobs')
      .send({ files: [{ name: 'ok.mp3', path: '/audio/ok.mp3', size: 1024 }] });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
  });

  // --- Mixed valid/invalid ---

  it('rejects the batch if any file has invalid format', async () => {
    const res = await request(app)
      .post('/api/v1/batch/jobs')
      .send({
        files: [
          { name: 'good.mp3', path: '/audio/good.mp3' },
          { name: 'bad.pdf', path: '/audio/bad.pdf' },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('bad.pdf');
  });

  it('reports the file index in the error', async () => {
    const res = await request(app)
      .post('/api/v1/batch/jobs')
      .send({ files: [{ name: 'notes.txt', path: '/audio/notes.txt' }] });

    expect(res.body.error.message).toContain('index 0');
  });
});
