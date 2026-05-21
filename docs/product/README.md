# Product Docs

Thư mục này chứa living product contract của omni-agent, được backfill từ BMAD
planning artifacts sau spec intake.

## Files

- `overview.md`: product vision, user, scope, và implementation status.
- `requirements.md`: functional, non-functional, entity, và lifecycle contract.
- `technical-contract.md`: stack, API shape, database, agent execution, và log
  rules.

Detailed historical source vẫn nằm trong `_bmad-output/planning-artifacts/`.

## Update Rule

Khi behavior thay đổi:

1. Cập nhật affected product doc.
2. Cập nhật hoặc tạo story packet.
3. Cập nhật `docs/TEST_MATRIX.md`.
4. Ghi decision nếu thay đổi ảnh hưởng architecture, scope, risk, hoặc một
   product rule đã được quyết định trước đó.
