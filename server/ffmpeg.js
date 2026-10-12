import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const RESOLUTIONS = {
  '480p': { width: 854, height: 480 },
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  'vertical-720': { width: 720, height: 1280 },
  'vertical-1080': { width: 1080, height: 1920 },
  'square-1080': { width: 1080, height: 1080 },
};

export const DEFAULT_IMAGE_DURATION = 3;

const IMAGE_CODECS = new Set(['mjpeg', 'png', 'bmp', 'gif', 'webp', 'tiff']);

/** Read duration, streams and size of a media file. */
export async function probe(filePath) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filePath,
  ]);
  const info = JSON.parse(stdout);
  const streams = info.streams || [];
  const video = streams.find((s) => s.codec_type === 'video');
  const audio = streams.find((s) => s.codec_type === 'audio');
  const formatName = info.format?.format_name || '';
  const isImage = Boolean(video) && !audio &&
    (IMAGE_CODECS.has(video.codec_name) || formatName.includes('image2')) &&
    !(Number(info.format?.duration) > 0.5 && video.codec_name === 'gif');

  let type;
  if (isImage) type = 'image';
  else if (video) type = 'video';
  else if (audio) type = 'audio';
  else throw new Error('Файл не содержит видео или аудио');

  const duration = type === 'image'
    ? DEFAULT_IMAGE_DURATION
    : Number(info.format?.duration || video?.duration || audio?.duration || 0);

  return {
    type,
    duration: Math.round(duration * 1000) / 1000,
    width: video?.width || null,
    height: video?.height || null,
    hasAudio: Boolean(audio),
  };
}

/** Save a JPEG thumbnail of the first second of a video or an image. */
export async function makeThumbnail(filePath, outPath, type) {
  const args = ['-y', '-v', 'error'];
  if (type === 'video') args.push('-ss', '0.5');
  args.push('-i', filePath, '-frames:v', '1', '-vf', 'scale=320:-2', outPath);
  try {
    await execFileAsync('ffmpeg', args);
  } catch {
    // Very short videos: retry from the very first frame.
    await execFileAsync('ffmpeg', ['-y', '-v', 'error', '-i', filePath, '-frames:v', '1', '-vf', 'scale=320:-2', outPath]);
  }
}

const num = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const fmt = (v) => Number(v.toFixed(3)).toString();

/**
 * Turn a project into a normalized render plan: every clip is resolved
 * against its media and trimmed into a valid range.
 */
export function normalizeProject(project, mediaById) {
  const clips = Array.isArray(project?.clips) ? project.clips : [];
  if (clips.length === 0) throw new Error('Таймлайн пуст — добавьте хотя бы один клип');

  const resolution = RESOLUTIONS[project.resolution] ? project.resolution : '720p';
  const fps = clamp(Math.round(num(project.fps, 30)), 12, 60);

  const plan = clips.map((clip, i) => {
    const media = mediaById.get(clip.mediaId);
    if (!media) throw new Error(`Клип №${i + 1}: медиафайл не найден`);
    if (media.type === 'audio') throw new Error(`Клип №${i + 1}: аудио нельзя ставить на видеодорожку`);

    let start;
    let end;
    if (media.type === 'image') {
      start = 0;
      end = clamp(num(clip.duration, DEFAULT_IMAGE_DURATION), 0.5, 600);
    } else {
      start = clamp(num(clip.in, 0), 0, Math.max(media.duration - 0.1, 0));
      end = clamp(num(clip.out, media.duration), start + 0.1, media.duration);
    }
    const duration = end - start;
    const maxFade = duration / 2;
    return {
      media,
      start,
      end,
      duration,
      fadeIn: clamp(num(clip.fadeIn, 0), 0, maxFade),
      fadeOut: clamp(num(clip.fadeOut, 0), 0, maxFade),
      volume: clip.muted ? 0 : clamp(num(clip.volume, 1), 0, 4),
      text: typeof clip.text === 'string' ? clip.text.trim().slice(0, 300) : '',
      textPosition: ['top', 'center', 'bottom'].includes(clip.textPosition) ? clip.textPosition : 'bottom',
    };
  });

  let music = null;
  if (project.music?.mediaId) {
    const media = mediaById.get(project.music.mediaId);
    if (!media) throw new Error('Фоновая музыка: файл не найден');
    if (!media.hasAudio) throw new Error('Фоновая музыка: в файле нет звуковой дорожки');
    music = { media, volume: clamp(num(project.music.volume, 0.5), 0, 4) };
  }

  const total = plan.reduce((sum, c) => sum + c.duration, 0);
  return { ...RESOLUTIONS[resolution], fps, clips: plan, music, total };
}

/**
 * Build ffmpeg arguments for a normalized plan. `textFiles[i]` is a path to a
 * file with the caption of clip i (drawtext reads it, so no escaping needed).
 */
