Đại ca, em xem code hiện tại rồi. CLI đang có các command chính: `init`, `add continuity`, `recall`, `show`, `brief`, `quality status`, `quality record`. Toàn bộ đang nằm trong `main.rs`; deps hiện có chỉ là `clap`, `serde`, `serde_yaml`, `walkdir`, `chrono`, `serde_json`, chưa có logging framework. 

Điểm quan trọng: **đừng log kiểu “command started/ended” là chính**. Muốn đo skill `project-notes` có hiệu quả không thì log phải trả lời được 4 câu:

1. Agent có **nhớ dùng note** trước khi làm không?
2. Recall/brief có **trả đúng note liên quan** không?
3. Note mới tạo ra có **đủ metadata/actionability** không?
4. Quality review có **trigger đúng thời điểm và cho biết skill đang tốt lên hay xấu đi** không?

## Đề xuất log có giá trị

### 1. `brief` / `recall`: đo khả năng “retrieve đúng ký ức”

Hiện `recall` và `brief` dùng chung scoring qua `score_and_filter_notes`, có match theo `area`, `tag`, `task`, text trong `signal/read_when`, rồi sort theo score + recency boost. Đây là nơi đáng log nhất vì nó đo skill có giúp agent tránh đọc lan man không.

Log nên có:

```json
{
  "event": "recall_completed",
  "command": "brief",
  "areas": ["src/agents"],
  "tags": ["harness"],
  "task": "add-project-note-logging",
  "limit": 3,
  "notes_scanned": 42,
  "notes_matched": 7,
  "notes_returned": 3,
  "top_results": [
    {
      "id": "2026-05-25-skill-quality-review",
      "score": 9,
      "created_at": "2026-05-25",
      "areas": [".agents/skills/project-notes"],
      "tags": ["quality"],
      "match_reasons": ["area_prefix", "tag", "signal_text", "recency_boost"]
    }
  ],
  "empty_result": false
}
```

Giá trị đo được:

* `notes_scanned` cao nhưng `notes_matched` thấp → query/area taxonomy có thể đang yếu.
* `notes_matched` nhiều nhưng `top_results` sai → scoring yếu.
* `empty_result=true` với area phổ biến → skill chưa capture đủ project memory.
* `match_reasons` giúp biết note được chọn vì lý do thật hay chỉ ăn recency.

Nên thêm `match_reasons`, không chỉ log score. Score không giải thích được vì sao note được gọi lên.

---

### 2. `add continuity`: đo chất lượng note lúc capture

Hiện `cmd_add_continuity` validate `--task` và `--signal`, rồi ghi note với metadata như `areas`, `tags`, `decisions`, `invariants`, `risks`, `tests`, `missing_tests`, `handoff`, `run`.

Log nên có:

```json
{
  "event": "note_created",
  "note_id": "2026-05-26-add-project-note-logging",
  "path": ".project-notes/notes/2026-05-26-add-project-note-logging.md",
  "task": "add-project-note-logging",
  "signal_length": 92,
  "areas_count": 2,
  "tags_count": 3,
  "decisions_count": 1,
  "invariants_count": 2,
  "risks_count": 1,
  "tests_count": 1,
  "missing_tests_count": 0,
  "has_handoff": true,
  "has_run": false,
  "quality_signals": {
    "has_area": true,
    "has_decision_or_invariant": true,
    "has_test_or_missing_test": true,
    "signal_not_too_short": true
  }
}
```

Giá trị đo được:

* Agent có tạo note nhưng toàn `areas_count=0`, `decisions_count=0`, `tests_count=0` → note tồn tại nhưng không hữu ích.
* `signal_length` quá ngắn thường là note rác.
* `has_test_or_missing_test=false` cho task implementation → skill không tạo bằng chứng kiểm chứng.
* `has_handoff=false` → note kém hữu ích cho agent tiếp theo.

Không cần log full content note. Chỉ log metadata + quality signals là đủ.

---

### 3. `quality status`: đo trigger review có đúng không

