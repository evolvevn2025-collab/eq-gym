// Dùng chung cho middleware.js (kiểm tra thẻ) và api/asset-session.js (cấp thẻ).
// Chỉ dùng Web Crypto + xử lý chuỗi → chạy giống hệt trên Vercel (Node) và trong bài test.
//
// "Thẻ" = cookie `eqg_a` = v1.<hết hạn unix>.<12 hex băm người dùng>.<chữ ký HMAC-SHA256 base64url>
//  • Chỉ hàm cấp thẻ (đã hỏi Supabase xem người đó có Premium thật) mới ký được — khoá nằm ở biến môi trường ASSET_GATE_SECRET.
//  • Sống 1 giờ, app tự làm mới; HttpOnly nên XSS không đọc được.

export const COOKIE_NAME = 'eqg_a';
export const COOKIE_PATH = '/eq-gym/';
export const TOKEN_TTL_SEC = 3600;
const VERSION = 'v1';
const MAX_FUTURE_SEC = 2 * 3600;      // từ chối thẻ có hạn quá xa so với hiện tại (không thể do hàm cấp thẻ tạo ra)
const enc = new TextEncoder();

let keyCache = { secret: null, key: null };

export const secretOk = (secret) => typeof secret === 'string' && secret.length >= 32;

async function hmacKey(secret) {
  if (keyCache.secret === secret) return keyCache.key;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  keyCache = { secret, key };
  return key;
}

function b64url(buf) {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// 12 ký tự hex đầu của SHA-256(uid): đủ để truy vết 1 thẻ về 1 tài khoản trong nhật ký, nhưng không lộ uid
export async function userTag(uid) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(String(uid))));
  return Array.from(d.slice(0, 6), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function signToken(secret, uid, nowSec = Math.floor(Date.now() / 1000)) {
  const exp = nowSec + TOKEN_TTL_SEC;
  const body = `${VERSION}.${exp}.${await userTag(uid)}`;
  const sig = b64url(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body)));
  return { token: `${body}.${sig}`, exp };
}

export async function verifyToken(secret, token, nowSec = Math.floor(Date.now() / 1000)) {
  if (typeof token !== 'string' || token.length > 200) return false;
  const p = token.split('.');
  if (p.length !== 4 || p[0] !== VERSION) return false;
  if (!/^\d{9,11}$/.test(p[1]) || !/^[0-9a-f]{12}$/.test(p[2]) || !/^[A-Za-z0-9_-]{43}$/.test(p[3])) return false;
  const exp = Number(p[1]);
  if (exp <= nowSec || exp > nowSec + MAX_FUTURE_SEC) return false;
  let sig;
  try { sig = unb64url(p[3]); } catch { return false; }
  // crypto.subtle.verify so sánh chữ ký trong thời gian không phụ thuộc nội dung
  return crypto.subtle.verify('HMAC', await hmacKey(secret), sig, enc.encode(`${p[0]}.${p[1]}.${p[2]}`));
}

export function readCookie(cookieHeader, name = COOKIE_NAME) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

/**
 * Phân loại một đường dẫn yêu cầu:
 *   'open'  — không thuộc vùng nội dung Premium → cho qua
 *   'free'  — nội dung miễn phí (buổi 0..freeMax, đúng định dạng tên file) → cho qua
 *   'gated' — nội dung Premium (hoặc đường dẫn đáng ngờ) → cần thẻ
 * Nguyên tắc: NGHI NGỜ THÌ CHẶN. Chỉ những đường dẫn khớp CHÍNH XÁC mẫu miễn phí mới được miễn thẻ.
 */
export function classifyPath(rawPathname, freeMax = 2) {
  let p = String(rawPathname || '');
  let suspicious = false;
  if (p.includes('%')) {
    suspicious = true;                           // đường dẫn mã hoá % không bao giờ được hưởng ưu đãi "miễn phí"
    try { p = decodeURIComponent(p); } catch { return 'gated'; }
  }
  if (p.includes('%') || /\\|\.\.|\/\/|[\u0000-\u001f]/.test(p)) suspicious = true;   // mã hoá lồng, dấu \, .., //, ký tự điều khiển
  if (!/comics|workbook/i.test(p)) return 'open';
  if (suspicious) return 'gated';
  const num = '(0|[1-9]\\d?)';
  const free = [
    new RegExp(`^/eq-gym/comics/l${num}/p\\d{2}\\.jpg$`),
    new RegExp(`^/eq-gym/workbook/w${num}/p\\d{2}\\.jpg$`),
    new RegExp(`^/eq-gym/workbook/bai-${num}\\.pdf$`),
  ];
  for (const re of free) {
    const m = re.exec(p);
    if (m && Number(m[1]) <= freeMax) return 'free';
  }
  return 'gated';
}
