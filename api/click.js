// Считает клик по кнопке. Страница шлёт POST /api/click?b=vpn (или love, site).

const { track, sendJson, BUTTONS } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST only' });
  const button = new URL(req.url, 'http://local').searchParams.get('b');
  if (!BUTTONS.includes(button)) return sendJson(res, 400, { error: 'unknown button' });
  await track(req, button);
  sendJson(res, 200, { ok: true });
};