Hiện `quality status` đọc `.agents/skills/project-notes/self-improvement/note-quality-review-log.md`, lấy `last_review.reviewed_until`, load notes, lọc note `type=continuity`, chọn notes có `created_at > reviewed_until`, rồi `review_required=yes` nếu count `>= 5`.

Log nên có:

```json
{
  "event": "quality_status_completed",
  "review_log_path": ".agents/skills/project-notes/self-improvement/note-quality-review-log.md",
  "last_review": {
    "reviewed_until": "2026-05-25T10:00:00+07:00",
    "notes_reviewed": 5,
    "average_score": 1.6,
    "decision": "amend"
  },
  "notes_scanned": 42,
  "continuity_notes_scanned": 39,
  "pending_notes": 6,
  "threshold": 5,
  "review_required": true,
  "trigger": "new_notes_since_last_review >= 5",
  "pending_note_ids": [
    "2026-05-26-a",
    "2026-05-26-b"
  ]
}
```

Giá trị đo được:

* Có trigger review đều đặn không.
* Có note bị bỏ qua vì `type` không phải `continuity` không.
* `reviewed_until` parse được không.
* Pending list có đúng notes mới không.

Nên log thêm các case skip:

```json
{
  "event": "note_skipped_in_quality_status",
  "path": ".project-notes/notes/bad.md",
  "reason": "frontmatter_parse_error"
}
```

---

### 4. `quality record`: đo skill có cải thiện sau review không

Hiện `quality record --from <json>` nhận `id`, `reviewed_at`, `reviewed_until`, `notes_reviewed`, `average_score`, `decision`, validate decision thuộc `keep|amend|rollback|inconclusive`, rồi update frontmatter review log.

Log nên có:

```json
{
  "event": "quality_review_recorded",
  "review_id": "qr-2026-05-26-001",
  "reviewed_at": "2026-05-26T16:40:00+07:00",
  "reviewed_until": "2026-05-26T16:30:00+07:00",
  "notes_reviewed": 6,
  "average_score": 1.83,
  "decision": "amend",
  "previous_average_score": 1.6,
  "score_delta": 0.23,
  "previous_decision": "amend"
}
```

Giá trị đo được:

* Skill note đang tốt lên hay xấu đi.
* Review có thực sự cover số note pending không.
* Decision `amend/rollback` xuất hiện nhiều → skill/template cần sửa.

---

## Log nên là JSONL, không phải text log

Vì mục tiêu là đo đạc, em khuyên dùng:

```txt
<project-root>/logs/pnotes-debug.jsonl
```

Mỗi dòng là một JSON event. Dễ `jq`, dễ aggregate, dễ vẽ trend.

Ví dụ query sau này:

```bash
jq 'select(.event=="recall_completed") | {command, notes_scanned, notes_matched, notes_returned, empty_result}' logs/pnotes-debug.jsonl
```

## Điểm cần sửa trong code trước khi log

Hiện CLI dùng path relative như `.project-notes/notes` và `.agents/skills/project-notes/self-improvement/note-quality-review-log.md`; `notes_dir()` còn cho phép override bằng `PNOTES_DIR`.

Nếu muốn log vào `root-project/logs`, cần có hàm resolve project root. Tối thiểu:

* đi từ `current_dir()` ngược lên;
* project root là thư mục có `.project-notes/` hoặc `.agents/skills/project-notes/`;
* fallback là `current_dir()` nếu không tìm thấy.

Không nên log vào cwd mù, vì chạy CLI từ subdir sẽ làm log rơi sai chỗ.

## Bộ event tối thiểu nên thêm

Đủ đo hiệu quả, không log cho có:

```txt
cli_invoked
note_created
notes_loaded
note_skipped
recall_completed
brief_completed
quality_status_completed
quality_review_recorded
cli_failed
```

Trong đó đáng làm trước nhất là:

```txt
recall_completed
brief_completed
note_created
quality_status_completed
quality_review_recorded
```

