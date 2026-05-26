# Intent Snapshot: pnotes JSONL Logging

## Current Intent

Thêm JSONL debug logging vào `pnotes` CLI để đo hiệu quả của skill `project-notes` — cụ thể là đo xem skill đang giúp agent nhớ đúng hơn, hay chỉ đang tạo thêm markdown rác. Đồng thời tích hợp log analysis nhẹ vào `quality status` để loop cải thiện có thể tự đóng mà không cần agent nhắc thủ công.

## Desired Outcome

- CLI ghi `<project-root>/logs/pnotes-debug.jsonl` sau mỗi lần chạy, mỗi dòng là một JSON event.
- `quality status` đọc log, tính tỉ lệ recall quality và note capture quality gần đây, và trả về section `log_signals` với `concern: true/false` và `concern_reasons`.
- Agent có thể đọc output của `quality status` và tự ra decision "cần review" mà không phải tự tính metric.
- Loop cải thiện hoạt động tự nhiên: `quality status` → agent thấy concern → agent chạy `quality record` → skill tốt lên.

## Boundaries to Keep

- Không thay đổi stdout/stderr hiện tại của CLI (log ghi file, không ra terminal).
- Không log full content của note.
- Không thay đổi note review logic hay scoring behavior.
- Không thêm heavy logging framework.
- Không thêm interpretation phức tạp (label hành động) vào CLI — agent tự interpret.
- Không implement review loop ngay trong sprint này — loop thêm sau khi có data thực.
- Không sửa `SKILL.md`.

## Confirmed Decisions

1. **Hybrid approach**: implement logging đúng spec hiện tại; schema được thiết kế có ý thức cho loop sau; review loop thêm sau khi đủ data để calibrate threshold.
2. **`quality status` tích hợp log analysis**: `quality status` scan N events cuối của `pnotes-debug.jsonl`, tính metrics, thêm section `log_signals` vào output — không thay đổi logic `review_required`.
3. **`log_signals` = Stats + concern flag**: Output gồm metrics thô (ratios, counts) + `concern: true/false` + `concern_reasons: [string]` khi vượt ngưỡng định nghĩa sẵn.

## Current Assumptions

- Log mặc định always-on (không cần env var để bật). Có thể thêm opt-out sau.
- N recent events để sample = **20 events** là starting point, có thể điều chỉnh sau khi có data.
- Ngưỡng concern ban đầu (cần calibrate):
  - `recall_empty_result_rate > 0.25`
  - `note_has_area_false_rate > 0.20`
- Nếu log file chưa tồn tại, `quality status` bỏ qua `log_signals` (không crash, không warn).
- `concern_reasons` là fixed string labels, không phải free text.
- Project root được resolve bằng cách đi ngược từ `current_dir()` tìm `.project-notes/` hoặc `.agents/skills/project-notes/`; fallback là `current_dir()`.

## Evaluation Criteria

- Sau khi implement, `quality status` có thể trả về `concern: true` với `concern_reasons` rõ ràng khi recall quality kém.
- Agent có thể act từ output của `quality status` mà không cần đọc log thủ công.
- Log file không ảnh hưởng đến stdout hiện tại — test bằng cách chạy commands và verify stdout không đổi.
- Không có log event nào rỗng hoặc chỉ có timestamp — mỗi event phải có ít nhất 3 measurable fields.

## Open Points

- Ngưỡng `0.25` và `0.20` là arbitrary starting point — cần quan sát data thực để calibrate. Nên ghi chú này vào code comment.
- Chưa quyết định `log_signals` xuất hiện trong stdout của `quality status` dưới dạng text hay JSON hay YAML — phụ thuộc format hiện tại của `quality status` output.
- Chưa có `log_signals` schema chính thức — cần viết khi implement.

## Next Thinking Points

- Đọc implementation hiện tại của `quality status` trong `main.rs` để biết output format và chỗ nào thêm `log_signals`.
- Xác định `score_delta_trend` tính như thế nào từ JSONL (cần sort by timestamp và compare 2 review gần nhất).
- Sau khi có ~50 events thực tế, review lại ngưỡng concern và quyết định có cần điều chỉnh không.
- Phase sau: xem xét `quality status` có thể gọi từ skill hook hoặc từ `brief` để loop tự đóng hoàn toàn.
