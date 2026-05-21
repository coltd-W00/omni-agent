# Agent Operating Guide

Repository này đã dùng Harness v0 để bắt đầu implementation sản phẩm
omni-agent.

Product contract hiện được dẫn xuất từ BMAD planning artifacts trong
`_bmad-output/planning-artifacts/` và được backfill vào `docs/product/`. App
implementation hiện mới ở Epic 1 foundation: Rust backend scaffold, SQLite
migrations, và placeholder `frontend/`.

Không scaffold thêm application source folders, platform shells, package
scripts, CI, hoặc tests trừ khi một selected story rõ ràng yêu cầu.

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
10. `_bmad-output/` cho historical planning, implementation, và readiness
    artifacts khi cần chi tiết nguồn.

Harness này không đi kèm project-specific `SPEC.md`. Spec đầu tiên đã được
chuyển hóa thành PRD, architecture, UX, epics, và implementation artifacts dưới
`_bmad-output/`. Product docs, stories, tests, và decisions là living contract
mà agents cần cập nhật khi system phát triển.

## Documentation Language

Tất cả tài liệu repo-facing trong `README.md`, `docs/`, story packets,
decisions, backlog, validation reports, và harness notes phải viết bằng tiếng
Việt. Chỉ giữ nguyên tiếng Anh cho code, path, command, API, schema, enum
values, package names, logs, stack traces, và identifiers.

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
