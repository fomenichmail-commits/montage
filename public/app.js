const $ = (sel) => document.querySelector(sel);

const state = {
  media: [],
  project: { clips: [], resolution: '720p', fps: 30, music: null },
  selected: null,
  zoom: 60, // pixels per second
  playback: null, // { index, startedAt, offset } while playing the whole project
};

const DEFAULT_IMAGE_DURATION = 3;

// ---------- helpers ----------

const uid = () => Math.random().toString(36).slice(2, 10);
const mediaById = (id) => state.media.find((m) => m.id === id);
const clipDuration = (clip) => {
  const m = mediaById(clip.mediaId);
  if (!m) return 0;
  return m.type === 'image' ? Number(clip.duration) || DEFAULT_IMAGE_DURATION : Math.max(clip.out - clip.in, 0);
};
const totalDuration = () => state.project.clips.reduce((s, c) => s + clipDuration(c), 0);
const clipStartTime = (index) => state.project.clips.slice(0, index).reduce((s, c) => s + clipDuration(c), 0);

function formatTime(sec) {
  sec = Math.max(0, sec || 0);
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1).padStart(4, '0');
  return `${String(m).padStart(2, '0')}:${s}`;
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
  return data;
}

// ---------- persistence ----------

let saveTimer;
function saveProject() {
  clearTimeout(saveTimer);
  $('#save-status').textContent = 'Сохранение…';
  saveTimer = setTimeout(async () => {
    try {
      await api('/api/project', { method: 'PUT', body: JSON.stringify(state.project) });
      $('#save-status').textContent = 'Сохранено';
    } catch (err) {
      $('#save-status').textContent = `Не сохранено: ${err.message}`;
    }
  }, 500);
}

function changed() {
  renderTimeline();
  renderInspector();
  updateTimecode();
  saveProject();
}

// ---------- media library ----------

function renderLibrary() {
  const list = $('#media-list');
  list.innerHTML = '';
  for (const m of state.media) {
    const li = document.createElement('li');
    li.className = 'media-item';
    li.draggable = true;
    li.title = m.name;
    li.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/media-id', m.id));

    const thumb = m.thumb ? Object.assign(document.createElement('img'), { src: m.thumb, alt: '' })
      : Object.assign(document.createElement('div'), { className: 'audio-icon', textContent: '♪' });

    const info = document.createElement('div');
    info.style.minWidth = '0';
    const name = Object.assign(document.createElement('div'), { className: 'name', textContent: m.name });
    const typeLabel = { video: 'видео', image: 'фото', audio: 'аудио' }[m.type];
    const meta = Object.assign(document.createElement('div'), {
      className: 'meta',
      textContent: m.type === 'image' ? `${typeLabel} · ${m.width}×${m.height}` : `${typeLabel} · ${formatTime(m.duration)}`,
    });
    info.append(name, meta);

    const actions = document.createElement('div');
    actions.className = 'actions';
    const add = Object.assign(document.createElement('button'), {
      textContent: '+',
      title: m.type === 'audio' ? 'Сделать фоновой музыкой' : 'Добавить на таймлайн',
    });
    add.addEventListener('click', () => (m.type === 'audio' ? setMusic(m.id) : addClip(m.id)));
    const del = Object.assign(document.createElement('button'), { textContent: '×', title: 'Удалить из медиатеки', className: 'danger' });
    del.addEventListener('click', () => deleteMedia(m));
    actions.append(add, del);

    li.append(thumb, info, actions);
    list.append(li);
  }
  renderMusicOptions();
}

async function uploadFiles(files) {
  if (!files.length) return;
  const form = new FormData();
  for (const f of files) form.append('files', f);
  const status = $('#upload-status');
  status.textContent = `Загрузка ${files.length} файл(ов)…`;
  try {
    const xhrResult = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/media');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) status.textContent = `Загрузка: ${Math.round((e.loaded / e.total) * 100)}%`;
      };
      xhr.upload.onload = () => { status.textContent = 'Обработка…'; };
      xhr.onload = () => {
        let data = {};
        try { data = JSON.parse(xhr.responseText); } catch { /* ignore */ }
        if (xhr.status >= 400 && !data.errors) reject(new Error(data.error || `Ошибка ${xhr.status}`));
        else resolve(data);
      };
      xhr.onerror = () => reject(new Error('Сеть недоступна'));
      xhr.send(form);
    });
    state.media.push(...xhrResult.added);
    renderLibrary();
    const errors = (xhrResult.errors || []).map((e) => `${e.name}: ${e.error}`);
    status.textContent = errors.length ? `Не загружено — ${errors.join('; ')}` : `Добавлено файлов: ${xhrResult.added.length}`;
  } catch (err) {
    status.textContent = `Ошибка: ${err.message}`;
  }
}

