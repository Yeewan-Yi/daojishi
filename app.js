import { STORAGE_KEY, validateCountdown, defaultCountdown, getCountdown, encodeShare, decodeShare, toLocalInput } from './countdown.js';
import { CloudClient, ROOM_STORAGE_KEY, newRoom, roomFromHash, roomUrl, validateRoom } from './cloud.js';
import { mountFlight, flightStage } from './flight.js';
import { mountFlipClock } from './flip-clock.js';
import { VIEW_RESET_DURATION, dampProgress, easeViewReset, explorationInput, percentageParts } from './globe-math.js';

const $ = id => document.getElementById(id);
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '本地时区';
const dateFormat = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFormat = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
const weekdayFormat = new Intl.DateTimeFormat('zh-CN', { weekday: 'long' });
const pad = n => String(n).padStart(2, '0');
let state;
let sharedView = false;
let pipWindow = null;
let toastTimeout;
let tickTimeout;
let editingBaseline;
let externalEdit = false;
let saved = true;
const cloud = new CloudClient();
let room = null;
let cloudRecord = null;
let cloudStatus = 'loading';
let cloudCache = false;
let cloudTimer;
let cloudRequest = null;
let cloudFailures = 0;
let writingCloud = false;
let creatingCloud = false;
let pendingRoom = null;
let editingVersion = null;
let invalidRoomLink = false;
const mainFlight = mountFlight($('flight-visual'), 'main');
let globe3d = null;
let latestGlobeValue = null;
const flipClock = mountFlipClock($('digits'));
let pipFlight = null;

function rememberRoom() {
  try { localStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify(room)); } catch { /* The room link still works. */ }
  history.replaceState(null, '', roomUrl(location.href, room));
}

function cacheCloud() {
  try { localStorage.setItem(`youqi.cache.${room.id}.${room.token}`, JSON.stringify(validateCountdown(state))); } catch { /* Online data remains authoritative. */ }
}

function setEditAccess() {
  const disabled = invalidRoomLink || !!room && (!cloudRecord || !cloudRecord.canEdit);
  for (const id of ['edit-button']) {
    $(id).disabled = disabled;
    $(id).title = disabled ? cloudRecord ? '当前链接仅可查看' : '等待从云端读取编辑权限' : '';
  }
  $('float-button').disabled = invalidRoomLink || !!room && !cloudRecord && !cloudCache;
}

function applyCloudRecord(next) {
  if (cloudRecord && next.version < cloudRecord.version) return;
  const changed = JSON.stringify(validateCountdown(next)) !== JSON.stringify(state);
  if ($('edit-dialog').open && cloudRecord && next.version !== cloudRecord.version) externalEdit = true;
  state = validateCountdown(next);
  cloudRecord = next;
  cloudCache = true;
  cacheCloud();
  setEditAccess();
  renderMetadata();
  if ($('share-dialog').open) updateSharePanel();
  return changed;
}

async function refreshCloud() {
  if (!room || cloudRequest || writingCloud || creatingCloud) return;
  clearTimeout(cloudTimer);
  cloudRequest = new AbortController();
  try {
    const next = await cloud.read(room, cloudRequest.signal);
    const hadRecord = !!cloudRecord;
    const changed = applyCloudRecord(next);
    cloudStatus = 'synced'; cloudFailures = 0;
    if (hadRecord && changed) toast('已同步对方的最新修改。');
  } catch (error) {
    cloudStatus = error.code === 'SETUP' ? 'setup' : error.code === 'ACCESS' ? 'denied' : 'offline';
    if (cloudStatus === 'denied') { cloudRecord = null; setEditAccess(); }
    cloudFailures++;
  } finally {
    cloudRequest = null;
    setSaveLabel();
    if (!cloudCache) renderMetadata();
    const delay = cloudStatus === 'denied' ? null : cloudStatus === 'setup' ? 30000 : cloudStatus === 'synced' ? document.hidden && !pipWindow ? 15000 : 2000 : Math.min(30000, 2000 * 2 ** Math.min(cloudFailures, 4));
    if (delay !== null) cloudTimer = setTimeout(refreshCloud, delay);
  }
}

function toast(message) {
  clearTimeout(toastTimeout);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimeout = setTimeout(() => { $('toast').hidden = true; }, 4200);
}

function readLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? validateCountdown(JSON.parse(raw)) : null;
  } catch { return null; }
}

