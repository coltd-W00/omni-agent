# Product Docs

Thư mục này cố ý generic và gần như rỗng trong Harness v0.

Khi user cung cấp project spec, dẫn xuất các file product contract nhỏ hơn ở
đây thay vì giữ một spec lớn làm living plan. Đặt tên file theo product domains
thật sự tồn tại trong spec đó, ví dụ `overview.md`, `billing.md`,
`workflows.md`, `permissions.md`, hoặc `api-conventions.md`.

Không tạo domain files trước spec chỉ để lấp đầy folder. Empty structure lành
mạnh hơn fake product truth.

## Update Rule

Khi behavior thay đổi:

1. Cập nhật affected product doc.
2. Cập nhật hoặc tạo story packet.
3. Cập nhật `docs/TEST_MATRIX.md`.
4. Ghi decision nếu thay đổi ảnh hưởng architecture, scope, risk, hoặc một
   product rule đã được quyết định trước đó.