async function deleteMedia(m) {
  const used = state.project.clips.some((c) => c.mediaId === m.id) || state.project.music?.mediaId === m.id;
  if (!confirm(used ? `«${m.name}» используется в проекте. Удалить вместе с клипами?` : `Удалить «${m.name}»?`)) return;
  try {
    await api(`/api/media/${m.id}`, { method: 'DELETE' });
  } catch (err) {
    alert(err.message);
    return;
  }
  state.media = state.media.filter((x) => x.id !== m.id);
  state.project.clips = state.project.clips.filter((c) => c.mediaId !== m.id);
  if (state.project.music?.mediaId === m.id) state.project.music = null;
  if (state.selected && !state.project.clips.some((c) => c.uid === state.selected)) state.selected = null;
  renderLibrary();
  changed();
  showSelected();
}

// ---------- timeline ----------

function newClip(mediaId) {
  const m = mediaById(mediaId);
  return {
    uid: uid(),
    mediaId,
    in: 0,
    out: m.type === 'image' ? 0 : m.duration,
    duration: m.type === 'image' ? DEFAULT_IMAGE_DURATION : undefined,
    text: '',
    textPosition: 'bottom',
    fadeIn: 0,
    fadeOut: 0,
    volume: 1,
    muted: false,
  };
}

function addClip(mediaId, index = state.project.clips.length) {
  const m = mediaById(mediaId);
  if (!m) return;
  if (m.type === 'audio') return setMusic(mediaId);
  const clip = newClip(mediaId);
  state.project.clips.splice(index, 0, clip);
  select(clip.uid);
  changed();
}

function setMusic(mediaId) {
  state.project.music = mediaId ? { mediaId, volume: state.project.music?.volume ?? 0.5 } : null;
  changed();
  renderMusicOptions();
}

function select(clipUid) {
  stopPlayback();
  state.selected = clipUid;
  renderTimeline();
  renderInspector();
  showSelected();
}

function renderRuler(total) {
  const ruler = $('#ruler');
  ruler.innerHTML = '';
  const width = Math.max(total * state.zoom + 200, ruler.parentElement.clientWidth);
  ruler.style.width = `${width}px`;
  const steps = [1, 2, 5, 10, 15, 30, 60, 120];
  const step = steps.find((s) => s * state.zoom >= 60) || 300;
  for (let t = 0; t * state.zoom < width; t += step) {
    const tick = document.createElement('span');
    tick.style.left = `${t * state.zoom}px`;
    tick.textContent = formatTime(t).replace(/\.0$/, '');
    ruler.append(tick);
  }
}

function renderTimeline() {
  const track = $('#track');
  track.innerHTML = '';
  const total = totalDuration();
  $('#total-duration').textContent = total ? `— ${formatTime(total)}` : '';
  renderRuler(total);

  if (!state.project.clips.length) {
    track.append(Object.assign(document.createElement('div'), {
      className: 'track-hint',
      textContent: 'Перетащите сюда файлы из медиатеки или нажмите «+»',
    }));
  }

  state.project.clips.forEach((clip, index) => {
    const m = mediaById(clip.mediaId);
    if (!m) return;
    const el = document.createElement('div');
    el.className = `clip ${m.type}`;
    if (clip.uid === state.selected) el.classList.add('selected');
    if (state.playback?.index === index) el.classList.add('playing');
    el.style.width = `${Math.max(clipDuration(clip) * state.zoom, 24)}px`;
    if (m.thumb) el.style.backgroundImage = `url("${m.thumb}")`;
    el.draggable = true;
    el.dataset.index = index;
    el.title = m.name;
    el.append(
      Object.assign(document.createElement('span'), { className: 'label', textContent: clip.text ? `T · ${m.name}` : m.name }),
      Object.assign(document.createElement('span'), { className: 'dur', textContent: formatTime(clipDuration(clip)) }),
    );
    el.addEventListener('click', () => select(clip.uid));
    el.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/clip-uid', clip.uid));
    el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drop-before'); });
    el.addEventListener('dragleave', () => el.classList.remove('drop-before'));
    track.append(el);
  });

  renderMusicTrack(total);
}

