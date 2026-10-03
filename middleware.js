// Cổng bảo vệ nội dung Premium (truyện tranh + workbook buổi 3..29) — Routing Middleware của Vercel.
//
// Chạy TRƯỚC khi Vercel trả file tĩnh. Người chưa có "thẻ" hợp lệ (cookie ký, chỉ cấp cho người đã Premium thật —
// xem api/asset-session.js) sẽ nhận 403 thay vì file. Nội dung miễn phí (buổi 0..FREE_LESSON_MAX) vẫn mở cho mọi người.
//
// MẶC ĐỊNH TẮT: chỉ chặn khi biến môi trường ASSET_GATE=on (đặt ở Vercel → Settings → Environment Variables).
// Hướng dẫn bật/tắt từng bước: docs/SECURITY.md mục "Cổng bảo vệ nội dung Premium".
//
// Biến môi trường:
//   ASSET_GATE         'on' = chặn; mọi giá trị khác/không đặt = cho qua tất cả (công tắc tắt khẩn cấp)
//   ASSET_GATE_SECRET  chuỗi ngẫu nhiên ≥ 32 ký tự (openssl rand -hex 32) — PHẢI giống nhau ở môi trường chạy cả middleware lẫn hàm cấp thẻ
//   FREE_LESSON_MAX    (tuỳ chọn) buổi miễn phí cuối cùng; mặc định 2 — phải khớp FREE_LESSON_MAX trong eq-gym/index.html
//
// Cho request đi tiếp: next() (tài liệu Vercel: package @vercel/functions).
import { next } from '@vercel/functions';
import { COOKIE_NAME, classifyPath, readCookie, secretOk, verifyToken } from './api/_lib/asset-gate.js';

// Quét rộng có chủ ý: mọi đường dẫn có chữ "comics"/"workbook" hoặc ký tự % (phòng lách bằng mã hoá URL / // / ./).
// Việc phân loại chặt chẽ nằm trong classifyPath(); các đường dẫn khác không bị middleware chạm tới.
export const config = {
  matcher: ['/(.*)comics(.*)', '/(.*)workbook(.*)', '/(.*)%(.*)'],
  runtime: 'nodejs',
};

const deny = (status, text) => new Response(text, {
  status,
  headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
});

export default async function middleware(request) {
  const gateOn = process.env.ASSET_GATE === 'on';

  const freeEnv = Number(process.env.FREE_LESSON_MAX);
  const freeMax = Number.isInteger(freeEnv) && freeEnv >= 0 ? freeEnv : 2;
  const kind = classifyPath(new URL(request.url).pathname, freeMax);
  if (kind === 'open') return next();
  // Cache-Control của vùng truyện/workbook do middleware quyết định (KHÔNG đặt ở vercel.json: header ở đó có thể đè lên
  // phản hồi 403 và khiến trình duyệt nhớ "bị chặn" cả tháng). Cho qua: trình duyệt giữ 30 ngày; riêng nội dung Premium dùng
  // 'private' để máy chủ trung gian không lưu cho người khác. Từ chối: luôn no-store.
  const allow = (privateCopy) => next({ headers: { 'Cache-Control': (privateCopy ? 'private' : 'public') + ', max-age=2592000' } });
  if (!gateOn || kind === 'free') return allow(false);

  // Đã bật cổng mà thiếu khoá → ĐÓNG CỬA (không để lộ nội dung), báo rõ nguyên nhân trong nhật ký
  const secret = process.env.ASSET_GATE_SECRET || '';
  if (!secretOk(secret)) {
    console.error('asset-gate: ASSET_GATE=on nhưng ASSET_GATE_SECRET thiếu hoặc < 32 ký tự');
    return deny(503, 'Content gate misconfigured');
  }

  const token = readCookie(request.headers.get('cookie'), COOKIE_NAME);
  if (token && await verifyToken(secret, token)) return allow(true);
  return deny(403, 'Premium content');
}