function setSaveLabel() {
  $('save-label').textContent = invalidRoomLink ? '共享链接不完整或格式无效' : room ? {
    loading: '正在连接共享倒计时…',
    synced: cloudRecord?.canEdit ? '已同步 · 可编辑' : '已同步 · 仅查看',
    saving: '正在保存到云端…',
    offline: cloudCache ? '暂时离线 · 当前显示上次同步内容' : '无法连接云端 · 请检查网络',
    setup: '云端尚未初始化 · 需运行初始化 SQL',
    denied: '共享链接已失效或无权访问'
  }[cloudStatus] : !saved ? '暂未保存，关闭后可能丢失' : sharedView ? '分享快照 · 修改仅保存在本机' : '已保存在此设备';
  $('retry-sync').hidden = !room || ['synced', 'loading', 'saving'].includes(cloudStatus);
}

function persist() {
  if (room) { cacheCloud(); return; }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); saved = true; }
  catch { saved = false; toast('浏览器暂时无法保存，请复制分享链接保留设置。'); }
  setSaveLabel();
}

function replaceShareHash() {
  if (!sharedView) return;
  try { history.replaceState(null, '', `#c=${encodeShare(state)}`); }
  catch { toast('地址暂时无法更新，请重新复制分享链接保留修改。'); }
}

