# Story 1.1: Monorepo Setup & Backend Scaffold

Status: done

## Story

As a developer,
I want a working monorepo with a Rust Axum backend that starts successfully,
So that the project has a runnable foundation for all subsequent features.

## Acceptance Criteria

1. **Given** the repository is cloned / **When** `cargo run` chạy trong `backend/` / **Then** Axum server khởi động tại `http://127.0.0.1:8080`
2. **Given** backend đang chạy / **When** `GET /health` được gọi / **Then** trả về `200 OK` với body `{"status":"ok"}`
3. **Given** backend đang chạy / **When** request một route không tồn tại / **Then** trả về `404` với error envelope `{"error":"not_found","message":"..."}`
4. **Given** project directory / **When** inspect cấu trúc / **Then** `frontend/` và `backend/` đều tồn tại trong `omni-agent/`
5. **Given** project directory / **When** inspect `.gitignore` / **Then** `data/` và `logs/` được liệt kê (runtime artifacts không commit)
6. **Given** `backend/src/` / **When** inspect / **Then** chứa `main.rs`, `error.rs`, `state.rs`

## Tasks / Subtasks

- [ ] **Task 1: Tạo cấu trúc monorepo thủ công** (AC: 4, 5)
  - [ ] 1.1 Tạo `.gitignore` gốc: thêm `target/`, `node_modules/`, `*.db`, `data/`, `logs/`, `frontend/dist/`
  - [ ] 1.2 Tạo thư mục `frontend/` (placeholder, chưa khởi tạo Vite — Story 1.3)
  - [ ] 1.3 Tạo thư mục `backend/` bằng `cargo new backend --name omni-agent-backend`

- [ ] **Task 2: Thêm Cargo.toml dependencies** (AC: 1)
  - [ ] 2.1 Thêm các crate sau vào `backend/Cargo.toml` với phiên bản đúng:
    - `axum = "0.8"`
    - `tokio = { version = "1", features = ["full"] }`
    - `sqlx = { version = "0.8", features = ["runtime-tokio-native-tls", "sqlite"] }`
    - `serde = { version = "1", features = ["derive"] }`
    - `serde_json = "1"`
    - `uuid = { version = "1", features = ["v4"] }`
    - `thiserror = "1"`
    - `anyhow = "1"`
    - `tower-http = { version = "0.6", features = ["fs", "cors"] }`
    - `tracing = "0.1"`
    - `tracing-subscriber = { version = "0.3", features = ["env-filter"] }`

- [ ] **Task 3: Tạo `backend/src/error.rs`** (AC: 3, 6)
  - [ ] 3.1 Define `AppError` enum với `thiserror`:
    - `NotFound(String)`, `BadRequest(String)`, `Conflict(String)`, `Internal(anyhow::Error)`
  - [ ] 3.2 Implement `IntoResponse` cho `AppError`: map sang HTTP status + JSON body `{"error":"<code>","message":"<text>"}`
    - `NotFound` → 404, code `"not_found"`
    - `BadRequest` → 400, code `"bad_request"`
    - `Conflict` → 409, code `"conflict"`
    - `Internal` → 500, code `"internal_error"`
  - [ ] 3.3 Implement `From<sqlx::Error>` → `AppError::Internal`

- [ ] **Task 4: Tạo `backend/src/state.rs`** (AC: 6)
  - [ ] 4.1 Define `AppState` struct:
    ```rust
    pub struct AppState {
        pub db: sqlx::SqlitePool,
        pub subprocess_map: Arc<Mutex<HashMap<String, tokio::process::Child>>>,
    }
    ```
  - [ ] 4.2 Import `std::sync::Arc`, `tokio::sync::Mutex`, `std::collections::HashMap`

- [ ] **Task 5: Tạo `backend/src/main.rs`** (AC: 1, 2, 3, 6)
  - [ ] 5.1 Khởi tạo `tracing_subscriber` với `EnvFilter` (level INFO mặc định)
  - [ ] 5.2 Tạo `SqlitePool` kết nối đến `~/.omni-agent/omni-agent.db` (tạo thư mục nếu chưa có)
  - [ ] 5.3 Khởi tạo `AppState` với pool và subprocess_map rỗng
  - [ ] 5.4 Build Axum router với:
    - `GET /health` → handler trả `200 {"status":"ok"}`
    - Fallback handler → `AppError::NotFound("Route not found".into())`
  - [ ] 5.5 Bind `TcpListener` tại `127.0.0.1:8080`, chạy `axum::serve`
  - [ ] 5.6 Log `"Server running on http://127.0.0.1:8080"` khi khởi động thành công

