# 0004 Chấp Nhận Product Contract Omni-Agent

Date: 2026-05-21

## Trạng Thái

Accepted

## Bối Cảnh

Harness v0 ban đầu generic và không chứa product contract cụ thể. BMAD planning
sau đó đã tạo các artifact omni-agent được chấp nhận: PRD, architecture, UX
design, epics, readiness report, và implementation story packets.

Repo hiện đã có early product implementation trong `backend/`, nên các docs còn
nói chưa có product implementation đã stale.

## Quyết Định

Xem `_bmad-output/planning-artifacts/` là historical source material và
backfill living product contract hiện tại vào:

- `docs/product/`
- `docs/ARCHITECTURE.md`
- `docs/stories/backlog.md`
- `docs/TEST_MATRIX.md`
- `README.md`
- `AGENTS.md`

Tiếp tục dùng Harness intake, story, decision, và validation loops cho công
việc tiếp theo.

## Alternatives Considered

1. Chỉ giữ product truth trong `_bmad-output/`. Rejected vì agents theo
   `AGENTS.md` đọc `docs/product/` trước BMAD artifacts.
2. Chuyển toàn bộ BMAD artifacts vào `docs/`. Rejected vì full artifacts là
   historical records lớn; living docs nên nhỏ hơn và dễ cập nhật hơn.

## Hệ Quả

Positive:

- Agents thấy current product truth mà không cần đọc toàn bộ BMAD outputs trước.
- Harness docs không còn mâu thuẫn với tracked backend implementation.
- Test matrix có thể track proof thật từ story 1.1 trở đi.

Tradeoffs:

- Product facts hiện tồn tại dưới dạng summaries trong `docs/product/` và
  detailed records trong `_bmad-output/`; future changes phải giữ living docs
  current.

## Follow-Up

- Review Story 1.2 và chỉ chuyển từ `review` sang `done` sau code review hoặc
  human acceptance.
- Backfill dedicated normal story packets vào `docs/stories/` nếu repo chọn
  không dùng `_bmad-output/implementation-artifacts/` làm active story
  location nữa.