function renderMusicTrack(total) {
  const musicTrack = $('#music-track');
  musicTrack.innerHTML = '';
  const music = state.project.music && mediaById(state.project.music.mediaId);
  if (!music) {
    musicTrack.append(Object.assign(document.createElement('div'), {
      className: 'track-hint',
      textContent: '♪ Перетащите сюда аудио для фоновой музыки',
    }));
    return;
  }
  const el = document.createElement('div');
  el.className = 'music-clip';
  el.style.width = `${Math.max(total * state.zoom, 160)}px`;
  el.textContent = `♪ ${music.name}`;
  const remove = Object.assign(document.createElement('button'), { textContent: '×', title: 'Убрать музыку' });
  remove.style.marginLeft = 'auto';
  remove.style.padding = '0 6px';
  remove.addEventListener('click', () => setMusic(null));
  el.append(remove);
  musicTrack.append(el);
}

function setupTimelineDrop() {
  const track = $('#track');
  track.addEventListener('dragover', (e) => { e.preventDefault(); track.classList.add('drag-over'); });
  track.addEventListener('dragleave', (e) => { if (e.target === track) track.classList.remove('drag-over'); });
  track.addEventListener('drop', (e) => {
    e.preventDefault();
    track.classList.remove('drag-over');
    track.querySelectorAll('.drop-before').forEach((x) => x.classList.remove('drop-before'));
    const target = e.target.closest('.clip');
    let index = target ? Number(target.dataset.index) : state.project.clips.length;

    const mediaId = e.dataTransfer.getData('text/media-id');
    const clipUid = e.dataTransfer.getData('text/clip-uid');
    if (mediaId) {
      addClip(mediaId, index);
    } else if (clipUid) {
      const from = state.project.clips.findIndex((c) => c.uid === clipUid);
      if (from < 0) return;
      const [clip] = state.project.clips.splice(from, 1);
      if (from < index) index -= 1;
      state.project.clips.splice(index, 0, clip);
      changed();
    }
  });

  const musicTrack = $('#music-track');
  musicTrack.addEventListener('dragover', (e) => { e.preventDefault(); musicTrack.classList.add('drag-over'); });
  musicTrack.addEventListener('dragleave', () => musicTrack.classList.remove('drag-over'));
  musicTrack.addEventListener('drop', (e) => {
    e.preventDefault();
    musicTrack.classList.remove('drag-over');
    const m = mediaById(e.dataTransfer.getData('text/media-id'));
    if (m && (m.type === 'audio' || m.hasAudio)) setMusic(m.id);
  });
}

// ---------- inspector ----------

const selectedClip = () => state.project.clips.find((c) => c.uid === state.selected);

function renderInspector() {
  const clip = selectedClip();
  $('#inspector').hidden = !clip;
  $('#inspector-empty').hidden = Boolean(clip);
  if (!clip) return;
  const m = mediaById(clip.mediaId);
  const isImage = m.type === 'image';
  $('#clip-name').textContent = m.name;
  $('#trim-fields').hidden = isImage;
  $('#duration-field').hidden = !isImage;
  $('#split-btn').hidden = isImage;
  const setVal = (sel, v) => { const el = $(sel); if (document.activeElement !== el) el.value = v; };
  setVal('#clip-in', clip.in.toFixed(2));
  setVal('#clip-out', clip.out.toFixed(2));
  $('#clip-in').max = m.duration;
  $('#clip-out').max = m.duration;
  setVal('#clip-duration', clip.duration ?? DEFAULT_IMAGE_DURATION);
  setVal('#clip-text', clip.text);
  $('#clip-text-pos').value = clip.textPosition;
  setVal('#clip-fade-in', clip.fadeIn);
  setVal('#clip-fade-out', clip.fadeOut);
  $('#clip-volume').value = clip.volume;
  $('#clip-volume-val').textContent = `${Math.round(clip.volume * 100)}%`;
  $('#clip-muted').checked = clip.muted;
  $('#clip-volume').disabled = clip.muted || isImage || !m.hasAudio;
  $('#clip-muted').disabled = isImage || !m.hasAudio;
}

