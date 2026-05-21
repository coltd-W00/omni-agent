# Feature Intake

Mọi implementation prompt đi qua intake gate trước khi có code changes. Một
project spec mới cũng đi qua gate này trước khi trở thành product docs, stories,
hoặc implementation work.

Human không cần phân loại risk. Harness làm việc đó.

## Intake Flow

```text
User prompt
    |
    v
Classify input type
    |
    v
Restate as work item
    |
    v
Find affected product docs and stories
    |
    v
Run risk checklist
    |
    v
Choose lane: tiny, normal, or high-risk
```

## Input Types

Dùng input type để quyết định công việc nên đi đâu trước khi chọn risk lane.

| Type | Dùng khi | Typical artifact |
| --- | --- | --- |
| New spec | Biến project spec do user cung cấp thành docs sẵn sàng cho harness | Product docs, candidate epics, decisions |
| Spec slice | Implement selected behavior từ accepted spec | Story packet |
| Change request | Thay đổi, sửa, hoặc tinh chỉnh accepted behavior | Story packet hoặc direct patch |
| New initiative | Thêm product area lớn hơn cần nhiều stories | Initiative notes cộng với story packets |
| Maintenance request | Thay đổi technical, operational, hoặc dependency behavior | Story packet, validation report, hoặc decision |
| Harness improvement | Cải thiện cách humans và agents cộng tác | Direct docs update hoặc `docs/HARNESS_BACKLOG.md` |

Sau intake, mặc định không tạo hoặc mở rộng monolithic spec. Dùng product docs,
stories, decisions, và initiative notes làm living surface.

## Lanes

### Tiny

Dùng cho docs, copy, names, hoặc narrow edits có risk thấp.

Requirements:

- Patch trực tiếp.
- Giữ affected docs current.
- Chạy quick checks có sẵn.
- Chỉ cập nhật harness nếu phát hiện friction.

### Normal

Dùng cho story-sized behavior với blast radius có giới hạn.

Requirements:

- Tạo hoặc cập nhật một story file từ `docs/templates/story.md`.
- Link relevant product docs.
- Thêm hoặc cập nhật validation expectations.
- Implement smallest vertical slice khi implementation tồn tại.
- Cập nhật `docs/TEST_MATRIX.md`.

### High-Risk

Dùng khi công việc có thể ảnh hưởng security, data, scope, contracts, hoặc
nhiều roles/platforms.

Requirements:

- Tạo story folder bằng `docs/templates/high-risk-story/`.
- Điền `execplan.md`, `overview.md`, `design.md`, và `validation.md`.
- Hỏi human confirmation trước implementation nếu direction ambiguous.
- Ghi decision khi behavior hoặc architecture thay đổi đáng kể.

## Risk Checklist

Đánh dấu một flag cho mỗi item áp dụng:

| Risk flag | Áp dụng khi công việc chạm vào |
| --- | --- |
| Auth | login, logout, sessions, JWT, password, refresh token |
| Authorization | roles, permissions, tenant hoặc company scope |
| Data model | schema, migrations, uniqueness, deletion, retention |
| Audit/security | audit logs, privacy, sensitive data, access logs |
| External systems | email, payments, cloud services, provider SDKs, queues, webhooks |
| Public contracts | API shape, response envelope, client-visible behavior |
| Cross-platform | desktop/mobile/browser split, native shell behavior, deep links |
| Existing behavior | already implemented hoặc test-covered behavior changes |
| Weak proof | tests quanh affected area không rõ hoặc còn thiếu |
| Multi-domain | hơn một product domain thay đổi cùng lúc |

## Classification

```text
0-1 flags:
  tiny or normal, based on code impact

2-3 flags:
  normal with stronger validation

4+ flags:
  high-risk

Any hard gate:
  high-risk unless the human explicitly narrows scope
```

Hard gates:

- Auth.
- Authorization.
- Data loss hoặc migration.
- Audit/security.
- External provider behavior.
- Removing hoặc weakening validation requirements.

## Output

Ở cuối intake, agent nên có thể nói:

```text
Lane: normal
Reason: touches authorization, API contract, and audit behavior.
Docs: permissions, account-settings, audit-log.
Story: docs/stories/epics/E02-access-control/US-014-manager-updates-role.md.
Validation: unit, integration, E2E.
```
