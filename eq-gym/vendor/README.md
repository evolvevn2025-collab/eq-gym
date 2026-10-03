# Thư viện bên thứ ba (tự lưu, không tải từ CDN)

Trước đây app nạp thư viện từ CDN (jsDelivr/cdnjs) với phiên bản "trôi" (`supabase-js@2`) và không có SRI. Nếu CDN hoặc gói bị chiếm quyền, mã độc chạy được trong trang (kể cả trang Quản trị đang đăng nhập). Nay mọi thư viện nằm trong repo, được phục vụ cùng nguồn (`script-src 'self'`).

| File | Gói npm | Phiên bản | SHA-256 |
|---|---|---|---|
| `supabase-js-2.117.2.js` | `@supabase/supabase-js` (`dist/umd/supabase.js`) | 2.117.2 | `59d39487c3589843b410322d8a3d562ce022aba1e5ccb16898ef3fb2a0da2ecd` |
| `qrcode-1.5.1.js` | `qrcode` (`build/qrcode.js`) | 1.5.1 | `ba588dfaf738bf8980e5da3b680ab1ce3f205af7577454c16f9c0506fe744df4` |
| `pdfjs-3.11.174/pdf.min.js` | `pdfjs-dist` (`build/pdf.min.js`) | 3.11.174 | `5b5799e6f8c680663207ac5b42ee14eed2a406fa7af48f50c154f0c0b1566946` |
| `pdfjs-3.11.174/pdf.worker.min.js` | `pdfjs-dist` (`build/pdf.worker.min.js`) | 3.11.174 | `feabdf309770ed24bba31a5467836cdc8cf639c705af27d52b585b041bb8527b` |

Giấy phép: thư mục `licenses/`.

## Cập nhật một thư viện

1. `npm pack <gói>@<phiên bản>` (npm tự kiểm tra toàn vẹn gói theo registry), giải nén, lấy đúng file ở cột 2.
2. Đặt vào thư mục này với tên có **số phiên bản** (để cache `immutable` an toàn), cập nhật bảng trên (`sha256sum <file>`).
3. Đổi đường dẫn trong `eq-gym/index.html` và `eq-gym/admin/index.html`, xoá bản cũ.
4. Thử app + trang Quản trị trên bản Preview của Vercel, xem Console không có lỗi CSP.
5. Với `supabase-js`: sau khi nâng cấp hãy duyệt lại thay đổi quan trọng ở changelog (đặc biệt phần Auth/PKCE).