function setupInspector() {
  const bind = (sel, apply, event = 'input') => {
    $(sel).addEventListener(event, (e) => {
      const clip = selectedClip();
      if (!clip) return;
      apply(clip, e.target);
      changed();
      updatePreviewOverlay();
    });
  };
  const m = () => mediaById(selectedClip().mediaId);
  const clampNum = (v, min, max) => Math.min(Math.max(Number(v) || 0, min), max);

  bind('#clip-in', (c, el) => { c.in = clampNum(el.value, 0, Math.max(c.out - 0.1, 0)); seekPreview(c.in); }, 'change');
  bind('#clip-out', (c, el) => { c.out = clampNum(el.value, c.in + 0.1, m().duration); seekPreview(c.out); }, 'change');
  bind('#clip-duration', (c, el) => { c.duration = clampNum(el.value, 0.5, 600); }, 'change');
  bind('#clip-text', (c, el) => { c.text = el.value; });
  bind('#clip-text-pos', (c, el) => { c.textPosition = el.value; }, 'change');
  bind('#clip-fade-in', (c, el) => { c.fadeIn = clampNum(el.value, 0, clipDuration(c) / 2); }, 'change');
  bind('#clip-fade-out', (c, el) => { c.fadeOut = clampNum(el.value, 0, clipDuration(c) / 2); }, 'change');
  bind('#clip-volume', (c, el) => { c.volume = Number(el.value); $('#preview-video').volume = Math.min(c.volume, 1); });
  bind('#clip-muted', (c, el) => { c.muted = el.checked; }, 'change');

  $('#set-in').addEventListener('click', () => {
    const c = selectedClip();
    const t = $('#preview-video').currentTime;
    if (!c || t >= c.out) return;
    c.in = t;
    changed();
  });
  $('#set-out').addEventListener('click', () => {
    const c = selectedClip();
    const t = $('#preview-video').currentTime;
    if (!c || t <= c.in) return;
    c.out = t;
    changed();
  });
  $('#split-btn').addEventListener('click', () => {
    const c = selectedClip();
    const t = $('#preview-video').currentTime;
    if (!c || t <= c.in + 0.1 || t >= c.out - 0.1) {
      alert('Поставьте плеер внутрь клипа (между началом и концом), чтобы разрезать его');
      return;
    }
    const index = state.project.clips.indexOf(c);
    const second = { ...c, uid: uid(), in: t, fadeIn: 0 };
    c.out = t;
    c.fadeOut = 0;
    state.project.clips.splice(index + 1, 0, second);
    changed();
  });
  $('#duplicate-btn').addEventListener('click', () => {
    const c = selectedClip();
    if (!c) return;
    const copy = { ...c, uid: uid() };
    state.project.clips.splice(state.project.clips.indexOf(c) + 1, 0, copy);
    select(copy.uid);
    saveProject();
  });
  $('#remove-btn').addEventListener('click', removeSelected);
}

function removeSelected() {
  const c = selectedClip();
  if (!c) return;
  const index = state.project.clips.indexOf(c);
  state.project.clips.splice(index, 1);
  const next = state.project.clips[Math.min(index, state.project.clips.length - 1)];
  state.selected = next?.uid ?? null;
  changed();
  showSelected();
}

// ---------- preview ----------

const video = $('#preview-video');
const image = $('#preview-image');
let imageTimer = null;
let musicAudio = null;

function showMedia(m, clip) {
  $('#stage-empty').hidden = true;
  if (m.type === 'image') {
    video.pause();
    video.hidden = true;
    image.hidden = false;
    image.src = m.url;
  } else {
    image.hidden = true;
    video.hidden = false;
    if (!video.src.endsWith(m.url)) video.src = m.url;
    video.volume = clip.muted ? 0 : Math.min(clip.volume, 1);
  }
  updatePreviewOverlay(clip);
}