export function buildRenderArgs(plan, outPath, textFiles = []) {
  const { width: W, height: H, fps } = plan;
  const args = ['-y', '-v', 'error', '-nostats', '-progress', 'pipe:1'];
  const filters = [];
  const concatInputs = [];

  plan.clips.forEach((clip, i) => {
    if (clip.media.type === 'image') {
      args.push('-loop', '1', '-framerate', String(fps), '-t', fmt(clip.duration), '-i', clip.media.path);
    } else {
      args.push('-i', clip.media.path);
    }

    const v = [];
    if (clip.media.type === 'video') v.push(`trim=start=${fmt(clip.start)}:end=${fmt(clip.end)}`);
    v.push(
      'setpts=PTS-STARTPTS',
      `scale=${W}:${H}:force_original_aspect_ratio=decrease`,
      `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black`,
      'setsar=1',
      `fps=${fps}`,
      'format=yuv420p',
    );
    if (clip.fadeIn > 0) v.push(`fade=t=in:st=0:d=${fmt(clip.fadeIn)}`);
    if (clip.fadeOut > 0) v.push(`fade=t=out:st=${fmt(clip.duration - clip.fadeOut)}:d=${fmt(clip.fadeOut)}`);
    if (clip.text && textFiles[i]) {
      const fontSize = Math.round(Math.min(W, H) / 14);
      const margin = Math.round(Math.min(W, H) / 12);
      const y = { top: `${margin}`, center: '(h-text_h)/2', bottom: `h-text_h-${margin}` }[clip.textPosition];
      const textFile = textFiles[i].replace(/\\/g, '/').replace(/'/g, "'\\''").replace(/:/g, '\\:');
      v.push(`drawtext=textfile='${textFile}':expansion=none:fontcolor=white:fontsize=${fontSize}:x=(w-text_w)/2:y=${y}:box=1:boxcolor=black@0.5:boxborderw=${Math.round(fontSize / 2)}:line_spacing=8`);
    }
    filters.push(`[${i}:v]${v.join(',')}[v${i}]`);

    const a = [];
    let source;
    if (clip.media.type === 'video' && clip.media.hasAudio) {
      source = `[${i}:a]`;
      a.push(`atrim=start=${fmt(clip.start)}:end=${fmt(clip.end)}`, 'asetpts=PTS-STARTPTS');
    } else {
      source = '';
      a.push('anullsrc=channel_layout=stereo:sample_rate=48000', `atrim=duration=${fmt(clip.duration)}`);
    }
    a.push('aformat=sample_rates=48000:channel_layouts=stereo', `volume=${fmt(clip.volume)}`);
    if (clip.fadeIn > 0) a.push(`afade=t=in:st=0:d=${fmt(clip.fadeIn)}`);
    if (clip.fadeOut > 0) a.push(`afade=t=out:st=${fmt(clip.duration - clip.fadeOut)}:d=${fmt(clip.fadeOut)}`);
    // Pad short audio so it never ends before the video of the same clip.
    a.push('apad', `atrim=duration=${fmt(clip.duration)}`);
    filters.push(`${source}${a.join(',')}[a${i}]`);

    concatInputs.push(`[v${i}][a${i}]`);
  });

  const n = plan.clips.length;
  filters.push(`${concatInputs.join('')}concat=n=${n}:v=1:a=1[vout][acat]`);

  if (plan.music) {
    const mi = n;
    args.push('-stream_loop', '-1', '-i', plan.music.media.path);
    const fadeStart = Math.max(plan.total - 2, 0);
    filters.push(
      `[${mi}:a]atrim=duration=${fmt(plan.total)},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,` +
      `volume=${fmt(plan.music.volume)},afade=t=out:st=${fmt(fadeStart)}:d=${fmt(Math.min(2, plan.total))}[music]`,
      '[acat][music]amix=inputs=2:duration=first:normalize=0[aout]',
    );
  } else {
    filters.push('[acat]anull[aout]');
  }

  args.push(
    '-filter_complex', filters.join(';'),
    '-map', '[vout]', '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21',
    '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart',
    '-t', fmt(plan.total),
    outPath,
  );
  return args;
}

/** Run ffmpeg, reporting progress (0..1). Resolves when the file is ready. */
export function runFfmpeg(args, totalSeconds, onProgress) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args);
    let stderr = '';
    let buffer = '';
    proc.stdout.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const [key, value] = line.split('=');
        if (key === 'out_time_us' || key === 'out_time_ms') {
          const seconds = Number(value) / 1e6;
          if (Number.isFinite(seconds) && totalSeconds > 0) onProgress?.(clamp(seconds / totalSeconds, 0, 0.99));
        }
      }
    });
    proc.stderr.on('data', (chunk) => { stderr = (stderr + chunk).slice(-4000); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) {
        onProgress?.(1);
        resolve();
      } else {
        reject(new Error(stderr.trim() || `ffmpeg завершился с кодом ${code}`));
      }
    });
  });
}
