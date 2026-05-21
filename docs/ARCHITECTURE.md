# Kiến Trúc

Application stack đã được chọn cho omni-agent MVP.

Implementation hiện mới ở foundation layer: Rust/Axum backend scaffold,
SQLx/SQLite migration, và frontend placeholder. Tài liệu này giữ cả selected
architecture hiện tại và boundary rules cho future stories.

## Stack Đã Chọn

- Frontend: React + TypeScript + Vite.
- Backend: Rust + Axum + Tokio.
- Database: SQLite via SQLx connection pool.
- Agent execution: Codex CLI và Claude CLI qua subprocess.
- Runtime: local-only, single-user, no cloud sync.

## Cấu Trúc Hiện Tại

```text
backend/
  Cargo.toml
  src/
    main.rs
    error.rs
    state.rs
    db/
      mod.rs
      migrations/
        1_init.sql

frontend/
  .gitkeep
```

Frontend scaffold và application modules dự kiến phải đi theo selected stories,
không tạo ngoài story đã chọn.

## Runtime Locations

- SQLite database: `~/.omni-agent/omni-agent.db`.
- Run logs: `~/.omni-agent/logs/{task_id}/{run_id}.log`.
- Dev backend port: `127.0.0.1:8080`.
- Vite dev port dự kiến: `5173`, proxy `/api` tới backend.

## Discovery Trước Khi Chọn Shape

Trước khi đề xuất implementation shape mới hoặc mở rộng stack, xác định:

- Product surfaces: browser, mobile, desktop, CLI, API, worker, hoặc service.
- Runtime stack: language, framework, database, queues, providers, và hosting.
- Core domains: product concepts đáng có stable names và contracts.
- Boundary inputs: user input, API requests, webhooks, jobs, files,
  credentials, provider payloads, và environment configuration.
- Validation ladder: các checks nhỏ nhất có thể chứng minh selected stack.

Ghi stack choices vào `docs/decisions/` khi chúng ràng buộc future work đáng kể.

## Layering Mặc Định

```text
domain
  <- application
      <- infrastructure
          <- interface
              <- app surfaces
```

## Cấu Trúc Candidate

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

Với backend hiện tại, ưu tiên modules hẹp theo story trước khi mở rộng theo
full template.

## Rule Dependency

Inner layers không được depend on outer layers.

| Layer | Có thể depend on | Không được depend on |
| --- | --- | --- |
| domain | không có gì project-external ngoại trừ tiny pure utilities | framework, database, UI, provider, process/env |
| application | domain | framework, UI, provider, database concrete clients |
| infrastructure | domain, application | interface controllers hoặc UI |
| interface | tất cả backend layers | UI state hoặc platform shell assumptions |
| app surfaces | API contracts và app-facing clients | domain internals trực tiếp |

## Rule Boundary Parse-First

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

## Boundary Command/Query

Nếu product có cả reads và writes, giữ command/query separation rõ ở code level
ngay cả khi storage layer đơn giản:

- Commands mutate state và own audit side effects.
- Queries read state và format cho consumers.
- Shared domain rules nằm trong domain/application, không nằm trong
  controllers.

## Boundary State Machine

Task status transitions phải được enforce trong backend service logic, không
chỉ trong frontend rendering. Khi service modules đã tồn tại, handlers không
được mutate `task.status` trực tiếp.

MVP task statuses:

- `Draft`
- `Ready`
- `Assigned`
- `Running`
- `Paused`
- `Failed`
- `Done`
- `Cancelled`

Session statuses:

- `none`
- `running`
- `paused`
- `closed`

## Boundary Agent

Agent-specific CLI behavior phải nằm sau agent strategy abstraction.

- Codex resume: `codex resume <uuid>`.
- Claude resume: `claude --continue --session-id <uuid>`.
- Services không được duplicate command formatting theo từng handler.

## Contract Observability

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