function updatePreviewOverlay(clip = state.playback ? state.project.clips[state.playback.index] : selectedClip()) {
  const overlay = $('#preview-text');
  overlay.hidden = !clip?.text;
  if (clip?.text) {
    overlay.textContent = clip.text;
    overlay.className = `preview-text ${clip.textPosition}`;
  }
}

function seekPreview(t) {
  if (!video.hidden) video.currentTime = t;
}

function showSelected() {
  const clip = selectedClip();
  if (!clip) {
    video.removeAttribute('src');
    video.load();
    video.hidden = true;
    image.hidden = true;
    $('#preview-text').hidden = true;
    $('#stage-empty').hidden = false;
    updateTimecode();
    return;
  }
  const m = mediaById(clip.mediaId);
  video.controls = true;
  showMedia(m, clip);
  if (m.type === 'video') {
    const seek = () => { video.currentTime = clip.in; };
    if (video.readyState >= 1) seek(); else video.addEventListener('loadedmetadata', seek, { once: true });
  }
  updateTimecode();
}

function playClipAt(index, offset = 0) {
  const clip = state.project.clips[index];
  if (!clip) return stopPlayback(true);
  const m = mediaById(clip.mediaId);
  state.playback = { index, clipStart: clipStartTime(index), offset, startedAt: performance.now() };
  renderTimeline();
  showMedia(m, clip);
  clearTimeout(imageTimer);
  if (m.type === 'image') {
    imageTimer = setTimeout(() => playClipAt(index + 1), (clipDuration(clip) - offset) * 1000);
  } else {
    const start = () => {
      video.currentTime = clip.in + offset;
      video.play().catch(() => {});
    };
    if (video.readyState >= 1 && video.src.endsWith(m.url)) start();
    else video.addEventListener('loadedmetadata', start, { once: true });
  }
}

function playProject() {
  if (!state.project.clips.length) return;
  stopPlayback();
  video.controls = false;
  const music = state.project.music && mediaById(state.project.music.mediaId);
  if (music) {
    musicAudio = new Audio(music.url);
    musicAudio.loop = true;
    musicAudio.volume = Math.min(state.project.music.volume, 1);
    musicAudio.play().catch(() => {});
  }
  $('#play-btn').disabled = true;
  playClipAt(0);
}

function stopPlayback(finished = false) {
  if (!state.playback && !musicAudio) return;
  clearTimeout(imageTimer);
  video.pause();
  musicAudio?.pause();
  musicAudio = null;
  state.playback = null;
  $('#play-btn').disabled = false;
  renderTimeline();
  if (finished) {
    video.controls = true;
    updateTimecode(totalDuration());
  }
}

video.addEventListener('timeupdate', () => {
  if (state.playback) {
    const clip = state.project.clips[state.playback.index];
    if (clip && video.currentTime >= clip.out - 0.05) playClipAt(state.playback.index + 1);
  }
  updateTimecode();
});
video.addEventListener('ended', () => {
  if (state.playback) playClipAt(state.playback.index + 1);
});

function updateTimecode(forced) {
  const total = totalDuration();
  let current = forced ?? 0;
  if (forced === undefined && state.playback) {
    const clip = state.project.clips[state.playback.index];
    const m = clip && mediaById(clip.mediaId);
    const inside = m?.type === 'image'
      ? state.playback.offset + (performance.now() - state.playback.startedAt) / 1000
      : video.currentTime - (clip?.in ?? 0);
    current = state.playback.clipStart + Math.max(inside, 0);
  } else if (forced === undefined) {
    const clip = selectedClip();
    if (clip) {
      const idx = state.project.clips.indexOf(clip);
      const m = mediaById(clip.mediaId);
      current = clipStartTime(idx) + (m.type === 'video' ? Math.max(video.currentTime - clip.in, 0) : 0);
    }
  }
  $('#timecode').textContent = `${formatTime(current)} / ${formatTime(total)}`;
}
setInterval(() => { if (state.playback) updateTimecode(); }, 200);

// ---------- export ----------

function renderMusicOptions() {
  const select = $('#export-music');
  const current = state.project.music?.mediaId ?? '';
  select.innerHTML = '<option value="">— нет —</option>';
  for (const m of state.media.filter((x) => x.type === 'audio' || (x.type === 'video' && x.hasAudio))) {
    select.append(Object.assign(document.createElement('option'), { value: m.id, textContent: m.name }));
  }
  select.value = current;
  const vol = state.project.music?.volume ?? 0.5;
  $('#export-music-volume').value = vol;
  $('#export-music-volume-val').textContent = `${Math.round(vol * 100)}%`;
}

