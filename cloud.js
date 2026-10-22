import { validateCountdown } from './countdown.js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[0-9a-f]{64}$/;
export const ROOM_STORAGE_KEY = 'youqi.room.v1';

export class CloudError extends Error {
  constructor(message, code = 'NETWORK') { super(message); this.name = 'CloudError'; this.code = code; }
}

export function validateRoom(room) {
  if (!room || !UUID.test(room.id) || !TOKEN.test(room.token)) throw new CloudError('共享链接无效，请向分享者索取完整链接。', 'LINK');
  return { id: room.id, token: room.token };
}

export function roomFromHash(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (!params.has('room') && !params.has('key')) return null;
  return validateRoom({ id: params.get('room'), token: params.get('key') });
}

export function roomUrl(base, room) {
  const valid = validateRoom(room), url = new URL(base);
  url.search = '';
  url.hash = new URLSearchParams({ room: valid.id, key: valid.token }).toString();
  return url.href;
}

export function newRoom() {
  const token = [...crypto.getRandomValues(new Uint8Array(32))].map(n => n.toString(16).padStart(2, '0')).join('');
  return { id: crypto.randomUUID(), token };
}

export function parseRecord(row, room) {
  if (!row || row.id !== room.id || !Number.isSafeInteger(row.version) || row.version < 1 || typeof row.can_edit !== 'boolean') throw new CloudError('云端返回了无效记录，请稍后重试。', 'DATA');
  if (row.can_edit && !TOKEN.test(row.viewer_token)) throw new CloudError('云端分享权限无效，请稍后重试。', 'DATA');
  return { ...validateCountdown(row), id: row.id, version: row.version, canEdit: row.can_edit, viewerToken: row.can_edit ? row.viewer_token : null };
}

export class CloudClient {
  constructor(fetcher = globalThis.fetch, base = SUPABASE_URL, key = SUPABASE_PUBLISHABLE_KEY) {
    this.fetcher = fetcher.bind(globalThis);
    this.base = base.replace(/\/$/, '');
    this.key = key;
  }
  async rpc(name, body, signal) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, 12000);
    try {
      const response = await this.fetcher(`${this.base}/rest/v1/rpc/${name}`, {
        method: 'POST', headers: { apikey: this.key, 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: controller.signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer'
      });
      const data = await response.json();
      if (!response.ok) {
        if (name === 'youqi_journey' && data.code === 'P0001') throw new CloudError('稍等片刻再试，输入内容已保留。', 'RATE');
        if (name === 'youqi_letters' && data.code === 'P0001') throw new CloudError('稍等三秒，再留下下一句话。草稿已保留。', 'RATE');
        if (data.code === 'PGRST202' || data.code === 'PGRST205') throw new CloudError('云端数据库尚未初始化，请先执行项目中的初始化 SQL。', 'SETUP');
        if (data.code === '40001') throw new CloudError('对方刚刚更新了倒计时，请关闭编辑窗口，查看最新内容后再修改。', 'CONFLICT');
        if (response.status === 401 || response.status === 403 || data.code === '42501') throw new CloudError('共享链接无效、已失效，或没有编辑权限。', 'ACCESS');
        if (data.code === '22023' || data.code === '23514') throw new CloudError('标题或时间不符合要求，请检查后重试。', 'VALIDATION');
        throw new CloudError('云端暂时无法处理请求，请稍后重试。', 'SERVER');
      }
      return data;
    } catch (error) {
      if (error instanceof CloudError) throw error;
      throw new CloudError(controller.signal.aborted ? '连接超时，尚未确认保存结果，请重试。' : '无法连接云端，请检查网络后重试。', 'NETWORK');
    } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
  }
  async create(room, countdown) {
    validateRoom(room);
    const value = validateCountdown(countdown);
    return parseRecord(await this.rpc('youqi_create', { p_id: room.id, p_token: room.token, p_title: value.title, p_start: value.start, p_end: value.end }), room);
  }
  async read(room, signal) {
    validateRoom(room);
    return parseRecord(await this.rpc('youqi_read', { p_id: room.id, p_token: room.token }, signal), room);
  }
  async update(room, countdown, version) {
    validateRoom(room);
    const value = validateCountdown(countdown);
    return parseRecord(await this.rpc('youqi_update', { p_id: room.id, p_token: room.token, p_title: value.title, p_start: value.start, p_end: value.end, p_version: version }), room);
  }
}
