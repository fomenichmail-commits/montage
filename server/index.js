import express from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { probe, makeThumbnail, normalizeProject, buildRenderArgs, runFfmpeg, RESOLUTIONS } from './ffmpeg.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.resolve(process.env.MONTAGE_DATA_DIR || path.join(ROOT, 'data'));
const UPLOADS = path.join(DATA_DIR, 'uploads');
const THUMBS = path.join(DATA_DIR, 'thumbs');
const EXPORTS = path.join(DATA_DIR, 'exports');
const TMP = path.join(DATA_DIR, 'tmp');
const MEDIA_DB = path.join(DATA_DIR, 'media.json');
const PROJECT_FILE = path.join(DATA_DIR, 'project.json');
const MAX_UPLOAD_MB = Number(process.env.MONTAGE_MAX_UPLOAD_MB || 2048);

await Promise.all([UPLOADS, THUMBS, EXPORTS, TMP].map((d) => fs.mkdir(d, { recursive: true })));

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2));
  await fs.rename(tmp, file);
}

/** Media library: id -> { id, name, type, duration, width, height, hasAudio, file } */
let media = await readJson(MEDIA_DB, []);
const saveMedia = () => writeJson(MEDIA_DB, media);

const publicMedia = (m) => ({
  id: m.id,
  name: m.name,
  type: m.type,
  duration: m.duration,
  width: m.width,
  height: m.height,
  hasAudio: m.hasAudio,
  url: `/files/uploads/${m.file}`,
  thumb: m.type === 'audio' ? null : `/files/thumbs/${m.id}.jpg`,
});

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 10);
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 50 },
});

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(ROOT, 'public')));
app.use('/files/uploads', express.static(UPLOADS));
app.use('/files/thumbs', express.static(THUMBS));
app.use('/files/exports', express.static(EXPORTS));

app.get('/api/config', (_req, res) => {
  res.json({ resolutions: Object.keys(RESOLUTIONS), maxUploadMb: MAX_UPLOAD_MB });
});

app.get('/api/media', (_req, res) => {
  res.json(media.map(publicMedia));
});

app.post('/api/media', upload.array('files'), async (req, res) => {
  const added = [];
  const errors = [];
  for (const file of req.files || []) {
    const name = Buffer.from(file.originalname, 'latin1').toString('utf8');
    try {
      const info = await probe(file.path);
      const id = path.parse(file.filename).name;
      if (info.type !== 'audio') await makeThumbnail(file.path, path.join(THUMBS, `${id}.jpg`), info.type);
      const item = { id, name, file: file.filename, ...info };
      media.push(item);
      added.push(publicMedia(item));
    } catch (err) {
      await fs.rm(file.path, { force: true });
      errors.push({ name, error: err.message.split('\n')[0] });
    }
  }
  await saveMedia();
  res.status(added.length || !errors.length ? 200 : 400).json({ added, errors });
});

app.delete('/api/media/:id', async (req, res) => {
  const item = media.find((m) => m.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Файл не найден' });
  media = media.filter((m) => m !== item);
  await saveMedia();
  await fs.rm(path.join(UPLOADS, item.file), { force: true });
  await fs.rm(path.join(THUMBS, `${item.id}.jpg`), { force: true });
  res.json({ ok: true });
});

app.get('/api/project', async (_req, res) => {
  res.json(await readJson(PROJECT_FILE, { clips: [], resolution: '720p', fps: 30, music: null }));
});

app.put('/api/project', async (req, res) => {
  if (!req.body || !Array.isArray(req.body.clips)) return res.status(400).json({ error: 'Неверный формат проекта' });
  await writeJson(PROJECT_FILE, req.body);
  res.json({ ok: true });
});

/** Render jobs live in memory: id -> { status, progress, error, url } */
const jobs = new Map();

app.post('/api/render', async (req, res) => {
  let plan;
  try {
    const byId = new Map(media.map((m) => [m.id, { ...m, path: path.join(UPLOADS, m.file) }]));
    plan = normalizeProject(req.body, byId);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const id = randomUUID();
  const fileName = `montage-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.mp4`;
  const outPath = path.join(EXPORTS, `${id}-${fileName}`);
  const job = { id, status: 'rendering', progress: 0, error: null, url: null, fileName, duration: plan.total };
  jobs.set(id, job);
  res.json(job);

  const jobTmp = path.join(TMP, id);
  try {
    await fs.mkdir(jobTmp, { recursive: true });
    const textFiles = await Promise.all(plan.clips.map(async (clip, i) => {
      if (!clip.text) return null;
      const file = path.join(jobTmp, `text-${i}.txt`);
      await fs.writeFile(file, clip.text);
      return file;
    }));
    await runFfmpeg(buildRenderArgs(plan, outPath, textFiles), plan.total, (p) => { job.progress = p; });
    job.status = 'done';
    job.url = `/files/exports/${path.basename(outPath)}`;
  } catch (err) {
    job.status = 'error';
    job.error = err.message;
    await fs.rm(outPath, { force: true });
  } finally {
    await fs.rm(jobTmp, { recursive: true, force: true });
  }
});

app.get('/api/render/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Задача не найдена' });
  res.json(job);
});

app.use((err, _req, res, _next) => {
  const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 500;
  res.status(status).json({ error: err.message });
});

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
app.listen(PORT, HOST, () => {
  console.log(`Montage запущен: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
});
