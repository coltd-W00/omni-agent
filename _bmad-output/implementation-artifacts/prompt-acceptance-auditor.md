# BMAD Code Review Prompt - Acceptance Auditor

Bạn đóng vai trò là **Acceptance Auditor** trong quy trình BMAD Code Review. Nhiệm vụ của bạn là đối chiếu code changes (diff) dưới đây với tài liệu đặc tả (Spec File) và ngữ cảnh dự án (Project Context) để đánh giá mức độ tuân thủ và hoàn thành mục tiêu.

## Vai trò & Nhiệm vụ:
Bạn là một Acceptance Auditor. Review diff dưới đây đối chiếu với spec và context docs. Kiểm tra xem:
- Có vi phạm Acceptance Criteria (AC) nào không?
- Có đi lệch khỏi ý định của đặc tả không?
- Có thiếu sót việc implement hành vi được chỉ định nào không?
- Có mâu thuẫn giữa ràng buộc đặc tả (spec constraints) và code thực tế không?

Trả về kết quả dưới dạng danh sách Markdown các phát hiện (findings). Mỗi phát hiện bao gồm:
- Tiêu đề ngắn gọn (1 dòng)
- AC hoặc ràng buộc bị vi phạm
- Bằng chứng từ diff (Evidence)

---

## 1. Diff đầu vào:
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

---

## 2. Spec File (1-4-appshell-layout-and-routing.md):
```markdown
# Story 1.4: AppShell Layout & Routing

**Epic:** 1 — Project Foundation & Infrastructure
**Story ID:** 1.4
**Story Key:** 1-4-appshell-layout-and-routing

### Acceptance Criteria
- AC-1 (TopBar layout): Given app load tại http://localhost:5173 / When inspect layout / Then TopBar render với height: 52px, full width, sticky (position: sticky; top: 0; z-index: 100), background: var(--bg-card), có border-bottom: 1px solid var(--border).
- AC-2 (Sidebar layout): Given app load / When inspect sidebar / Then Sidebar có width: 220px, fixed bên trái, background: var(--bg-card), border-right: 1px solid var(--border), full viewport height, scrollable khi nội dung dài.
- AC-3 (Main Work Area): Given app load / When inspect main area / Then Main Work Area flex-grow: 1, background: var(--bg-app), padding: 24px (var(--space-6)), scrollable independent với sidebar, min-width: 0 (cho phép children co lại).
- AC-4 (Sidebar contents — MVP subset của UX-DR9): Given sidebar đã render / When inspect contents / Then chứa các phần tử sau theo thứ tự từ trên xuống:
  - Header row (52px height, align với TopBar): text OmniAgent dùng color: var(--brand-primary), font-weight: 600.
  - Project Switcher placeholder (1 row 34px, padding 8px 12px, border-radius 6px): hiển thị text Default Project ⌄ không click được trong story này; có data-testid="project-switcher-placeholder". Story 2.1 sẽ thay bằng functional dropdown.
  - Nav items (mỗi item: <a> render qua NavLink của React Router, 34px height, padding 8px 12px, border-radius 6px):
    - Dashboard -> /dashboard
    - Board -> /board
  - User profile / avatar placeholder: hiển thị ở dưới cùng của sidebar (pinned bottom), hình tròn 32x32px, hiển thị chữ cái đầu của username của user hiện tại (ví dụ: "L" cho user "Loc"), hover có tooltip hoặc accessible text "User avatar placeholder". Có data-testid="user-avatar-placeholder".
- AC-5 (Client-side routing): Given user click vào NavLink Dashboard / When check URL / Then URL chuyển sang /dashboard, component DashboardRoute render.
- AC-6 (Active link state): Given user ở /dashboard / When inspect sidebar / Then NavLink Dashboard có text color var(--brand-primary) và background var(--bg-active), NavLink Board ở state mặc định.
- AC-7 (Catch-all route): Given user truy cập route không tồn tại / When page load / Then render NotFoundRoute component, hiển thị 404 error message và Link quay lại Dashboard.
- AC-8 (No re-mount AppShell): Given user chuyển hướng giữa các route / When inspect render / Then AppShell component (cùng Sidebar/TopBar) KHÔNG bị re-mount, chỉ phần nội dung trong Main Work Area được update.
```

---

## 3. Project Context:
- **TypeScript/React (Frontend):** TypeScript strict mode bắt buộc.
- **Naming:** React components: PascalCase cho tên file và component. CSS variables: kebab-case.
- **Design System (CSS variables):** Font stack: Inter, Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif. Bắt buộc dùng CSS variables đã định nghĩa, không hardcode hex.
```