function initialize() {
  const params = new URLSearchParams(location.hash.slice(1));
  try {
    room = roomFromHash(location.hash);
    if (!room && !params.has('c')) {
      const last = localStorage.getItem(ROOM_STORAGE_KEY);
      if (last) room = validateRoom(JSON.parse(last));
    }
    if (room) {
      rememberRoom();
      try {
        const cache = localStorage.getItem(`youqi.cache.${room.id}.${room.token}`);
        if (cache) { state = validateCountdown(JSON.parse(cache)); cloudCache = true; }
      } catch { /* A fresh server read will replace an invalid cache. */ }
      state ||= defaultCountdown();
    }
  } catch (error) {
    if (params.has('room') || params.has('key')) {
      toast(error.message);
      room = null;
      invalidRoomLink = true;
      $('share-button').disabled = true;
    }
  }
  if (params.has('c')) {
    try { state = decodeShare(params.get('c')); sharedView = true; }
    catch (error) { toast(error.message); }
  }
  if (!state) { state = readLocal() || defaultCountdown(); if (!invalidRoomLink) persist(); }
  setSaveLabel();
  let theme;
  try { theme = localStorage.getItem('youqi.theme'); } catch { /* Theme falls back to system preference. */ }
  applyTheme(theme === 'dark' || theme === 'light' ? theme : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  renderMetadata();
  setEditAccess();
  tick();
  if (room) refreshCloud();
}

function renderMetadata() {
  if (invalidRoomLink || room && !cloudCache) {
    mainFlight.pending();
    document.title = '共享倒计时 · 有期';
    $('event-title').textContent = invalidRoomLink ? '共享链接无效' : cloudStatus === 'loading' ? '正在读取共享倒计时' : '暂未读取到共享倒计时';
    for (const id of ['start-date', 'start-time', 'end-date', 'end-time']) $(id).textContent = '—';
    renderTime();
    return;
  }
  document.title = `${state.title} · 有期`;
  $('event-title').textContent = state.title;
  $('start-date').textContent = dateFormat.format(new Date(state.start));
  $('end-date').textContent = dateFormat.format(new Date(state.end));
  $('start-time').textContent = `${weekdayFormat.format(new Date(state.start))} · ${timeFormat.format(new Date(state.start))}`;
  $('end-time').textContent = `${weekdayFormat.format(new Date(state.end))} · ${timeFormat.format(new Date(state.end))}`;
  $('timezone-caption').textContent = `${zone} · 本地时区`;
  $('edit-timezone').textContent = `时区：${zone}`;
  renderTime();
}

function renderTime() {
  if (invalidRoomLink || room && !cloudCache) {
    latestGlobeValue = null;
    globe3d?.pending();
    $('percent-major').textContent = '—';
    $('percent-minor').hidden = $('percent-sign').hidden = true;
    $('journey-percent').setAttribute('aria-label', '正在读取航程');
    $('journey-progress-fill').style.width = '0%';
    flipClock.update({}, false);
    $('status-label').textContent = !invalidRoomLink && cloudStatus === 'loading' ? '连接中' : '未连接';
    $('event-kicker').textContent = '共享同一份期待';
    $('target-caption').textContent = invalidRoomLink ? '请向分享者索取完整的共享链接' : cloudStatus === 'setup' ? '请先完成云端数据库初始化' : cloudStatus === 'denied' ? '请向分享者索取有效链接' : '连接成功后显示最新标题与时间';
    $('progress-caption').textContent = '等待云端数据';
    $('progress-value').textContent = '—';
    return;
  }
  const value = getCountdown(state);
  latestGlobeValue = value;
  globe3d?.update(value);
  flipClock.update(value);
  mainFlight.update(value, state);
  const status = flightStage(value.phase, value.progress).status;
  $('status-label').textContent = status;
  $('event-kicker').textContent = { upcoming: '下一段期待，等待启程', active: '沿着时间，飞向期待', ended: '跨越等待，终于抵达' }[value.phase];
  $('timer-caption').textContent = { upcoming: '距离启程', active: '距离抵达', ended: '这一天，已经到来' }[value.phase];
  const target = value.phase === 'upcoming' ? state.start : state.end;
  $('target-caption').textContent = `${value.phase === 'upcoming' ? '开始于' : '相约于'} ${dateFormat.format(new Date(target))} · ${weekdayFormat.format(new Date(target))} ${timeFormat.format(new Date(target))}`;
  const parts = percentageParts(value.progress), percent = `${parts.text}%`;
  $('percent-major').textContent = parts.major;
  $('percent-minor').textContent = parts.minor;
  $('percent-minor').hidden = $('percent-sign').hidden = false;
  $('journey-percent').setAttribute('aria-label', percent);
  $('journey-progress-fill').style.width = percent;
  $('progress-value').textContent = `已飞行 ${percent} · 剩余 ${(100 - value.progress).toFixed(5)}%`;
  $('progress-bar').style.width = percent;
  $('progress-track').setAttribute('aria-valuenow', parts.text);
  $('progress-track').setAttribute('aria-valuetext', `${status}，航程完成 ${percent}`);
  $('progress-caption').textContent = { upcoming: '航班等待起飞', active: '沿着航线，慢慢靠近', ended: '航迹已完整点亮' }[value.phase];
  if (pipWindow && !pipWindow.closed) renderPip(value);
}

function tick() {
  clearTimeout(tickTimeout);
  renderTime();
  tickTimeout = setTimeout(tick, 1000 - Date.now() % 1000 + 15);
}

function openEdit(field = 'title-input') {
  if (room && (!cloudRecord || !cloudRecord.canEdit)) return;
  editingBaseline = JSON.stringify(state);
  editingVersion = cloudRecord?.version;
  externalEdit = false;
  $('title-input').value = state.title;
  $('start-input').value = toLocalInput(state.start);
  $('end-input').value = toLocalInput(state.end);
  $('form-error').textContent = '';
  $('edit-dialog').showModal();
  $(field).focus();
}

$('edit-button').addEventListener('click', () => openEdit());

$('edit-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (writingCloud) return;
  if (externalEdit || editingBaseline !== JSON.stringify(state) || room && editingVersion !== cloudRecord?.version) {
    $('form-error').textContent = '倒计时已被更新。请关闭后重新打开编辑，避免覆盖新内容。';
    return;
  }
  let next;
  try {
    const title = $('title-input').value;
    const start = new Date($('start-input').value).toISOString();
    const end = new Date($('end-input').value).toISOString();
    next = validateCountdown({ title, start, end });
  } catch (error) {
    $('form-error').textContent = error instanceof RangeError ? '请填写有效的开始和截止时间。' : error.message;
    return;
  }
  if (room) {
    writingCloud = true;
    cloudStatus = 'saving'; setSaveLabel();
    const submit = $('edit-form').querySelector('[type=submit]');
    submit.disabled = true;
    try {
      applyCloudRecord(await cloud.update(room, next, editingVersion));
      cloudStatus = 'synced'; cloudFailures = 0;
      $('edit-dialog').close();
      toast('已保存到云端，对方将自动收到更新。');
    } catch (error) {
      $('form-error').textContent = error.message;
      cloudStatus = error.code === 'ACCESS' ? 'denied' : error.code === 'SETUP' ? 'setup' : 'offline';
    } finally {
      writingCloud = false; submit.disabled = false; setSaveLabel(); refreshCloud();
    }
    return;
  }
  state = next;
  pendingRoom = null;
  persist();
  replaceShareHash();
  renderMetadata();
  $('edit-dialog').close();
  toast(saved ? '期待已更新，倒计时继续。' : '已更新，暂时无法保存到此设备。');
});

