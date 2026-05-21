# 0002 Seed Specification Product Lifecycle

Date: 2026-05-05

## Status

Superseded by `0003-generic-spec-intake-harness.md`

## Context

Harness v0 ban đầu giả định repository sẽ có một seed specification file cho
product đầu tiên. Decision này giải thích cách agents nên phân rã initial
specification đó thành product docs, story packets, implementation, và
validation proof, rồi tiếp tục làm việc sau khi seed đã được dùng hết.

Cách tiếp cận đó phù hợp với một project đơn lẻ nhưng làm harness kém reusable.

## Decision

Xem initial specification như một seed và historical snapshot, không phải
permanent living product plan.

Sau khi initial specification đã được dùng hết, công việc mới nên đi qua cùng
harness loop như một trong các input types sau:

- Change request.
- New initiative.
- Maintenance request.
- Harness improvement.

Product docs dưới `docs/product/`, story packets dưới `docs/stories/`,
validation evidence trong `docs/TEST_MATRIX.md`, và decision records dưới
`docs/decisions/` trở thành living operating surface.

Large future product areas nên được ghi lại dưới dạng scoped initiative notes
thay vì append vào seed specification hoặc viết lại thành monolithic spec thứ
hai.

## Consequences

Positive:

- Original specification giữ ổn định như historical context.
- Product truth chuyển vào các file nhỏ hơn, current hơn, maintainable hơn.
- Future work tiếp tục dùng cùng intake, story, proof, và harness-growth loop.
- Large ideas vẫn có thể được plan mà không tạo thêm oversized spec.

Tradeoffs:

- Repository cuối cùng sẽ cần initiative template nếu large new product areas
  trở nên phổ biến.
- Agents phải cẩn thận cập nhật product docs và tests thay vì dựa vào seed
  specification sau initial buildout.