- [ ] **Task 6: Verify build và acceptance criteria** (AC: 1–6)
  - [ ] 6.1 Chạy `cargo build` trong `backend/` — phải build thành công (0 errors)
  - [ ] 6.2 Chạy `cargo run` và kiểm tra server khởi động
  - [ ] 6.3 Test `GET /health` → `{"status":"ok"}`
  - [ ] 6.4 Test `GET /unknown-route` → `404` với `{"error":"not_found","message":"..."}`
  - [ ] 6.5 Kiểm tra cấu trúc thư mục đúng theo spec

## Dev Notes

### Phiên bản và lý do chọn

| Crate | Version | Lý do |
|---|---|---|
| axum | 0.8 | Latest stable (announced 2025-01-01 bởi Tokio team), breaking changes từ 0.7 |
| tokio | 1.x + features["full"] | Async runtime bắt buộc cho Axum 0.8 |
| sqlx | 0.8 | Latest, SQLite feature bắt buộc, sẽ dùng `sqlx::migrate!()` ở Story 1.2 |
| tower-http | 0.6 | Phải match với Axum 0.8 — đừng dùng 0.5 sẽ conflict |
| thiserror | 1 | Custom error types có derive macro |
| uuid | 1 + features["v4"] | Session ID và internal ID generation |

**⚠️ Axum 0.8 breaking changes so với 0.7:**
- `Router::with_state` không còn dùng — thay bằng `.with_state()` thông thường
- Extractor order thay đổi — `State` phải đứng cuối trong handler args
- `axum::response::IntoResponse` path đã thay đổi
- Dùng `axum::http::StatusCode` không phải `http::StatusCode`

### Cấu trúc thư mục phải tạo trong Story này

```
omni-agent/                    ← repo root (hiện tại)
├── .gitignore                 ← TẠO MỚI (xem nội dung bên dưới)
├── frontend/                  ← TẠO THƯ MỤC RỖNG (Vite init ở Story 1.3)
│   └── .gitkeep
└── backend/                   ← cargo new backend
    ├── Cargo.toml             ← CẬP NHẬT với đầy đủ dependencies
    ├── Cargo.lock
    └── src/
        ├── main.rs            ← TẠO MỚI
        ├── error.rs           ← TẠO MỚI
        └── state.rs           ← TẠO MỚI
```

**KHÔNG tạo trong story này** (dành cho story sau):
- `backend/src/db/` — Story 1.2
- `backend/src/models/`, `handlers/`, `services/`, `agent/` — Story 1.2+
- `frontend/src/` — Story 1.3

### Nội dung `.gitignore` gốc

```gitignore
# Rust
target/
Cargo.lock     # không ignore Cargo.lock cho binary crate

# Node / Frontend
node_modules/
frontend/dist/
frontend/.vite/

# Runtime artifacts (gitignored per architecture spec)
data/
logs/
*.db
*.db-shm
*.db-wal

# Env
.env
.env.local
```

**Lưu ý:** Architecture spec yêu cầu `data/` và `logs/` phải có trong `.gitignore` — đây là requirement bắt buộc trong AC.

### SQLite path setup (cần cho Story 1.2, setup sẵn ở đây)

Trong `main.rs`, tạo thư mục `~/.omni-agent/` nếu chưa tồn tại:
```rust
let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
let db_dir = std::path::PathBuf::from(&home).join(".omni-agent");
std::fs::create_dir_all(&db_dir)?;
let db_url = format!("sqlite://{}/omni-agent.db", db_dir.display());
```

Dùng `create_if_missing = true` trong SQLiteConnectOptions:
```rust
let opts = sqlx::sqlite::SqliteConnectOptions::from_str(&db_url)?
    .create_if_missing(true);
let pool = sqlx::SqlitePool::connect_with(opts).await?;
```

### Error envelope format — PHẢI tuân thủ

Tất cả lỗi phải trả về JSON format này (xem `error.rs`):
```json
{"error": "not_found", "message": "Route /xyz does not exist"}
```
- `error`: snake_case error code (không spaces, không hoa)
- `message`: human-readable text tiếng Anh

