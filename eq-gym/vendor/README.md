# Thư viện bên thứ ba (tự lưu, không tải từ CDN)

Trước đây app nạp thư viện từ CDN (jsDelivr/cdnjs) với phiên bản "trôi" (`supabase-js@2`) và không có SRI. Nếu CDN hoặc gói bị chiếm quyền, mã độc chạy được trong trang (kể cả trang Quản trị đang đăng nhập). Nay mọi thư viện nằm trong repo, được phục vụ cùng nguồn (`script-src 'self'`).

| File | Gói npm | Phiên bản | SHA-256 |
|---|---|---|---|
| `supabase-js-2.117.2.js` | `@supabase/supabase-js` (`dist/umd/supabase.js`) | 2.117.2 | `59d39487c3589843b410322d8a3d562ce022aba1e5ccb16898ef3fb2a0da2ecd` |
| `qrcode-1.5.1.js` | `qrcode` (`build/qrcode.js`) | 1.5.1 | `ba588dfaf738bf8980e5da3b680ab1ce3f205af7577454c16f9c0506fe744df4` |
| `pdfjs-3.11.174/pdf.min.js` | `pdfjs-dist` (`build/pdf.min.js`) | 3.11.174 | `5b5799e6f8c680663207ac5b42ee14eed2a406fa7af48f50c154f0c0b1566946` |
| `pdfjs-3.11.174/pdf.worker.min.js` | `pdfjs-dist` (`build/pdf.worker.min.js`) | 3.11.174 | `feabdf309770ed24bba31a5467836cdc8cf639c705af27d52b585b041bb8527b` |
| `exceljs-4.4.0.min.js` | `exceljs` (`dist/exceljs.min.js`) | 4.4.0 | `7e49da68588e250dbb8bba190d2caa8ab3787cc0284bda1d8b2f805c4df742c9` |
| `jspdf-4.2.1.umd.min.js` | `jspdf` (`dist/jspdf.umd.min.js`) | 4.2.1 | `e6551fcdc32f09d6853b2c5126d18d01d9447e0da618a41a11ebeee0f6c20d54` |
| `jspdf-autotable-5.0.9.min.js` | `jspdf-autotable` (`dist/jspdf.plugin.autotable.min.js`) | 5.0.9 | `83dd8e5ae29436bd3d3ef4f4a915125b3951264994c25de0359d3fbd105abe15` |
| `fonts/Roboto-Regular-vi.ttf` | `@expo-google-fonts/roboto` 0.4.3 (`400Regular/Roboto_400Regular.ttf`, cắt còn Latin + tiếng Việt bằng `pyftsubset`) | — | `1366680ccaa69080b7295b68f8d8804cfd0f25323a6243d43764347fcb2d475f` |
| `fonts/Roboto-Bold-vi.ttf` | như trên (`700Bold/Roboto_700Bold.ttf`) | — | `48dfafb92da3e2a783af27920cef069b509be3d1074d9064d2fb58c5946f8349` |

Giấy phép: thư mục `licenses/`. Excel/PDF (ExcelJS, jsPDF, font Roboto) chỉ được nạp khi quản trị viên bấm "Xuất" trong trang Quản trị (font nạp bằng fetch cùng nguồn).

## Cập nhật một thư viện

1. `npm pack <gói>@<phiên bản>` (npm tự kiểm tra toàn vẹn gói theo registry), giải nén, lấy đúng file ở cột 2.
2. Đặt vào thư mục này với tên có **số phiên bản** (để cache `immutable` an toàn), cập nhật bảng trên (`sha256sum <file>`).
3. Đổi đường dẫn trong `eq-gym/index.html` và `eq-gym/admin/index.html`, xoá bản cũ.
4. Thử app + trang Quản trị trên bản Preview của Vercel, xem Console không có lỗi CSP.
5. Với `supabase-js`: sau khi nâng cấp hãy duyệt lại thay đổi quan trọng ở changelog (đặc biệt phần Auth/PKCE).
