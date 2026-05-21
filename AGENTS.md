# Agent Operating Guide

Repository này đang ở Harness v0. Chưa có product implementation.

Công việc hiện tại của agents là bảo tồn và phát triển collaboration harness
trước khi viết application code. Không scaffold application source folders,
platform shells, package scripts, CI, hoặc tests trừ khi một story sau này rõ
ràng đưa project vào implementation.

## Source Of Truth

Đọc theo thứ tự này:

1. `README.md` để biết project status.
2. `docs/HARNESS.md` để hiểu human-agent operating model.
3. `docs/FEATURE_INTAKE.md` trước khi biến bất kỳ prompt nào thành công việc.
4. User-provided spec hoặc prompt, khi có.
5. `docs/product/` cho current product contracts.
6. `docs/ARCHITECTURE.md` trước khi đề xuất implementation shape.
7. `docs/stories/` cho story packets và backlog.
8. `docs/TEST_MATRIX.md` cho proof status.
9. `docs/decisions/` để biết vì sao các lựa chọn quan trọng được đưa ra.

Harness này không đi kèm project-specific `SPEC.md`. Khi human cung cấp spec
cho project mới, xem spec đó là input material cho buildout đầu tiên. Dẫn xuất
product docs, story packets, architecture decisions, và validation expectations
từ nó. Product docs, stories, tests, và decisions sau đó trở thành living
contract mà agents cần cập nhật khi system phát triển.

## Task Loop

Với mọi task:

1. Phân loại request bằng `docs/FEATURE_INTAKE.md`.
2. Xác định input là new spec, spec slice, change request, new initiative,
   maintenance request, hay harness improvement.
3. Tìm product docs và story files bị ảnh hưởng.
4. Kiểm tra `docs/TEST_MATRIX.md` để biết proof hiện có và gaps.
5. Chỉ làm trong lane đã chọn: tiny, normal, hoặc high-risk.
6. Trước khi kết thúc, hỏi:
   - Product truth có thay đổi không?
   - Validation expectations có thay đổi không?
   - Architecture rules có thay đổi không?
   - Có phát hiện repeated failure pattern không?
   - Next agent có cần instruction rõ hơn không?
7. Cập nhật routine harness files trực tiếp, hoặc thêm proposal vào
   `docs/HARNESS_BACKLOG.md` khi thay đổi mang tính structural.

## Harness Change Policy

Agents có thể cập nhật trực tiếp:

- Story status và evidence.
- Các row trong `docs/TEST_MATRIX.md`.
- Links từ story packets tới product docs.
- Validation notes và reports.
- Các clarification nhỏ gắn với task hiện tại.

Agents nên hỏi human confirmation trước khi:

- Thay đổi architecture direction.
- Gỡ bỏ validation requirements.
- Thay đổi source-of-truth hierarchy.
- Thay đổi risk classification rules.
- Thay thế feature workflow.

## Done Definition

Một task chỉ xong khi:

- Requested change đã hoàn tất hoặc blocker đã được document.
- Relevant docs, stories, và test matrix entries vẫn current.
- Validation commands đã chạy khi chúng tồn tại.
- Missing harness capabilities đã được thêm vào `docs/HARNESS_BACKLOG.md`.
- Final response nói rõ đã thay đổi gì và không làm gì.
