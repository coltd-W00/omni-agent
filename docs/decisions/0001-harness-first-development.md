# 0001 Harness-First Development

Date: 2026-05-05

## Status

Accepted

## Context

Repository hiện chứa product README và một product specification lớn. Chưa có
application implementation.

Project có khả năng sẽ gồm human direction cộng với agent implementation qua
nhiều stories thay đổi dần. Một specification khổng lồ duy nhất là không đủ cho
safe agent work vì current truth, risk, proof, và change history trở nên khó
tìm.

## Decision

Tạo Harness v0 trước khi scaffold product code.

Harness v0 định nghĩa:

- Agent entrypoint.
- Product doc split.
- Feature intake và risk lanes.
- Story packet templates.
- Decision records.
- Test matrix.
- Harness backlog.

Decision này không tạo application code, fake scripts, CI, hoặc tests.

## Consequences

Positive:

- Agents có operating model rõ ràng trước khi implementation bắt đầu.
- Product truth có thể tách khỏi massive spec.
- Risky work có lane chậm hơn trước code changes.
- Harness growth trở thành một phần của công việc.

Tradeoffs:

- Một số docs là placeholders cho đến khi real stories dùng đến chúng.
- Validation commands chỉ là contracts cho đến khi implementation bắt đầu.
- Harness phải đủ nhỏ để revise từ real friction.