## Prompt đúng scope cho agent implement

```md
You are working in `.agents/skills/project-notes/pnotes-cli`.

Goal:
Add useful JSONL debug logging to the `pnotes` CLI so we can measure whether the `project-notes` skill is effective. Do not add cosmetic logs. Logs must help evaluate note capture quality, recall quality, brief usefulness, and quality-review trigger behavior.

Output:
- Default log file: `<project-root>/logs/pnotes-debug.jsonl`
- Debug logging is enabled by default for this test phase.
- Use append-only JSONL: one JSON object per line.
- Do not change existing CLI stdout/stderr behavior.
- Do not change note review logic.
- Do not change scoring behavior unless needed only to expose match reasons for logging.
- Do not modify `SKILL.md`.
- Do not introduce a heavy logging framework.

Project root resolution:
- Resolve project root by walking upward from current working directory.
- Prefer a directory containing `.project-notes/` or `.agents/skills/project-notes/`.
- Fallback to current working directory.
- Create `<project-root>/logs` if missing.

Required events:

1. `cli_invoked`
Log:
- timestamp
- command/subcommand
- raw args excluding executable path
- cwd
- project_root
- notes_dir
- review_log_path
- log_path

2. `note_created`
When `pnotes add continuity ...` succeeds, log:
- note_id
- path
- task
- created_at
- signal_length
- areas_count
- tags_count
- decisions_count
- invariants_count
- risks_count
- tests_count
- missing_tests_count
- has_handoff
- has_run
- quality_signals:
  - has_area
  - has_decision_or_invariant
  - has_test_or_missing_test
  - signal_not_too_short

3. `notes_loaded`
When loading notes, log:
- notes_dir
- files_seen
- markdown_files_seen
- notes_loaded
- skipped_count

4. `note_skipped`
For skipped note files, log:
- path
- reason
Examples:
- non_markdown
- read_error
- missing_frontmatter
- frontmatter_parse_error
- unsupported_note_type
- datetime_parse_error

5. `recall_completed`
When `pnotes recall ...` completes, log:
- areas
- tags
- task
- limit
- notes_scanned
- notes_matched
- notes_returned
- empty_result
- top_results with:
  - id
  - path
  - score
  - created_at
  - areas
  - tags
  - match_reasons

6. `brief_completed`
When `pnotes brief ...` completes, log the same retrieval metrics as `recall_completed`, plus:
- decisions_returned
- invariants_returned
- risks_returned
- tests_returned
- missing_tests_returned
- superseded_notes_removed

7. `quality_status_completed`
When `pnotes quality status` completes, log:
- review_log_path
- last_review.reviewed_until
- last_review.notes_reviewed
- last_review.average_score
- last_review.decision
- notes_scanned
- continuity_notes_scanned
- pending_notes
- threshold
- review_required
- trigger
- pending_note_ids

8. `quality_review_recorded`
When `pnotes quality record --from ...` succeeds, log:
- review_id
- reviewed_at
- reviewed_until
- notes_reviewed
- average_score
- decision
- previous_reviewed_until
- previous_average_score
- previous_decision
- score_delta if previous_average_score exists

9. `cli_failed`
Before exiting with an error, log:
- command/subcommand if known
- error_type
- error_message
- path if relevant

Implementation constraints:
- Keep changes minimal.
- Add small helper functions only.
- Prefer manual `serde_json::json!` event writing.
- Do not log full note bodies.
- Do not log secrets or environment dumps.
- Preserve existing tests if any.
- Add tests only if the repo already has a test pattern for this CLI.

After implementation, show:
- files changed
- command used to test
- sample `logs/pnotes-debug.jsonl` lines
```

Kết luận của em: **log có giá trị nhất không nằm ở “CLI chạy chưa”, mà nằm ở retrieval quality + note capture quality + quality review trend**. Nếu 3 nhóm đó đo được, Đại ca sẽ biết skill đang giúp agent nhớ đúng hơn hay chỉ đang tạo thêm markdown rác.