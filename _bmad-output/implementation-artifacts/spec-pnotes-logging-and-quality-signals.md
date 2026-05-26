---
title: 'pnotes JSONL Logging and Quality Signals'
type: 'feature'
created: '2026-05-26'
status: 'done'
baseline_commit: '18103a66551e56a7aa9d9804005ffda35117b381'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** pnotes CLI không có structured telemetry — không thể đo recall effectiveness hay note quality at creation, khiến skill improvement loop phải dựa vào manual review.

**Approach:** Append một JSONL event vào `logs/pnotes-debug.jsonl` sau mỗi lần chạy `recall`, `brief`, và `add continuity`. `quality status` đọc 20 events gần nhất, tính hai metrics, và append section `log_signals` vào output — agent đọc được concern flag mà không cần xử lý log thủ công.

## Boundaries & Constraints

**Always:**
- Log ghi file (`logs/pnotes-debug.jsonl`, CWD-relative), không ra stdout/stderr.
- Mỗi event có ít nhất 3 measurable fields (ngoài `ts` và `cmd`).
- Không log full note content.
- Tạo thư mục `logs/` nếu chưa tồn tại; silently ignore write errors (pnotes command vẫn succeed).
- Nếu `logs/pnotes-debug.jsonl` chưa tồn tại, `quality status` bỏ qua `log_signals` (không crash).
- `concern_reasons` là fixed string labels, không phải free text.

**Ask First:**
- Nếu phát hiện caller thứ hai của `build_brief` ngoài `cmd_brief` và test module.

**Never:**
- Thay đổi stdout/stderr format của bất kỳ lệnh nào ngoài việc append `log_signals` vào `quality status`.
- Thêm logging framework (chỉ dùng `serde_json` đã có).
- Thay đổi review log format, review threshold logic, hoặc `review_required` flag.
- Implement review automation hay dynamic thresholds.
- Sửa `SKILL.md`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| recall finds notes | `recall --area src/auth`, 3 matches | stdout không đổi; log += `{"cmd":"recall","result_count":3,...}` | N/A |
| recall empty | `recall --area nonexistent`, 0 matches | stdout `No notes found`; log += event với `result_count:0` | N/A |
| add continuity, no area | `add continuity --task foo --signal bar` | note created bình thường; log += `{"cmd":"add","has_area":false,...}` | N/A |
| quality status, log missing | `quality status`, file không tồn tại | output hiện tại không đổi; `log_signals` vắng mặt | Silently skip |
| quality status, concern triggered | ≥20 events, recall_empty_rate > 0.25 | `log_signals` section với `concern: true`, `recall_empty_result_rate_exceeded` | N/A |
| quality status, all OK | rates trong ngưỡng | `log_signals` với `concern: false`, `concern_reasons: []` | N/A |
| log write fails | disk full hoặc permission error | pnotes hoàn thành bình thường; event bị bỏ qua silently | eprintln warn (không exit) |

</frozen-after-approval>

## Code Map

- `.agents/skills/project-notes/pnotes-cli/src/main.rs` -- toàn bộ CLI; 5 chỗ cần sửa: constant + write_debug_event + cmd_recall + cmd_brief + cmd_add_continuity + cmd_quality_status
- `.agents/skills/project-notes/pnotes-cli/Cargo.toml` -- `serde_json` đã có; không cần thay đổi
- `bin/pnotes` -- compiled binary; rebuild sau khi sửa source

## Tasks & Acceptance

**Execution:**
- [x] `main.rs` -- Add constant `LOG_PATH: &str = "logs/pnotes-debug.jsonl"` và function `write_debug_event(event: serde_json::Value)`: tạo `logs/` dir nếu chưa có, open file ở append mode, write serialized JSON + `\n`, silently ignore errors -- logging infrastructure
- [x] `main.rs` -- Modify `cmd_recall`: capture `log_area`, `log_tag`, `log_task` (first value or None) trước khi move vào `RecallFilter`; capture `result_count = scored.len().min(limit)` trước `into_iter().take(limit)`; gọi `write_debug_event` sau loop với fields `{ts, cmd:"recall", area, tag, task, result_count}` -- log recall effectiveness
- [x] `main.rs` -- Modify `cmd_brief`: sau `load_all_notes()`, gọi `score_and_filter_notes(notes.clone(), &RecallFilter{...})` để lấy `result_count`; gọi `build_brief` như cũ; gọi `write_debug_event` sau `print!` với fields `{ts, cmd:"brief", area, tag, task, result_count}` -- log brief effectiveness (double score is acceptable; notes set small)
- [x] `main.rs` -- Modify `cmd_add_continuity`: gọi `write_debug_event` sau `fs::write` với fields `{ts, cmd:"add", task_slug:&task, has_area:!areas.is_empty(), has_tag:!tags.is_empty(), has_decision:!decisions.is_empty()}` -- log note quality at creation
- [x] `main.rs` -- Modify `cmd_quality_status`: đọc `logs/pnotes-debug.jsonl` nếu tồn tại, parse last 20 lines thành `serde_json::Value`, tính `recall_empty_result_rate` (cmd in {"recall","brief"} + result_count==0) / total recall+brief events, tính `note_has_area_false_rate` (cmd=="add" + has_area==false) / total add events; append `log_signals` section theo plain-text format sau block `notes:` -- enable metric-driven concern
- [x] `pnotes-cli/` -- Run `cargo build --release` và copy binary sang `bin/pnotes` -- deploy