document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  const bounds = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
}));

function makeShareUrl() {
  if (room && cloudRecord) {
    const viewOnly = !cloudRecord.canEdit || $('share-permission').value === 'view';
    return roomUrl(location.href, { id: room.id, token: viewOnly ? cloudRecord.viewerToken || room.token : room.token });
  }
  const url = new URL(location.href);
  url.search = '';
  url.hash = `c=${encodeShare(state)}`;
  return url.href;
}

function updateSharePanel() {
  const live = !!room && !!cloudRecord;
  $('share-title').textContent = room && !cloudCache ? '正在连接云端…' : state.title;
  $('share-date').textContent = room && !cloudCache ? '' : dateFormat.format(new Date(state.end));
  $('share-url').value = room && !cloudRecord ? location.href : makeShareUrl();
  $('cloud-create').hidden = !!room;
  $('permission-row').hidden = !live || !cloudRecord.canEdit;
  $('share-kind').textContent = live ? '已开启云端共享' : room ? '共享倒计时尚未连接' : '当前为快照分享';
  $('share-explanation').textContent = live ? cloudRecord.canEdit && $('share-permission').value !== 'view' ? '此链接允许共同编辑。任何一方保存后，另一方通常在 2 秒左右自动更新；网络和浏览器后台运行可能延长同步时间。' : '此链接仅允许查看。对方能自动收到最新设置，但不能修改标题和时间。' : room ? '联网并成功读取云端后，才能确认当前链接的访问权限。' : '快照链接保存当前设置，后续修改不会同步。点击下方「开启共同使用」，生成双方可持续同步的固定链接。';
}

$('share-button').addEventListener('click', () => {
  $('cloud-error').textContent = '';
  updateSharePanel();
  $('share-dialog').showModal();
});
$('share-permission').addEventListener('change', updateSharePanel);
$('cloud-create').addEventListener('click', async () => {
  if (creatingCloud || room) return;
  creatingCloud = true; $('cloud-create').disabled = true; $('cloud-error').textContent = '';
  pendingRoom ||= newRoom();
  try {
    const next = await cloud.create(pendingRoom, state);
    room = pendingRoom; sharedView = false;
    rememberRoom();
    applyCloudRecord(next);
    cloudStatus = 'synced'; setSaveLabel(); updateSharePanel();
    toast('共同使用已开启，请复制链接发给对方。');
  } catch (error) { $('cloud-error').textContent = error.message; }
  finally {
    creatingCloud = false; $('cloud-create').disabled = false;
    if (room) refreshCloud();
  }
});
$('retry-sync').addEventListener('click', refreshCloud);
$('share-url').addEventListener('click', () => $('share-url').select());
$('copy-button').addEventListener('click', async () => {
  const input = $('share-url');
  try {
    await navigator.clipboard.writeText(input.value);
    toast('分享链接已复制，发给一起期待的人吧。');
  } catch {
    input.focus(); input.select();
    toast('请长按链接，或按 Ctrl/Cmd + C 复制。');
  }
});

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('theme-button').querySelector('use').setAttribute('href', theme === 'dark' ? '#i-sun' : '#i-moon');
  const label = theme === 'dark' ? '切换浅色模式' : '切换深色模式';
  $('theme-button').setAttribute('aria-label', label);
  $('theme-button').title = label;
  document.querySelector('meta[name=theme-color]').content = theme === 'dark' ? '#0b1210' : '#f5f6f2';
  if (pipWindow && !pipWindow.closed) pipWindow.document.documentElement.dataset.theme = theme;
}
$('theme-button').addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(theme);
  try { localStorage.setItem('youqi.theme', theme); } catch { /* The theme still works without storage. */ }
});

function focusMode(enabled) {
  document.body.classList.toggle('focus-mode', enabled);
  $('exit-focus').hidden = !enabled;
  if (enabled) $('exit-focus').focus();
  else $('focus-button').focus();
}
$('focus-button').addEventListener('click', () => focusMode(true));
$('exit-focus').addEventListener('click', () => focusMode(false));
$('fallback-focus').addEventListener('click', () => { $('float-dialog').close(); focusMode(true); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !document.querySelector('dialog[open]')) focusMode(false);
});

function renderPip(value) {
  const doc = pipWindow.document;
  doc.getElementById('pip-title').textContent = state.title;
  doc.getElementById('pip-time').textContent = `${pad(value.days)} 天 ${pad(value.hours)}:${pad(value.minutes)}:${pad(value.seconds)}`;
  pipFlight?.update(value, state);
}

