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

- `product/`: current product truth được dẫn xuất từ accepted omni-agent spec.
- `stories/`: feature packets và backlog.
- `decisions/`: durable decisions và tradeoffs.
- `templates/`: reusable spec-intake, story, plan, decision, và validation
  formats.

## Trạng Thái Hiện Tại

Harness v0 đã được dùng để bắt đầu implementation. Backend foundation và
database migration đầu tiên đã tồn tại; frontend scaffold, product handlers,
session lifecycle, và UI vẫn thuộc các stories tiếp theo.

Historical planning và implementation artifacts hiện nằm trong `_bmad-output/`.