function setupExport() {
  const dialog = $('#export-dialog');
  $('#export-btn').addEventListener('click', () => {
    $('#export-resolution').value = state.project.resolution;
    $('#export-fps').value = String(state.project.fps);
    renderMusicOptions();
    dialog.showModal();
  });
  $('#export-resolution').addEventListener('change', (e) => { state.project.resolution = e.target.value; saveProject(); });
  $('#export-fps').addEventListener('change', (e) => { state.project.fps = Number(e.target.value); saveProject(); });
  $('#export-music').addEventListener('change', (e) => setMusic(e.target.value || null));
  $('#export-music-volume').addEventListener('input', (e) => {
    if (state.project.music) state.project.music.volume = Number(e.target.value);
    $('#export-music-volume-val').textContent = `${Math.round(Number(e.target.value) * 100)}%`;
    saveProject();
  });

  $('#export-start').addEventListener('click', async (e) => {
    e.preventDefault();
    const progress = $('#export-progress');
    const status = $('#export-status');
    const download = $('#export-download');
    const startBtn = $('#export-start');
    download.hidden = true;
    progress.hidden = false;
    progress.value = 0;
    startBtn.disabled = true;
    status.textContent = 'Сборка видео…';
    try {
      let job = await api('/api/render', { method: 'POST', body: JSON.stringify(state.project) });
      while (job.status === 'rendering') {
        await new Promise((r) => setTimeout(r, 700));
        job = await api(`/api/render/${job.id}`);
        progress.value = job.progress;
        status.textContent = `Сборка видео… ${Math.round(job.progress * 100)}%`;
      }
      if (job.status === 'error') throw new Error(job.error);
      progress.value = 1;
      status.textContent = `Готово: ${job.fileName} (${formatTime(job.duration)})`;
      download.href = job.url;
      download.download = job.fileName;
      download.hidden = false;
    } catch (err) {
      status.textContent = `Ошибка: ${err.message}`;
      progress.hidden = true;
    } finally {
      startBtn.disabled = false;
    }
  });
}

// ---------- init ----------

function setupUploads() {
  $('#file-input').addEventListener('change', (e) => {
    uploadFiles([...e.target.files]);
    e.target.value = '';
  });
  const dz = $('#dropzone');
  const library = document.querySelector('.library');
  library.addEventListener('dragover', (e) => {
    if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); dz.classList.add('over'); }
  });
  library.addEventListener('dragleave', () => dz.classList.remove('over'));
  library.addEventListener('drop', (e) => {
    if (!e.dataTransfer.files.length) return;
    e.preventDefault();
    dz.classList.remove('over');
    uploadFiles([...e.dataTransfer.files]);
  });
}

function setupKeys() {
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (state.playback) stopPlayback(); else playProject();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      removeSelected();
    }
  });
}

async function init() {
  setupUploads();
  setupTimelineDrop();
  setupInspector();
  setupExport();
  setupKeys();
  $('#play-btn').addEventListener('click', playProject);
  $('#stop-btn').addEventListener('click', () => stopPlayback(true));
  $('#zoom').addEventListener('input', (e) => { state.zoom = Number(e.target.value); renderTimeline(); });

  const [media, project] = await Promise.all([api('/api/media'), api('/api/project')]);
  state.media = media;
  state.project = { resolution: '720p', fps: 30, music: null, ...project };
  // Drop clips whose media no longer exists.
  state.project.clips = state.project.clips.filter((c) => mediaById(c.mediaId)).map((c) => ({ uid: c.uid || uid(), ...c }));
  if (state.project.music && !mediaById(state.project.music.mediaId)) state.project.music = null;
  renderLibrary();
  renderTimeline();
  renderInspector();
  showSelected();
}

init().catch((err) => {
  const banner = Object.assign(document.createElement('div'), { textContent: `Не удалось загрузить: ${err.message}` });
  banner.style.cssText = 'padding:12px;background:#5a1d1d';
  document.body.prepend(banner);
});
