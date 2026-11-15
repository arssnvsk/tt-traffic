// Общие функции для API. Файлы с "_" в начале Vercel не превращает в адреса.
//
// Статистика хранится в Upstash Redis (бесплатно, подключается в Vercel → Storage).
// Работаем через его REST API, поэтому никакие npm-пакеты не нужны.

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const KEEP_SECONDS = 400 * 24 * 60 * 60; // храним статистику ~13 месяцев
const TIMEZONE = 'Europe/Minsk';          // сутки считаем по Минску/Москве (UTC+3)

function hasRedis() {
  return Boolean(REDIS_URL && REDIS_TOKEN);
}

// Выполнить несколько команд Redis за один запрос. Возвращает массив результатов.
async function redis(commands) {
  if (!hasRedis()) throw new Error('Redis не подключён');
  const r = await fetch(REDIS_URL.replace(/\/$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error('Redis ответил ' + r.status);
  const out = await r.json();
  return out.map((x) => (x && 'result' in x ? x.result : null));
}

// Дата YYYY-MM-DD по Минску
function day(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(date);
}

function country(req) {
  const c = String(req.headers['x-vercel-ip-country'] || '').toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : 'XX'; // XX — страна не определилась
}

function ip(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || String(req.headers['x-real-ip'] || '') || 'unknown';
}

// Боты и превью ссылок (мессенджеры, поисковики) — их не считаем
function isBot(req) {
  const ua = String(req.headers['user-agent'] || '');
  return !ua || /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse/i.test(ua);
}

// Записать событие: заход на страницу (button = null) или клик по кнопке.
// Ключи в Redis:
//   stats:<день>         — хэш счётчиков: "v|BY" (заходы), "c|vpn|BY" (клики)
//   uv:<день>            — уникальные посетители за день (HyperLogLog по IP)
//   uc:<кнопка>:<день>   — уникальные кликнувшие по кнопке за день
async function track(req, button) {
  if (!hasRedis() || isBot(req)) return;
  const d = day();
  const c = country(req);
  const who = ip(req);
  const statsKey = 'stats:' + d;
  const uniqKey = button ? 'uc:' + button + ':' + d : 'uv:' + d;
  const field = button ? 'c|' + button + '|' + c : 'v|' + c;

  const work = redis([
    ['HINCRBY', statsKey, field, 1],
    ['PFADD', uniqKey, who],
    ['EXPIRE', statsKey, KEEP_SECONDS],
    ['EXPIRE', uniqKey, KEEP_SECONDS],
  ]);
  // Не держим посетителя дольше 1.5 с, даже если Redis тормозит
  const timeout = new Promise((resolve) => setTimeout(resolve, 1500));
  try { await Promise.race([work, timeout]); } catch (e) { console.error('track:', e.message); }
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.end(JSON.stringify(data));
}

module.exports = { redis, hasRedis, day, country, track, sendJson };
