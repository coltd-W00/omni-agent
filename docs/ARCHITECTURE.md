# Architecture

Chưa chọn application stack.

Chưa có application code. Tài liệu này định nghĩa các câu hỏi architecture
tổng quát và boundary rules mà future implementation nên điều chỉnh sau khi có
user-provided spec và stack decision.

## Discovery Before Shape

Trước khi đề xuất implementation shape, xác định:

- Product surfaces: browser, mobile, desktop, CLI, API, worker, hoặc service.
- Runtime stack: language, framework, database, queues, providers, và hosting.
- Core domains: product concepts đáng có stable names và contracts.
- Boundary inputs: user input, API requests, webhooks, jobs, files,
  credentials, provider payloads, và environment configuration.
- Validation ladder: các checks nhỏ nhất có thể chứng minh selected stack.

Ghi stack choices vào `docs/decisions/` khi chúng ràng buộc future work đáng kể.

## Default Layering

```text
domain
  <- application
      <- infrastructure
          <- interface
              <- app surfaces
```

## Candidate Structure

```text
app/
  domain/
    entities/
    value-objects/
    repositories/
    services/

  application/
    commands/
    queries/
    handlers/

  infrastructure/
    database/
    logging/
    notifications/

  interface/
    controllers/
    dto/
    presenters/
    routes/
    middlewares/

surfaces/
  browser/
  mobile/
  desktop/
  cli/
```

Đây là thinking template, không phải scaffold. Chỉ tạo folders thật khi một
story đi vào implementation và selected stack cần chúng.

## Dependency Rule

Inner layers không được depend on outer layers.

| Layer | Có thể depend on | Không được depend on |
| --- | --- | --- |
| domain | không có gì project-external ngoại trừ tiny pure utilities | framework, database, UI, provider, process/env |
| application | domain | framework, UI, provider, database concrete clients |
| infrastructure | domain, application | interface controllers hoặc UI |
| interface | tất cả backend layers | UI state hoặc platform shell assumptions |
| app surfaces | API contracts và app-facing clients | domain internals trực tiếp |

## Parse-First Boundary Rule

Unknown data phải được parse tại boundaries trước khi đi vào inner code.

Boundaries gồm:

- HTTP request bodies, params, và query strings.
- Session payloads và identity claims.
- Environment variables.
- Database rows trả về từ external clients.
- Platform shell payloads.
- Deep links, tokens, và signed URLs.
- Provider webhooks, events, và async payloads.

Target flow:

```text
unknown input
  -> parser
  -> typed DTO or command
  -> application use case
  -> domain object/value object
```

Inner layers nên làm việc với meaningful product types như `UserId`,
`AccountId`, `WorkspaceId`, `Role`, `DateRange`, hoặc domain-specific IDs, thay
vì lặp lại validation trên raw strings.

## Command/Query Boundary

Nếu product có cả reads và writes, giữ command/query separation rõ ở code level
ngay cả khi storage layer đơn giản:

- Commands mutate state và own audit side effects.
- Queries read state và format cho consumers.
- Shared domain rules nằm trong domain/application, không nằm trong
  controllers.

## Observability Contract

Future server nên emit một canonical JSON log line cho mỗi request với:

- timestamp
- level
- request_id
- user_id when known
- action
- duration_ms
- status_code
- message

Audit logs là product records. Application logs là operational records. Không
dùng cái này thay thế cái kia.
