# Documentation Map

Thư mục này chứa project harness và mọi product contract được dẫn xuất từ
future user-provided spec.

## Main Files

- `HARNESS.md`: cách humans và agents cộng tác.
- `FEATURE_INTAKE.md`: cách prompts trở thành tiny, normal, hoặc high-risk
  work.
- `ARCHITECTURE.md`: architecture discovery và boundary rules.
- `TEST_MATRIX.md`: living map từ behavior tới proof.
- `HARNESS_BACKLOG.md`: các cải thiện được phát hiện trong khi làm việc.
- `GLOSSARY.md`: shared terms.

## Folders

- `product/`: current product truth, để trống cho đến khi spec được dẫn xuất.
- `stories/`: feature packets và backlog.
- `decisions/`: durable decisions và tradeoffs.
- `demo/`: walkthroughs cụ thể cho thấy harness biến input thành agent-ready
  work như thế nào.
- `templates/`: reusable spec-intake, story, plan, decision, và validation
  formats.

## Trạng Thái Hiện Tại

Harness v0 tồn tại trước implementation. Các docs này định nghĩa project sẽ
phát triển như thế nào; chúng không hàm ý app code, tests, CI, hoặc deployment
automation đã tồn tại.