$('float-button').addEventListener('click', async () => {
  if (!('documentPictureInPicture' in window)) { $('float-dialog').showModal(); return; }
  if (pipWindow && !pipWindow.closed) { pipWindow.focus(); return; }
  $('float-button').disabled = true;
  try {
    pipWindow = await window.documentPictureInPicture.requestWindow({ width: 380, height: 310 });
    const doc = pipWindow.document;
    doc.title = '有期 · 悬浮倒计时';
    doc.documentElement.lang = 'zh-CN';
    doc.documentElement.dataset.theme = document.documentElement.dataset.theme;
    for (const file of ['styles.css', 'flight.css', 'refined.css', 'fonts.css']) {
      const link = doc.createElement('link'); link.rel = 'stylesheet'; link.href = new URL(file, document.baseURI).href;
      doc.head.append(link);
    }
    doc.body.className = 'pip-body';
    const title = doc.createElement('h1'); title.id = 'pip-title';
    const time = doc.createElement('div'); time.id = 'pip-time'; time.setAttribute('role', 'timer');
    const flight = doc.createElement('div'); flight.className = 'flight-visual';
    doc.body.append(title, flight, time);
    pipFlight = mountFlight(flight, 'mini');
    renderPip(getCountdown(state));
    pipWindow.addEventListener('pagehide', () => { pipWindow = null; pipFlight = null; }, { once: true });
    toast('小窗已开启，请保留此网页。');
  } catch { toast('未能打开悬浮小窗，请重试或使用专注模式。'); }
  finally { $('float-button').disabled = false; }
});

window.addEventListener('storage', event => {
  if (event.key === 'youqi.theme' && ['dark', 'light'].includes(event.newValue)) applyTheme(event.newValue);
  if (event.key !== STORAGE_KEY || !event.newValue || sharedView || room) return;
  try {
    const next = validateCountdown(JSON.parse(event.newValue));
    if (JSON.stringify(next) === JSON.stringify(state)) return;
    state = next;
    externalEdit = $('edit-dialog').open;
    saved = true; setSaveLabel(); renderMetadata();
    toast('已同步此浏览器另一个标签页的修改。');
  } catch { /* Ignore invalid external records. */ }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); refreshCloud(); } });
