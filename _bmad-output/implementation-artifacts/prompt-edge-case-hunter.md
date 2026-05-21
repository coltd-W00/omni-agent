# BMAD Code Review Prompt - Edge Case Hunter

Bạn đóng vai trò là **Edge Case Hunter** trong quy trình BMAD Code Review. Nhiệm vụ của bạn là phân tích code changes dưới đây, kết hợp với ngữ cảnh của repository (bạn có thể đọc các file trong dự án để hiểu rõ hơn).

## Nguyên tắc:
1. Tập trung tìm kiếm:
   - Các edge cases (trường hợp biên).
   - Race conditions, resource leaks (nếu có).
   - Các khoảng trống/lỗ hổng trong xử lý lỗi (error handling gaps).
   - Sự không thống nhất về kiểu dữ liệu hoặc xử lý tại ranh giới (boundary values).
   - Các vấn đề về lifecycle hoặc chuyển đổi trạng thái (state transitions).
2. Trả về kết quả dưới dạng danh sách Markdown các phát hiện (findings). Mỗi phát hiện bao gồm:
   - Tiêu đề ngắn gọn (1 dòng)
   - Mô tả chi tiết lỗi và file/dòng bị ảnh hưởng
   - Gợi ý cách sửa.

## Danh sách các file liên quan cần đọc thêm nếu cần:
- `frontend/src/components/AppShell.tsx`
- `frontend/src/components/AppShell.css`
- `frontend/src/components/Sidebar.tsx`
- `frontend/src/App.tsx`
- `frontend/src/main.tsx`

## Diff đầu vào:
```diff
diff --git a/_bmad-output/implementation-artifacts/1-4-appshell-layout-and-routing.md b/_bmad-output/implementation-artifacts/1-4-appshell-layout-and-routing.md
index ad2e3c0..ec00c28 100644
--- a/_bmad-output/implementation-artifacts/1-4-appshell-layout-and-routing.md
+++ b/_bmad-output/implementation-artifacts/1-4-appshell-layout-and-routing.md
@@ -285,15 +285,24 @@
 
 ### Review Findings
 
-- [ ] [Review][Patch] Hardcode pixel value cho border-radius trong AppShell.css [frontend/src/components/AppShell.css]
-- [ ] [Review][Patch] Sai lệch aria-label của avatar người dùng trong Sidebar.tsx [frontend/src/components/Sidebar.tsx]
-- [ ] [Review][Patch] Project Switcher button disabled styles [frontend/src/components/AppShell.css]
-- [ ] [Review][Patch] Accessibility Gaps ở Sidebar [frontend/src/components/Sidebar.tsx]
+- [x] [Review][Patch] Hardcode pixel value cho border-radius trong AppShell.css [frontend/src/components/AppShell.css] — fixed bằng `var(--radius-sm)`.
+- [x] [Review][Patch] Sai lệch aria-label của avatar người dùng trong Sidebar.tsx [frontend/src/components/Sidebar.tsx] — fixed bằng label trên avatar container và ẩn initial khỏi accessibility tree.
+- [x] [Review][Patch] Project Switcher button disabled styles [frontend/src/components/AppShell.css] — fixed bằng selector `:disabled` explicit, giữ visual placeholder không bị browser dim tùy ý.
+- [x] [Review][Patch] Accessibility Gaps ở Sidebar [frontend/src/components/Sidebar.tsx] — fixed bằng cách tránh nested navigation landmark và thêm accessible label cho Project Switcher placeholder.
 - [x] [Review][Defer] Thiếu Error Boundary bảo vệ ứng dụng khi xảy ra lỗi render ở Route [frontend/src/main.tsx:12-19] — deferred, pre-existing
 - [x] [Review][Defer] Cấu hình scroll container chưa tối ưu cho Sidebar [frontend/src/components/AppShell.css] — deferred, pre-existing
 - [x] [Review][Defer] Thiếu Code Splitting / Lazy Loading cho các Route component [frontend/src/App.tsx] — deferred, pre-existing
 
+### Review Finding Assessment — 2026-05-21
+
+| Finding | Phân loại | Quyết định | Lý do |
+|---|---|---|---|
+| Hardcode pixel value cho border-radius | Cần fix ngay | Fixed | Story yêu cầu dùng design token khi token tồn tại; `--radius-sm` đã có trong `tokens.css`. |
+| Sai lệch aria-label của avatar người dùng | Cần fix ngay | Fixed | Label cũ đặt trên `span` có visible text nên dễ bị đọc dư/sai; container avatar mới giữ semantic rõ hơn. |
+| Project Switcher button disabled styles | Cần fix ngay | Fixed | Disabled button có browser default opacity/color khác nhau; selector explicit giữ placeholder đúng visual contract. |
+| Accessibility Gaps ở Sidebar | Cần fix ngay | Fixed | Patch nhỏ, không đổi behavior; loại bỏ nested navigation landmark không cần thiết và bổ sung accessible label cho placeholder. |
+
 ---
 
 ## Dev Notes
diff --git a/frontend/src/components/AppShell.css b/frontend/src/components/AppShell.css
index 152eb24..139f4c7 100644
--- a/frontend/src/components/AppShell.css
+++ b/frontend/src/components/AppShell.css
@@ -65,7 +65,7 @@
   margin: var(--space-2) var(--space-3);
   height: 34px;
   padding: var(--space-2) var(--space-3);
-  border-radius: 6px; /* UX-DR9 project switcher radius */
+  border-radius: var(--radius-sm);
   border: 1px solid var(--border);
   background: var(--bg-card);
   color: var(--text-secondary);
@@ -73,7 +73,13 @@
   cursor: not-allowed;
   font-size: var(--font-size-body);
   line-height: var(--line-height-caption);
+}
+
+.app-sidebar__project-switcher:disabled {
   opacity: 1;
+  background: var(--bg-card);
+  color: var(--text-secondary);
+  cursor: not-allowed;
   -webkit-text-fill-color: var(--text-secondary);
 }
 
@@ -95,7 +101,7 @@
   align-items: center;
   height: 34px;
   padding: var(--space-2) var(--space-3);
-  border-radius: 6px; /* UX-DR9 nav item radius */
+  border-radius: var(--radius-sm);
   color: var(--text-primary);
   text-decoration: none;
   font-size: var(--font-size-body);
diff --git a/frontend/src/components/Sidebar.tsx b/frontend/src/components/Sidebar.tsx
index 55a9783..176b724 100644
--- a/frontend/src/components/Sidebar.tsx
+++ b/frontend/src/components/Sidebar.tsx
@@ -14,11 +14,12 @@ export default function Sidebar() {
         className="app-sidebar__project-switcher"
         data-testid="project-switcher-placeholder"
         disabled
+        aria-label="Default Project, coming in Story 2.1"
         title="Coming in Story 2.1"
       >
         Default Project ⌄
       </button>
-      <nav className="app-sidebar__nav">
+      <div className="app-sidebar__nav">
         <ul>
           <li>
             <NavLink to="/dashboard" className={itemClass}>
@@ -31,9 +32,14 @@ export default function Sidebar() {
             </NavLink>
           </li>
         </ul>
-      </nav>
-      <div className="app-sidebar__avatar" data-testid="user-avatar-placeholder">
-        <span className="app-sidebar__avatar-circle" aria-label="User avatar placeholder">
+      </div>
+      <div
+        className="app-sidebar__avatar"
+        data-testid="user-avatar-placeholder"
+        role="img"
+        aria-label="User avatar placeholder: L"
+      >
+        <span className="app-sidebar__avatar-circle" aria-hidden="true">
           L
         </span>
       </div>
```
