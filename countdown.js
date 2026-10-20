export const STORAGE_KEY = 'youqi.countdown.v1';
export const MAX_DURATION = 366 * 100 * 86400000;

export function validateCountdown(value) {
  if (!value || typeof value !== 'object' || typeof value.title !== 'string') throw new Error('倒计时内容无效。');
  const title = value.title.trim();
  const start = Date.parse(value.start);
  const end = Date.parse(value.end);
  if (!title || title.length > 40) throw new Error('请输入 1 至 40 字的标题。');
  if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error('请填写有效的开始和截止时间。');
  if (end <= start) throw new Error('截止时间需要晚于开始时间。');
  if (end - start > MAX_DURATION) throw new Error('倒计时跨度请设在 100 年以内。');
  return { title, start: new Date(start).toISOString(), end: new Date(end).toISOString() };
}

export function getCountdown(value, now = Date.now()) {
  const start = Date.parse(value.start), end = Date.parse(value.end);
  const phase = now < start ? 'upcoming' : now < end ? 'active' : 'ended';
  const remaining = Math.max(0, Math.ceil(((phase === 'upcoming' ? start : end) - now) / 1000));
  return {
    phase,
    days: Math.floor(remaining / 86400),
    hours: Math.floor(remaining / 3600) % 24,
    minutes: Math.floor(remaining / 60) % 60,
    seconds: remaining % 60,
    progress: Math.min(100, Math.max(0, (now - start) / (end - start) * 100))
  };
}

export function defaultCountdown(now = new Date()) {
  const start = new Date(now); start.setSeconds(0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 30); end.setHours(18, 0, 0, 0);
  return validateCountdown({ title: '下一次见面', start: start.toISOString(), end: end.toISOString() });
}

export function encodeShare(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(validateCountdown(value)));
  return btoa(Array.from(bytes, b => String.fromCharCode(b)).join('')).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export function decodeShare(encoded) {
  if (encoded.length > 2048 || !/^[a-zA-Z0-9_-]+$/.test(encoded)) throw new Error('分享链接格式无效。');
  try {
    const text = atob(encoded.replaceAll('-', '+').replaceAll('_', '/'));
    return validateCountdown(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(text, c => c.charCodeAt(0)))));
  } catch { throw new Error('分享链接内容无效，请向分享者索取新链接。'); }
}

export function toLocalInput(iso) {
  const d = new Date(iso), pad = n => String(n).padStart(2, '0');
  return `${String(d.getFullYear()).padStart(4, '0')}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