window.addEventListener('online', refreshCloud);
window.addEventListener('pageshow', tick);
window.addEventListener('hashchange', () => location.reload());
function installScrollScene() {
  const root = document.documentElement;
  const story = $('main-content');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0, zoom = 0, zoomTarget = 0, scene = 0, previousPaint = performance.now(), touch = null, zoomReset = null, lastZoomInput = 0;
  function paint(now = performance.now()) {
    frame = 0;
    const delta = Math.min(.1, (now - previousPaint) / 1000); previousPaint = now;
    if (document.body.classList.contains('focus-mode') || scrollY > 1) zoomTarget = 0;
    if (zoomReset) {
      const t = motion.matches ? 1 : Math.min(1, (now - zoomReset.started) / VIEW_RESET_DURATION);
      zoom = zoomReset.from * (1 - easeViewReset(t));
      if (t === 1) zoomReset = null;
    } else zoom = motion.matches ? zoomTarget : dampProgress(zoom, zoomTarget, delta, 8.5);
    if (!zoomReset && Math.abs(zoom - zoomTarget) < .0005) zoom = zoomTarget;
    root.style.setProperty('--globe-zoom', zoom.toFixed(5));
    globe3d?.setZoom(zoom);
    const rect = story.getBoundingClientRect();
    const range = Math.max(1, story.offsetHeight - innerHeight);
    const progress = document.body.classList.contains('focus-mode') ? 1 : Math.min(1, Math.max(0, -rect.top / range));
    const eased = progress * progress * (3 - 2 * progress);
    scene = motion.matches ? (progress >= .5 ? 1 : 0) : dampProgress(scene, eased, delta);
    const p = scene;
    root.dataset.progressDisplay = p < .18 ? 'surface' : 'flat';
    root.style.setProperty('--scene-progress', p.toFixed(5));
    globe3d?.setScroll(p);
    $('globe-reset').tabIndex = p < .12 ? 0 : -1;
    $('globe-enter').tabIndex = p < .12 ? 0 : -1;
    $('globe-enter').disabled = zoomTarget >= .999;
    document.querySelector('.globe-tools').inert = p >= .12;
    document.querySelector('.globe-tools').style.pointerEvents = p < .12 ? 'auto' : 'none';
    const digits = $('digits');
    const fit = Math.min(1, (innerWidth - (innerWidth < 520 ? 32 : 80)) / Math.max(digits.scrollWidth, 1));
    root.style.setProperty('--clock-fit', fit.toFixed(5));
    $('scroll-cue').hidden = progress > .1 || zoom > .1 || document.body.classList.contains('focus-mode');
    if (zoom !== zoomTarget || zoomReset || !motion.matches && scene !== eased) requestPaint();
  }
  function requestPaint() {
    if (frame) return;
    if (performance.now() - previousPaint > 100) previousPaint = performance.now() - 16;
    frame = requestAnimationFrame(paint);
  }
  const canZoom = target => !document.body.classList.contains('focus-mode') && !document.querySelector('dialog[open]') && !target.closest?.('input,textarea,select');
  function advanceView(delta, scrollScale = 1) {
    const now = performance.now(), elapsed = now - lastZoomInput;
    const next = explorationInput(zoomTarget, delta, elapsed > 220 ? 40 : elapsed);
    zoomTarget = next.zoom;
    if (next.scroll > 0) window.scrollBy({top:next.scroll * scrollScale,behavior:'instant'});
    lastZoomInput = now; requestPaint();
  }
  addEventListener('wheel', event => {
    if (event.ctrlKey || !canZoom(event.target) || scrollY > 1) return;
    if (event.deltaY < 0 || zoomTarget > 0 || zoomReset && zoom > 0) {
      event.preventDefault();
      if (zoomReset) { zoomTarget = zoom; zoomReset = null; }
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
      advanceView(delta);
    }
  }, { passive: false });
  addEventListener('touchstart', event => {
    touch = event.touches.length === 1 && canZoom(event.target) ? { x: event.touches[0].clientX, y: event.touches[0].clientY, axis: null, controlled: false } : null;
  }, { passive: true });
  addEventListener('touchmove', event => {
    if (!touch || event.touches.length !== 1 || !canZoom(event.target)) return;
    const point = event.touches[0], dx = point.clientX - touch.x, dy = point.clientY - touch.y;
    if (!touch.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 6) touch.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (touch.axis !== 'y') return;
    touch.x = point.clientX; touch.y = point.clientY;
    if (scrollY <= 1 && (dy > 0 || zoomTarget > 0 || zoomReset && zoom > 0)) {
      event.preventDefault(); touch.controlled = true;
      if (zoomReset) { zoomTarget = zoom; zoomReset = null; }
      advanceView(-dy * 2, .5);
    } else if (touch.controlled) { event.preventDefault(); window.scrollBy(0, -dy); }
  }, { passive: false });
  addEventListener('touchend', () => { touch = null; }, { passive: true });
  addEventListener('touchcancel', () => { touch = null; }, { passive: true });
  addEventListener('journey-view-reset', event => {
    if (event.detail?.preserveZoom) return;
    zoomReset = { from: zoom, started: event.detail?.started ?? performance.now() };
    zoomTarget = 0; requestPaint();
  });
  $('globe-enter').addEventListener('click', () => { if (!globe3d) return; window.scrollTo({top:0,behavior:'instant'}); zoomReset = null; zoomTarget = 1; requestPaint(); });
  addEventListener('keydown', event => { if (event.key === 'Escape' && !document.querySelector('dialog[open]') && zoomTarget > .2) globe3d?.reset(); });
  addEventListener('scroll', requestPaint, { passive: true });
  addEventListener('resize', requestPaint);
  addEventListener('pageshow', requestPaint);
  motion.addEventListener('change', requestPaint);
  new ResizeObserver(requestPaint).observe($('digits'));
  new MutationObserver(requestPaint).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  paint();
}
initialize();
installScrollScene();
import('./globe-3d.js').then(async ({ mountGlobe }) => {
  globe3d = await mountGlobe($('flight-visual'));
  if (!globe3d) return;
  if (latestGlobeValue) globe3d.update(latestGlobeValue);
  globe3d.setScroll(Number(getComputedStyle(document.documentElement).getPropertyValue('--scene-progress')) || 0);
  globe3d.setZoom(Number(getComputedStyle(document.documentElement).getPropertyValue('--globe-zoom')) || 0);
  document.body.classList.add('has-globe-3d');
}).catch(() => { /* Keep the SVG journey usable if 3D resources cannot load. */ });
$('globe-reset').addEventListener('click', () => globe3d?.reset());
