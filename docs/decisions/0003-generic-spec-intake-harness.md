# 0003 Generic Spec Intake Harness

Date: 2026-05-05

## Status

Accepted

## Context

Harness v0 ban đầu đi kèm project-specific `SPEC.md`, product docs, candidate
epics, architecture assumptions, và validation examples. Điều đó làm harness
hữu ích cho project đầu tiên nhưng quá cụ thể để tái sử dụng như outer shell
cho project mới.

Hướng mong muốn là một default harness có thể chờ bất kỳ user-provided spec
nào, dẫn xuất product docs từ spec đó, rồi tiếp tục với cùng intake, story,
proof, và decision loop.

## Decision

Gỡ tracked project-specific spec và pre-sliced product domains khỏi Harness v0.

Harness hiện bắt đầu với:

- Không có baked-in `SPEC.md`.
- Empty product docs ngoại trừ intake guidance.
- Generic story và epic examples.
- Stack-neutral architecture discovery rules.
- Stack-neutral validation columns.
- Source hierarchy xem future user-provided spec là input material, không phải
  permanent living truth.

## Alternatives Considered

1. Giữ original `SPEC.md` như example. Rejected vì examples có thể bị nhầm là
   current product truth.
2. Chuyển original product docs vào examples folder. Hiện rejected vì user yêu
   cầu clean default harness.

## Consequences

Positive:

- Repository dễ tái sử dụng hơn cho bất kỳ project mới nào.
- Future specs có thể tự định nghĩa product domains và stack.
- Agents ít có khả năng nhầm template truth với product truth.

Tradeoffs:

- Harness có ít ví dụ cụ thể hơn cho đến khi spec tiếp theo được cung cấp.
- Spec intake đầu tiên phải tạo product docs và candidate epics trước khi
  implementation planning có thể precise.

## Follow-Up

- Thêm spec-intake template nếu repeated projects cho thấy một stable format.
