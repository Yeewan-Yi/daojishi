import { STORAGE_KEY, validateCountdown, defaultCountdown, getCountdown, encodeShare, decodeShare, toLocalInput } from './countdown.js';

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
  $('save-label').textContent = !saved ? '暂未保存，关闭后可能丢失' : sharedView ? '分享快照 · 修改仅保存在本机' : '已保存在此设备';
}

function persist() {
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
  if (params.has('c')) {
    try { state = decodeShare(params.get('c')); sharedView = true; }
    catch (error) { toast(error.message); }
  }
  if (!state) { state = readLocal() || defaultCountdown(); persist(); }
  setSaveLabel();
  let theme;
  try { theme = localStorage.getItem('youqi.theme'); } catch { /* Theme falls back to system preference. */ }
  applyTheme(theme === 'dark' || theme === 'light' ? theme : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  renderMetadata();
  tick();
}

function renderMetadata() {
  document.title = `${state.title} · 有期`;
  $('event-title').textContent = state.title;
  $('start-date').textContent = dateFormat.format(new Date(state.start));
  $('end-date').textContent = dateFormat.format(new Date(state.end));
  $('start-time').textContent = `${weekdayFormat.format(new Date(state.start))} · ${timeFormat.format(new Date(state.start))}`;
  $('end-time').textContent = `${weekdayFormat.format(new Date(state.end))} · ${timeFormat.format(new Date(state.end))}`;
  $('timezone-caption').textContent = `${zone} · 本地时区`;
  $('edit-timezone').textContent = `按你的设备时区 ${zone} 输入，分享后会换算为对方的当地时间。`;
  renderTime();
}

function renderTime() {
  const value = getCountdown(state);
  for (const part of ['days', 'hours', 'minutes', 'seconds']) $(part).textContent = pad(value[part]);
  $('days').classList.toggle('long-number', value.days >= 1000);
  const status = { upcoming: '未开始', active: '进行中', ended: '已抵达' }[value.phase];
  $('status-label').textContent = status;
  $('event-kicker').textContent = { upcoming: '距离故事开始，还有', active: '距离这一天，还有', ended: '期待的这一天，到了' }[value.phase];
  const target = value.phase === 'upcoming' ? state.start : state.end;
  $('target-caption').textContent = `${value.phase === 'upcoming' ? '开始于' : '相约于'} ${dateFormat.format(new Date(target))} · ${weekdayFormat.format(new Date(target))} ${timeFormat.format(new Date(target))}`;
  const percent = `${value.progress.toFixed(1)}%`;
  $('progress-value').textContent = percent;
  $('progress-bar').style.width = percent;
  $('progress-track').setAttribute('aria-valuenow', value.progress.toFixed(1));
  $('progress-caption').textContent = { upcoming: '美好的故事，即将开始', active: '每一秒，都更近一点', ended: '这段时光，已经完整走过' }[value.phase];
  $('today').textContent = `${dateFormat.format(new Date())} / ${weekdayFormat.format(new Date())}`;
  if (pipWindow && !pipWindow.closed) renderPip(value);
}

function tick() {
  clearTimeout(tickTimeout);
  renderTime();
  tickTimeout = setTimeout(tick, 1000 - Date.now() % 1000 + 15);
}

function openEdit(field = 'title-input') {
  editingBaseline = JSON.stringify(state);
  externalEdit = false;
  $('title-input').value = state.title;
  $('start-input').value = toLocalInput(state.start);
  $('end-input').value = toLocalInput(state.end);
  $('form-error').textContent = '';
  $('edit-dialog').showModal();
  $(field).focus();
}

for (const id of ['edit-button', 'bottom-edit']) $(id).addEventListener('click', () => openEdit());
$('start-edit').addEventListener('click', () => openEdit('start-input'));
$('end-edit').addEventListener('click', () => openEdit('end-input'));

$('edit-form').addEventListener('submit', event => {
  event.preventDefault();
  if (externalEdit || editingBaseline !== JSON.stringify(state)) {
    $('form-error').textContent = '另一个标签页已修改此倒计时。请关闭后重新打开编辑，避免覆盖新内容。';
    return;
  }
  try {
    const title = $('title-input').value;
    const start = new Date($('start-input').value).toISOString();
    const end = new Date($('end-input').value).toISOString();
    state = validateCountdown({ title, start, end });
  } catch (error) {
    $('form-error').textContent = error instanceof RangeError ? '请填写有效的开始和截止时间。' : error.message;
    return;
  }
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
  const url = new URL(location.href);
  url.search = '';
  url.hash = `c=${encodeShare(state)}`;
  return url.href;
}

$('share-button').addEventListener('click', () => {
  $('share-title').textContent = state.title;
  $('share-date').textContent = dateFormat.format(new Date(state.end));
  $('share-url').value = makeShareUrl();
  $('share-dialog').showModal();
});
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
  document.querySelector('meta[name=theme-color]').content = theme === 'dark' ? '#171d19' : '#f5f6f2';
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
  doc.getElementById('pip-label').textContent = { upcoming: '距离开始', active: '每一秒，都更近一点', ended: '期待的这一天，到了' }[value.phase];
  doc.getElementById('pip-progress').style.width = `${value.progress}%`;
}

$('float-button').addEventListener('click', async () => {
  if (!('documentPictureInPicture' in window)) { $('float-dialog').showModal(); return; }
  if (pipWindow && !pipWindow.closed) { pipWindow.focus(); return; }
  $('float-button').disabled = true;
  try {
    pipWindow = await window.documentPictureInPicture.requestWindow({ width: 360, height: 205 });
    const doc = pipWindow.document;
    doc.title = '有期 · 悬浮倒计时';
    doc.documentElement.lang = 'zh-CN';
    doc.documentElement.dataset.theme = document.documentElement.dataset.theme;
    const style = doc.createElement('style');
    style.textContent = `:root{color-scheme:light;--bg:#f5f6f2;--ink:#344c38;--muted:#7c897a;--line:#e3e9df;--accent:#657f66}:root[data-theme=dark]{color-scheme:dark;--bg:#202922;--ink:#d9e5ce;--muted:#a5b2a2;--line:#354035;--accent:#a6b99a}*{box-sizing:border-box}body{margin:0;padding:20px;background:var(--bg);color:var(--ink);font-family:system-ui,sans-serif;display:flex;flex-direction:column;justify-content:center;min-height:100vh}h1{font-size:14px;font-weight:500;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#pip-time{font-size:clamp(19px,8.5vw,38px);font-variant-numeric:tabular-nums;letter-spacing:-1px;white-space:nowrap;margin:15px 0}#pip-label{font-size:10px;color:var(--muted)}.track{height:3px;background:var(--line);border-radius:3px;margin-top:14px;overflow:hidden}#pip-progress{height:100%;background:var(--accent)}`;
    doc.head.append(style);
    const title = doc.createElement('h1'); title.id = 'pip-title';
    const time = doc.createElement('div'); time.id = 'pip-time'; time.setAttribute('role', 'timer');
    const label = doc.createElement('div'); label.id = 'pip-label';
    const track = doc.createElement('div'); track.className = 'track';
    const progress = doc.createElement('div'); progress.id = 'pip-progress'; track.append(progress);
    doc.body.append(title, time, label, track);
    renderPip(getCountdown(state));
    pipWindow.addEventListener('pagehide', () => { pipWindow = null; }, { once: true });
    toast('小窗已开启，请保留此网页。');
  } catch { toast('未能打开悬浮小窗，请重试或使用专注模式。'); }
  finally { $('float-button').disabled = false; }
});

window.addEventListener('storage', event => {
  if (event.key === 'youqi.theme' && ['dark', 'light'].includes(event.newValue)) applyTheme(event.newValue);
  if (event.key !== STORAGE_KEY || !event.newValue || sharedView) return;
  try {
    const next = validateCountdown(JSON.parse(event.newValue));
    if (JSON.stringify(next) === JSON.stringify(state)) return;
    state = next;
    externalEdit = $('edit-dialog').open;
    saved = true; setSaveLabel(); renderMetadata();
    toast('已同步此浏览器另一个标签页的修改。');
  } catch { /* Ignore invalid external records. */ }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
window.addEventListener('pageshow', tick);
window.addEventListener('hashchange', () => location.reload());
initialize();