**KHÔNG** trả về:
- Raw Rust error strings
- Stack traces
- HTML error pages
- Wrapped trong `{"data": null, "error": ...}`

### Fallback handler pattern cho Axum 0.8

```rust
async fn fallback_handler() -> impl IntoResponse {
    AppError::NotFound("Route not found".to_string())
}

// Trong router:
let app = Router::new()
    .route("/health", get(health_handler))
    .fallback(fallback_handler)
    .with_state(state);
```

### Health handler — đúng format

```rust
async fn health_handler() -> impl IntoResponse {
    axum::Json(serde_json::json!({"status": "ok"}))
}
```
Trả `200 OK` với content-type `application/json`.

### AppState — dùng Arc<Mutex> đúng cách

```rust
use std::sync::Arc;
use tokio::sync::Mutex;  // Dùng tokio::sync::Mutex, KHÔNG std::sync::Mutex
use std::collections::HashMap;

pub struct AppState {
    pub db: sqlx::SqlitePool,
    pub subprocess_map: Arc<Mutex<HashMap<String, tokio::process::Child>>>,
}
```
**Quan trọng:** Dùng `tokio::sync::Mutex` (async-aware), không `std::sync::Mutex` — sẽ deadlock nếu dùng std version trong async context.

### Cross-story dependencies

Story này là **foundation** — các story sau phụ thuộc vào:
- Story 1.2: Cần `AppState.db` pool để chạy migrations
- Story 1.3: Cần `frontend/` directory để init Vite
- Story 3.1: Cần `AppState.subprocess_map` đã được setup đúng
- Tất cả backend handlers: Cần `AppError` types từ `error.rs`

**Không break** các pattern này khi implement.

### Testing thủ công sau khi implement

```bash
cd backend
cargo run

# Trong terminal khác:
curl http://127.0.0.1:8080/health
# Expected: {"status":"ok"}

curl http://127.0.0.1:8080/non-existent
# Expected: {"error":"not_found","message":"..."}  HTTP 404
```

### Project Structure Notes

- File `backend/src/state.rs` và `error.rs` **phải** tồn tại ở đây — các story sau import từ đây
- Đừng đặt `subprocess_map` trong bất cứ chỗ nào khác ngoài `AppState` — single source of truth
- `backend/` là Rust workspace không cần workspace root `Cargo.toml` — single crate là đủ cho MVP

### References

- Architecture: `_bmad-output/planning-artifacts/architecture.md` — Section "Selected Approach: Manual Monorepo"
- Architecture: `_bmad-output/planning-artifacts/architecture.md` — Section "Complete Project Directory Structure"
- Architecture: `_bmad-output/planning-artifacts/architecture.md` — Section "Format Patterns" (error envelope)
- Architecture: `_bmad-output/planning-artifacts/architecture.md` — Section "Gap 2 — Backend Port: RESOLVED" (port 8080)
- Architecture: `_bmad-output/planning-artifacts/architecture.md` — Section "Enforcement Guidelines" (hard rules)
- Epics: `_bmad-output/planning-artifacts/epics.md` — Story 1.1 Acceptance Criteria
- Project Context: `_bmad-output/project-context.md` — Section "Critical Don't-Miss Rules"

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6-thinking (Devin for Terminal)

### Debug Log References

- `openssl-sys` build failed: `runtime-tokio-native-tls` yêu cầu OpenSSL không có sẵn trên hệ thống. Đã đổi sang `runtime-tokio-rustls` (Rust-native TLS) — không ảnh hưởng đến SQLite functionality vì SQLite không dùng TLS.

### Completion Notes List

- **Deviation từ spec**: `sqlx` feature `runtime-tokio-native-tls` đã được thay bằng `runtime-tokio-rustls` vì OpenSSL không cài trên môi trường build. Rustls là Rust-native TLS implementation, đảm bảo portability tốt hơn.
- Tất cả 6 AC đã verified thủ công bằng `curl`.
- 2 compiler warnings (dead code cho `BadRequest`, `Conflict` variants và `db`, `subprocess_map` fields) là expected — các variant/field này sẽ được dùng trong Story 1.2+.

### File List

- `.gitignore` (tạo mới tại repo root)
- `frontend/.gitkeep` (tạo mới)
- `backend/Cargo.toml` (cập nhật dependencies)
- `backend/src/main.rs` (tạo mới)
- `backend/src/error.rs` (tạo mới)
- `backend/src/state.rs` (tạo mới)
