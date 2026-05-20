# Test Matrix

This file maps product behavior to proof.

No product behavior has been defined or implemented yet. Do not mark a row
implemented until tests or validation evidence exist.

## Status Values

| Status | Meaning |
| --- | --- |
| planned | Accepted as intended behavior, not implemented |
| in_progress | Actively being built |
| implemented | Implemented and proof exists |
| changed | Contract changed after earlier implementation |
| retired | No longer part of the product contract |

## Matrix

| Story | Contract | Unit | Integration | E2E | Platform | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.1 | `GET /health` → 200 `{"status":"ok"}` | no | no | no | yes | implemented | `curl http://127.0.0.1:8080/health` → `{"status":"ok"}` HTTP 200 |
| 1.1 | Unknown route → 404 `{"error":"not_found","message":"..."}` | no | no | no | yes | implemented | `curl http://127.0.0.1:8080/non-existent` → `{"error":"not_found","message":"Route not found"}` HTTP 404 |
| 1.1 | Axum server starts at `127.0.0.1:8080` | no | no | no | yes | implemented | `cargo run` in `backend/` logs "Server running on http://127.0.0.1:8080" |
| 1.1 | `frontend/` và `backend/` tồn tại trong repo | no | no | no | yes | implemented | `ls omni-agent/` shows `frontend/` và `backend/` |
| 1.1 | `.gitignore` chứa `data/` và `logs/` | no | no | no | yes | implemented | `.gitignore` có dòng `data/` và `logs/` |
| 1.1 | `backend/src/` chứa `main.rs`, `error.rs`, `state.rs` | no | no | no | yes | implemented | `ls backend/src/` shows all 3 files |

## Evidence Rules

- Unit proof covers pure domain and application rules.
- Integration proof covers backend enforcement, data integrity, provider
  behavior, jobs, or service contracts.
- E2E proof covers user-visible browser flows.
- Platform proof covers only shell, deployment, mobile, desktop, or runtime
  behavior that cannot be proven in lower layers.
- A story can be implemented without every proof column if the story packet
  explains why.