**Acceptance Criteria:**
- Given `recall --area x` returns 0 results, when checking `logs/pnotes-debug.jsonl`, then a line with `"cmd":"recall","result_count":0` is present and stdout unchanged.
- Given `add continuity --task t --signal s` (no `--area`), when checking log, then event has `"has_area":false`.
- Given `logs/pnotes-debug.jsonl` absent, when running `quality status`, then no `log_signals` section in output and exit code is 0.
- Given ≥20 recent events where recall_empty_result_rate > 0.25, when running `quality status`, then output contains `concern: true` and `recall_empty_result_rate_exceeded`.
- Given all rates within thresholds, when running `quality status`, then `concern: false` and `concern_reasons: []`.
- Given disk write fails during logging, when running any pnotes command, then command exits 0 and stdout unchanged.

## Spec Change Log

## Design Notes

**JSONL event schemas:**
```jsonc
// recall / brief — area/tag/task = first element or null if empty
{"ts":"2026-05-26T10:00:00+07:00","cmd":"recall","area":"src/auth","tag":null,"task":null,"result_count":3}
// add continuity
{"ts":"2026-05-26T10:01:00+07:00","cmd":"add","task_slug":"auth-fix","has_area":true,"has_tag":false,"has_decision":false}
```

**`log_signals` format** (plain-text, consistent với style hiện tại của `quality status`):
```
log_signals:
  sample_size: 20
  recall_empty_result_rate: 0.33
  note_has_area_false_rate: 0.10
  concern: true
  concern_reasons:
  - recall_empty_result_rate_exceeded
```

**Thresholds** (arbitrary starting point — cần calibrate sau ~50 events thực tế; ghi chú trong code):
- `recall_empty_result_rate > 0.25` → `recall_empty_result_rate_exceeded`
- `note_has_area_false_rate > 0.20` → `note_has_area_false_rate_exceeded`

**`cmd_brief` double-score**: `notes.clone()` để lấy count trước `build_brief`, tránh thay đổi signature của `build_brief` (12 test callsites). Notes set thường < 50 → negligible overhead.

## Verification

**Commands:**
- `cd .agents/skills/project-notes/pnotes-cli && cargo test` -- expected: all existing tests pass (no regressions)
- `cd .agents/skills/project-notes/pnotes-cli && cargo build --release` -- expected: clean compile, no warnings

**Manual checks (if no CLI):**
- Run `./bin/pnotes recall --area . --limit 1`, then `cat logs/pnotes-debug.jsonl` — verify event appended, stdout unchanged.
- Delete `logs/pnotes-debug.jsonl`, run `./bin/pnotes quality status` — verify no `log_signals` section, exit 0.

## Suggested Review Order

**Logging infrastructure (entry point)**

- `LOG_PATH` constant + `write_debug_event`: core design — always-on, fire-and-forget, no crash on error
  [`main.rs:11`](../../.agents/skills/project-notes/pnotes-cli/src/main.rs#L11)

**Metric consumer**

- `compute_log_signals`: reads last 20 events, computes two rates, returns formatted section or None
  [`main.rs:911`](../../.agents/skills/project-notes/pnotes-cli/src/main.rs#L911)

- Integration point in `cmd_quality_status`: appended after notes block, silently omitted when log absent
  [`main.rs:1061`](../../.agents/skills/project-notes/pnotes-cli/src/main.rs#L1061)

**Event producers**

- `cmd_recall`: `log_area/tag/task` captured before move into `RecallFilter`; logged on all 3 exit paths
  [`main.rs:576`](../../.agents/skills/project-notes/pnotes-cli/src/main.rs#L576)

- `cmd_brief`: pre-scoring clone to get `result_count` without changing `build_brief` signature
  [`main.rs:779`](../../.agents/skills/project-notes/pnotes-cli/src/main.rs#L779)

- `cmd_add_continuity`: booleans captured before fields move into `NoteFrontmatter`
  [`main.rs:500`](../../.agents/skills/project-notes/pnotes-cli/src/main.rs#L500)
