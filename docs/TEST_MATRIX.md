# Test Matrix

File này map product behavior tới proof.

Chưa có product behavior nào được định nghĩa hoặc implemented. Không mark một
row là implemented cho đến khi có tests hoặc validation evidence.

## Status Values

| Status | Meaning |
| --- | --- |
| planned | Đã được chấp nhận như intended behavior, chưa implemented |
| in_progress | Đang được build |
| implemented | Đã implemented và có proof |
| changed | Contract thay đổi sau implementation trước đó |
| retired | Không còn là một phần của product contract |

## Matrix

| Story | Contract | Unit | Integration | E2E | Platform | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TBD | Thêm rows khi story packets được tạo | no | no | no | no | planned | none |

## Evidence Rules

- Unit proof bao phủ pure domain và application rules.
- Integration proof bao phủ backend enforcement, data integrity, provider
  behavior, jobs, hoặc service contracts.
- E2E proof bao phủ user-visible browser flows.
- Platform proof chỉ bao phủ shell, deployment, mobile, desktop, hoặc runtime
  behavior không thể chứng minh ở lower layers.
- Một story có thể được implemented mà không cần mọi proof column nếu story
  packet giải thích vì sao.
