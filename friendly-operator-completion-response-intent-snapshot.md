# Intent Snapshot

## Current Intent

- Làm phần trả lời khi task chạy xong thân thiện hơn với người dùng.
- Giữ response ngắn gọn, thực tế, có cảm giác như một người đang bàn giao kết quả thay vì dump raw output.

## Desired Outcome

- Final response sau task nên nói rõ việc đã hoàn tất ở mức người dùng dễ hiểu.
- Response nên ưu tiên impact và trạng thái bàn giao, không bắt user tự parse log hoặc raw technical detail.
- Vẫn giữ đủ thông tin kỹ thuật cần thiết: file đã đổi, lý do đổi, verification đã chạy, command tiếp theo nếu có.

## Boundaries to Keep

- Không biến final response thành marketing copy hoặc quá cảm xúc.
- Không kéo dài quá mức.
- Không giấu lỗi, test gap, hoặc command chưa chạy được.
- Không thay đổi tone kỹ thuật cốt lõi của agent: vẫn concise, practical, implementation-focused.

## Confirmed Decisions

- Tone chọn: `friendly operator`.
- Response nên đọc như một bàn giao công việc: đã làm gì, kiểm tra thế nào, còn gì user cần biết hoặc chạy tiếp.

## Current Assumptions

- Vấn đề hiện tại là nội dung final answer sau task đang quá raw, không phải lỗi ở runtime output/log.
- Audience chính vẫn là developer hoặc technical user, nhưng không muốn đọc output thô.
- Cần cải thiện response convention/prompt behavior trước, chưa nhất thiết cần thay code.

## Evaluation Criteria

- User đọc final response hiểu ngay task đã xong hay chưa.
- User biết chính xác thay đổi chính và lý do thay đổi.
- User biết verification đã chạy hoặc chưa chạy.
- User biết command tiếp theo nếu có.
- Response không dài dòng và không dump raw logs trừ khi user yêu cầu.

## Open Points

- Cần xác định vị trí áp dụng: system prompt, skill instruction, app UI post-task renderer, hay template trả lời cuối task.
- Cần xem response raw hiện tại nếu muốn chỉnh sát hơn.

## Next Thinking Points

- Nếu chuyển sang implementation, bước tiếp theo nên là tìm nơi định nghĩa final response behavior/template.
- Nên thêm một mẫu before/after ngắn để kiểm tra tone `friendly operator`.
