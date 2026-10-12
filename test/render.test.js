import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { probe, normalizeProject, buildRenderArgs, runFfmpeg, makeThumbnail } from '../server/ffmpeg.js';

const run = promisify(execFile);
let dir;
const files = {};

before(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'montage-test-'));
  files.withAudio = path.join(dir, 'with-audio.mp4');
  files.silent = path.join(dir, 'silent.mov');
  files.image = path.join(dir, 'photo.png');
  files.music = path.join(dir, 'music.mp3');
  await Promise.all([
    run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=25:duration=4',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=4', '-shortest', '-pix_fmt', 'yuv420p', files.withAudio]),
    run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=360x640:rate=30:duration=3',
      '-pix_fmt', 'yuv420p', files.silent]),
    run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=orange:size=800x600', '-frames:v', '1', files.image]),
    run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=2', files.music]),
  ]);
});

after(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

async function library() {
  const map = new Map();
  for (const [id, file] of Object.entries(files)) map.set(id, { id, path: file, ...(await probe(file)) });
  return map;
}

async function outputInfo(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]);
  return JSON.parse(stdout);
}

test('probe detects media types', async () => {
  const lib = await library();
  assert.equal(lib.get('withAudio').type, 'video');
  assert.equal(lib.get('withAudio').hasAudio, true);
  assert.ok(Math.abs(lib.get('withAudio').duration - 4) < 0.2);
  assert.equal(lib.get('silent').hasAudio, false);
  assert.equal(lib.get('image').type, 'image');
  assert.equal(lib.get('music').type, 'audio');
});

test('thumbnails are created for video and image', async () => {
  for (const [key, type] of [['withAudio', 'video'], ['image', 'image']]) {
    const out = path.join(dir, `${key}.jpg`);
    await makeThumbnail(files[key], out, type);
    assert.ok((await fs.stat(out)).size > 0);
  }
});

test('normalizeProject clamps trims and rejects bad input', async () => {
  const lib = await library();
  const plan = normalizeProject({
    resolution: 'nope',
    fps: 1000,
    clips: [
      { mediaId: 'withAudio', in: -5, out: 99, fadeIn: 10 },
      { mediaId: 'image', duration: 2 },
    ],
  }, lib);
  assert.equal(plan.width, 1280);
  assert.equal(plan.fps, 60);
  assert.equal(plan.clips[0].start, 0);
  assert.ok(Math.abs(plan.clips[0].end - lib.get('withAudio').duration) < 1e-9);
  assert.ok(plan.clips[0].fadeIn <= plan.clips[0].duration / 2);
  assert.equal(plan.clips[1].duration, 2);

  assert.throws(() => normalizeProject({ clips: [] }, lib), /Таймлайн пуст/);
  assert.throws(() => normalizeProject({ clips: [{ mediaId: 'missing' }] }, lib), /не найден/);
  assert.throws(() => normalizeProject({ clips: [{ mediaId: 'music' }] }, lib), /аудио/);
});

test('renders a full montage: trims, photo, captions, fades, music', async () => {
  const lib = await library();
  const plan = normalizeProject({
    resolution: 'vertical-720',
    fps: 30,
    clips: [
      { mediaId: 'withAudio', in: 1, out: 3, text: "Привет: 100% «монтаж» it's", fadeIn: 0.5 },
      { mediaId: 'silent', in: 0, out: 1.5, textPosition: 'top', text: 'Вторая\nстрока' },
      { mediaId: 'image', duration: 1.5, fadeOut: 0.5, textPosition: 'center', text: 'Фото' },
    ],
    music: { mediaId: 'music', volume: 0.4 },
  }, lib);
  assert.equal(plan.total, 5);

  const textFiles = await Promise.all(plan.clips.map(async (c, i) => {
    const f = path.join(dir, `caption ${i}.txt`);
    await fs.writeFile(f, c.text);
    return f;
  }));
  const out = path.join(dir, 'out.mp4');
  const progress = [];
  await runFfmpeg(buildRenderArgs(plan, out, textFiles), plan.total, (p) => progress.push(p));

  const info = await outputInfo(out);
  const v = info.streams.find((s) => s.codec_type === 'video');
  const a = info.streams.find((s) => s.codec_type === 'audio');
  assert.equal(v.codec_name, 'h264');
  assert.equal(v.width, 720);
  assert.equal(v.height, 1280);
  assert.equal(a.codec_name, 'aac');
  assert.ok(Math.abs(Number(info.format.duration) - 5) < 0.15, `duration ${info.format.duration}`);
  assert.equal(progress.at(-1), 1);
});

test('renders without music and with a muted clip', async () => {
  const lib = await library();
  const plan = normalizeProject({
    resolution: '480p',
    clips: [{ mediaId: 'withAudio', in: 0, out: 1, muted: true }, { mediaId: 'image', duration: 1 }],
  }, lib);
  const out = path.join(dir, 'out2.mp4');
  await runFfmpeg(buildRenderArgs(plan, out), plan.total);
  const info = await outputInfo(out);
  assert.ok(Math.abs(Number(info.format.duration) - 2) < 0.15);
});
