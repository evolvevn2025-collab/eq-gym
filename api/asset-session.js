// Hàm cấp "thẻ" xem nội dung Premium (cookie HttpOnly, sống 1 giờ). App gọi sau khi đăng nhập và định kỳ làm mới.
//
//   POST   /api/asset-session   Header: Authorization: Bearer <access token Supabase của người đang đăng nhập>
//          → hỏi Supabase xem token có hợp lệ + người đó có Premium thật (hoặc admin) và không bị khoá;
//            đúng → 200 + Set-Cookie eqg_a; sai → 401/403 (kèm xoá thẻ cũ nếu có).
//   DELETE /api/asset-session   → xoá thẻ (đăng xuất).
//
// Cần biến môi trường ASSET_GATE_SECRET (≥ 32 ký tự). Tuỳ chọn: SUPABASE_URL, SUPABASE_ANON_KEY (mặc định là project hiện tại,
// anon key vốn công khai trong app).
import { COOKIE_NAME, COOKIE_PATH, TOKEN_TTL_SEC, secretOk, signToken } from './_lib/asset-gate.js';

const SUPA_URL = (process.env.SUPABASE_URL || 'https://dpzlwlaekhfmorckukfm.supabase.co').replace(/\/+$/, '');
const SUPA_ANON = process.env.SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwemx3bGFla2hmbW9yY2t1a2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0NTk3NDMsImV4cCI6MjEwNTAzNTc0M30.BCSyd379ekTdrY3UKR9UCI72XGU6-xI02RldLSEYCIw';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JWT = /^[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/;

const cookie = (value, maxAge) => `${COOKIE_NAME}=${value}; Path=${COOKIE_PATH}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;

function reply(status, body, setCookie) {
  const h = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  if (setCookie) h.append('Set-Cookie', setCookie);
  return new Response(JSON.stringify(body), { status, headers: h });
}

function supa(path, token) {
  return fetch(SUPA_URL + path, {
    headers: { apikey: SUPA_ANON, Authorization: 'Bearer ' + token, Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  });
}

// Cùng quy tắc với isPremium() trong app: admin/super_admin hoặc premium_until còn hạn; người bị khoá thì không
function premiumOk(row, now = Date.now()) {
  if (!row || row.banned) return false;
  if (row.role === 'admin' || row.role === 'super_admin') return true;
  return !!row.premium_until && new Date(row.premium_until).getTime() > now;
}

export default {
  async fetch(request) {
    if (request.method !== 'POST' && request.method !== 'DELETE') return reply(405, { error: 'method_not_allowed' });

    // Chỉ chấp nhận gọi từ chính trang của mình (không từ web khác)
    const origin = request.headers.get('origin');
    if (origin) {
      let ok = false;
      try { ok = new URL(origin).host === new URL(request.url).host; } catch { /* sai định dạng → từ chối */ }
      if (!ok) return reply(403, { error: 'bad_origin' });
    }

    if (request.method === 'DELETE') return reply(200, { ok: true }, cookie('', 0));

    const secret = process.env.ASSET_GATE_SECRET || '';
    if (!secretOk(secret)) { console.error('asset-session: thiếu ASSET_GATE_SECRET'); return reply(503, { error: 'not_configured' }); }

    const auth = request.headers.get('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (!token || token.length > 4096 || !JWT.test(token)) return reply(401, { error: 'invalid_token' });

    try {
      const u = await supa('/auth/v1/user', token);
      if (u.status === 401 || u.status === 403) return reply(401, { error: 'invalid_token' }, cookie('', 0));
      if (!u.ok) return reply(502, { error: 'auth_unavailable' });
      const user = await u.json();
      if (!user || !UUID.test(String(user.id || ''))) return reply(401, { error: 'invalid_token' });

      const p = await supa(`/rest/v1/profiles?select=role,premium_until,banned&id=eq.${encodeURIComponent(user.id)}`, token);
      if (!p.ok) return reply(502, { error: 'profile_unavailable' });
      const rows = await p.json();
      if (!premiumOk(Array.isArray(rows) ? rows[0] : null)) return reply(403, { error: 'premium_required' }, cookie('', 0));

      const { token: card, exp } = await signToken(secret, user.id);
      return reply(200, { ok: true, exp }, cookie(card, TOKEN_TTL_SEC));
    } catch (e) {
      console.error('asset-session', String(e && e.message || e));
      return reply(502, { error: 'upstream_error' });
    }
  },
};
