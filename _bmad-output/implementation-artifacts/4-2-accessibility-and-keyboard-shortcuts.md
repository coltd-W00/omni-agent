# Story 4.2: Accessibility & Keyboard Shortcuts

Status: ready-for-dev

<!-- Validation tùy chọn — chạy validate-create-story trước khi dev-story nếu muốn double-check. -->

**Epic:** 4 — Dashboard & Operational Visibility
**Story ID:** 4.2
**Story Key:** 4-2-accessibility-and-keyboard-shortcuts
**Lane:** normal — frontend-only, KHÔNG thêm public API contract mới, KHÔNG đổi DB schema. Toàn bộ thay đổi nằm ở React component layer + CSS tokens (đã có). Blast radius: 1 file mới `frontend/src/hooks/useKeyboardShortcuts.ts`, 1 hook `frontend/src/hooks/useFocusTrap.ts`, 1 component mới `frontend/src/components/SkipLink.tsx`, 1 component mới `frontend/src/features/search/SearchOverlay.tsx`, UPDATE 8 file hiện hữu để bổ sung focus-visible style + aria attributes (`AppShell.tsx`, `TopBar.tsx`, `TaskDetailPanel.tsx`, `CreateTaskModal.tsx`, `CreateProjectModal.tsx`, `ConfirmationDialog.tsx`, `CreateTaskModal.css`, `CreateProjectModal.css`). Risk flags: 2 (mounting global keyboard listener ở `AppShell`; thay đổi focus management trên modal đã có). **2 flags → normal.**

**Depends on:**
- Story 1.3 (Frontend Scaffold & Design Tokens) — phải hoàn thành (status `done`); story 4.2 reuse `--shadow-focus` token ở `frontend/src/styles/tokens.css` dòng 95.
- Story 1.4 (AppShell Layout & Routing) — phải hoàn thành (status `done`); story 4.2 mount Skip Link + global keyboard listener trong `AppShell.tsx`, thêm `id="main-content"` cho `<main>` đã có (dòng 15).
- Story 2.0 (Shared UI Components) — phải hoàn thành (status `done`); reuse `Button` + `--shadow-focus` đã wire qua `:focus-visible`.
- Story 2.1 (Project Management) — phải hoàn thành (status `done`); UPDATE `CreateProjectModal.tsx` thêm focus management (focus trap + return focus).
- Story 2.2 (Task CRUD & Agent Assignment) — phải hoàn thành (status `done`); UPDATE `CreateTaskModal.tsx` thêm focus trap + return focus + role="dialog" (hiện chỉ có `aria-modal` + `aria-labelledby`, thiếu explicit role).
- Story 2.4 (Task Detail Panel) — phải hoàn thành (status `done`); UPDATE `TaskDetailPanel.tsx` thêm focus trap inside panel + return focus về triggering element (hiện đã có Escape close + focus close button, nhưng chưa trap + chưa restore focus về element gốc).
- Story 4.1 (Morning Dashboard) — **bắt buộc done trước khi dev story 4.2** (status hiện `ready-for-dev`); story 4.2 reuse `useAggregatedTasks` hook (sẽ được tạo ở 4.1) cho `SearchOverlay` data source. Nếu 4.1 chưa done, dev agent phải HALT và yêu cầu hoàn thành 4.1 trước.

**Out of scope (defer to follow-up):**
- `RunTimeline` `aria-live="polite"` (AC-4 từ epics) — `RunTimeline` chưa được build (Story 3.5b `ready-for-dev`, chưa merged code). Yêu cầu này sẽ được Story 3.5b implement trực tiếp trong file mới `frontend/src/components/RunTimeline.tsx` khi nó được dev. Story 4.2 KHÔNG tạo placeholder cho RunTimeline. **Hành động:** Thêm note cứng trong Story 3.5b dev notes (nếu cần) — KHÔNG sửa Story 3.5b ở đây.
- Responsive layout shifts (drawer sidebar, full-width Detail Panel < 1024px) — defer Story 4.3 (Responsive Layout).
- Sidebar collapsed mode (≤1280px icon-only) — defer Story 4.3 (Responsive Layout). `Sidebar.tsx` dòng 1 đã có TODO cho 4.3.
- Search backend / fuzzy matching / debounced API call — defer cho đến khi có API endpoint chuyên dụng cho global search. Story 4.2 chỉ build **client-side filter** trên `useAggregatedTasks` data đã load (tasks + projects), match `title` / `id` / `project.name` qua `.toLowerCase().includes()`.
- Tooltip "Shortcut: ⌘K" trên hover 500ms (UX spec dòng 1754) — defer cho story tooltip dedicated. Story 4.2 chỉ wire keyboard handler + visible button trong placeholder Search box (nếu phù hợp).
- Mac-vs-Windows shortcut detection nâng cao (ngoài việc check `metaKey` OR `ctrlKey`) — Story 4.2 chỉ check cả 2 modifier theo pattern UX spec (`⌘K (or Ctrl+K)`). KHÔNG detect OS qua user agent.
- Reduced motion (`prefers-reduced-motion`) handling cho global animations — partial: Story 4.2 chỉ áp dụng cho focus ring transition (`transition: box-shadow`); animation Detail Panel slide-in + StatusBadge pulse đã là deferred concern cho UX/CSS refresh story sau.

---

## Story

As a developer using omni-agent,
I want the app to be fully keyboard navigable with proper accessibility attributes,
So that the app meets WCAG 2.1 AA standards and I can work efficiently without a mouse.

---

## Acceptance Criteria

> **Nguồn gốc AC:** `_bmad-output/planning-artifacts/epics.md` Story 4.2 (dòng 800–852) + Epic 4 framing (dòng 749–751) + UX-DR19 (dòng 123) + NFR-6 (dòng 58). `_bmad-output/planning-artifacts/ux-design-specification.md` §"Accessibility Strategy" (dòng 1820–1845), §"Accessibility Baseline (WCAG AA Practical)" (dòng 1451–1459), §"Keyboard shortcuts (progressive disclosure)" (dòng 1745–1754), §"Keyboard Shortcuts" interaction rules (dòng 994–1003), §"Implementation Guidelines" semantic HTML (dòng 1846–1859), §"Component Strategy" (dòng 1644, 1658). `_bmad-output/project-context.md` §"Critical Implementation Rules" → React/Layout rules. Conventions: kebab-case CSS variables, semantic HTML5 (`<main>`, `<section aria-labelledby>`, `<dialog>`), CSS `:focus-visible` + `--shadow-focus` token, `metaKey` OR `ctrlKey` cho cross-platform shortcut detection.

---

**AC-1 — Visible focus indicator trên mọi interactive element (UX-DR19, NFR-6):**

**Given** user tab qua bất kỳ interactive element nào (button, link, input, textarea, dialog close, NavLink, ProjectSwitcher trigger, TaskCard, etc.)
**When** element nhận keyboard focus
**Then** focus indicator visible: `:focus-visible` selector áp dụng `box-shadow: var(--shadow-focus)` (đã định nghĩa `0 0 0 3px rgba(79, 70, 229, 0.25)` ở `frontend/src/styles/tokens.css` dòng 95).

**And** `outline: none` KHÔNG bao giờ áp dụng mà KHÔNG kèm `:focus-visible` replacement với `--shadow-focus`. Audit toàn bộ CSS files dưới `frontend/src/`:

| File | Dòng có `outline: none` | Trạng thái sau 4.2 |
|---|---|---|
| `frontend/src/components/Button.css:19` | đã có `.app-button:focus-visible { box-shadow: var(--shadow-focus); }` (dòng 18–21) — **KHÔNG đụng** | OK |
| `frontend/src/features/detail/TaskDetailPanel.css:65, 186, 223` | đã có `:focus-visible` replacement | OK |
| `frontend/src/features/project/CreateProjectModal.css:46` | input có `outline: none` (dòng 46) + `:focus { border-color + box-shadow }` (dòng 51–53) — **KHÔNG đụng** (đã đúng) | OK |
| `frontend/src/components/CreateTaskModal.css:67` | input + textarea có `outline: none` (dòng 67) + `:focus { border-color }` (dòng 65–69) nhưng **THIẾU** `box-shadow: var(--shadow-focus)` → **UPDATE**: thêm `box-shadow: var(--shadow-focus);` vào block `.app-create-task-modal__input:focus, .app-create-task-modal__textarea:focus { ... }` | Sau 4.2: focus ring visible |

**And** focus ring hoạt động khi navigate bằng keyboard (Tab/Shift+Tab) — `:focus-visible` (NOT `:focus`) đảm bảo ring KHÔNG hiện khi click chuột vào input (UX nhất quán với pattern hiện hữu Button.css).

**Test verification:** Vitest test mount `<Button />` → simulate keyboard focus qua `userEvent.tab()` → assert computed style `box-shadow` non-empty. (jsdom có support `:focus-visible` từ jsdom v22+.)

---

**AC-2 — Focus trap inside Task Detail Panel + modal overlays (UX-DR19, NFR-6):**

**Given** Task Detail Panel mở (slide-in từ phải) HOẶC bất kỳ modal nào mở (CreateTaskModal, CreateProjectModal, ConfirmationDialog)
**When** user nhấn Tab khi đang ở element cuối cùng trong overlay
**Then** focus cycle về element đầu tiên trong overlay (Tab forward) hoặc element cuối cùng (Shift+Tab backward). Focus KHÔNG escape ra ngoài overlay.

**And** danh sách focusable elements được tính theo selector: `'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'`.

**And** custom hook `useFocusTrap(containerRef: RefObject<HTMLElement>, active: boolean): void` ở `frontend/src/hooks/useFocusTrap.ts`:
- Khi `active === true`: attach `keydown` listener vào container; nếu `e.key === "Tab"`, query focusables trong container, redirect focus theo Tab/Shift+Tab cycle.
- Khi `active === false` hoặc unmount: detach listener.
- KHÔNG dùng external library (KHÔNG add `focus-trap-react`).

**And** Áp dụng `useFocusTrap` vào:
- `TaskDetailPanel.tsx` — `containerRef` = `<aside>` element (dòng 179), `active = isOpen`.
- `CreateTaskModal.tsx` — native `<dialog>` đã có browser-level focus management khi gọi `showModal()` (browser tự trap focus). **KHÔNG cần** `useFocusTrap` cho dialog dùng native `showModal()`. Verify: test `userEvent.tab()` từ element cuối → element đầu trong jsdom. Nếu jsdom KHÔNG support → fallback bằng `useFocusTrap`.
- `CreateProjectModal.tsx` — tương tự CreateTaskModal: native `<dialog>` showModal(). **Verify** trong test, fallback `useFocusTrap` nếu cần.
- `ConfirmationDialog.tsx` — tương tự, native `<dialog>` showModal(). **Verify**.

**Strategy decision:** Native `<dialog>` element + `dialog.showModal()` **đã trap focus** theo HTML spec (Chrome 120+, Firefox 98+ supported per architecture dòng 1859). `TaskDetailPanel` dùng `<aside>` (KHÔNG phải `<dialog>` — vì nó là slide-in panel, KHÔNG modal-blocking) → BẮT BUỘC cần `useFocusTrap` manual.

**Test verification:** Mount `TaskDetailPanel` open → focus close button → `userEvent.tab()` qua toàn bộ tabs + content → assert focus quay lại close button (Tab cycle). Test `userEvent.tab({ shift: true })` từ close button → assert focus chuyển về element cuối cùng.

---

**AC-3 — Escape đóng overlay + return focus về triggering element (UX-DR19, UX spec dòng 1833, 984):**

**Given** Task Detail Panel HOẶC bất kỳ modal nào đang mở
**When** user nhấn `Escape`
**Then** overlay đóng (đã có Escape handler ở `TaskDetailPanel.tsx` dòng 142–147, `CreateTaskModal.tsx` dòng 69–79, `ConfirmationDialog.tsx` Escape listener tương tự).

**And** focus quay về element đã trigger việc mở overlay (gọi là "triggering element"). Implementation:
- Store `triggeringElementRef = useRef<HTMLElement | null>(null)` ở component level (HOẶC ở `TaskDetailContext` cho Task Detail Panel — vì context-managed).
- Khi `openTask()` được gọi qua context → store `document.activeElement` HTÍN trước khi setState. **Cần update `TaskDetailContext.tsx`**: thêm `openTask(task, project, triggeringElement?: HTMLElement)` với optional param. Nếu không provided → fallback `document.activeElement as HTMLElement | null`.
- Khi `closeTask()` được gọi → sau khi setState clear panel, `setTimeout(() => triggeringElementRef.current?.focus(), 0)` để focus về element gốc sau React commit.
- Pattern tương tự cho `CreateTaskModal.tsx` (triggering = "+ New Task" button trong `TopBar.tsx`) — store `document.activeElement` trước `setOpen(true)`, restore sau `onClose`. Implementation đơn giản: trong `TopBar.tsx` line `onClick={() => setOpen(true)}` → thêm `triggeringElementRef.current = e.currentTarget`.

**And** chỉ restore focus khi `triggeringElementRef.current?.isConnected` (tránh restore vào element đã bị unmount).

**Test verification:** Mount AppShell + Board route → `userEvent.click(taskCard)` → assert detail panel mở → `userEvent.keyboard("{Escape}")` → assert panel đóng AND assert `taskCard` element là `document.activeElement`.

---

**AC-4 — StatusBadge `aria-label="Status: {StatusName}"` (đã implement Story 2.0, verify regression):**

**Given** bất kỳ `<StatusBadge status="running" />` render
**When** screen reader navigate
**Then** badge có `aria-label="Status: Running"` (label PascalCase với khoảng trắng: "Needs Review", "Changes Requested", "Completed", "Failed", "Cancelled", "Draft", "Ready", "Assigned", "Paused").

**Status hiện tại:** Đã implement ở `frontend/src/components/StatusBadge.tsx` dòng 29: `aria-label={`Status: ${label}`}` với `label` lấy từ `STATUS_DISPLAY[status].label`. **KHÔNG đụng** file này.

**Hành động Story 4.2:** Thêm regression test `frontend/src/components/StatusBadge.test.tsx` (nếu chưa có test này) verify aria-label cho 3 status đại diện: `"running"` → `"Status: Running"`, `"needs-review"` → `"Status: Needs Review"`, `"failed"` → `"Status: Failed"`.

**(AC-4 từ epics: `aria-live="polite"` trên RunTimeline — DEFER Story 3.5b. KHÔNG implement ở 4.2.)**

---

**AC-5 — Modal `role="dialog"`, `aria-labelledby`, focus chuyển vào heading khi mở (UX-DR19, UX spec dòng 1842):**

**Given** một modal mở (CreateTaskModal / CreateProjectModal / ConfirmationDialog)
**When** modal render
**Then** root element có:
- `role="dialog"` (HOẶC sử dụng native `<dialog>` element — implicit role là `dialog`)
- `aria-modal="true"`
- `aria-labelledby` trỏ tới `id` của heading (đã có)

**Trạng thái hiện tại — audit:**

| Modal | role | aria-modal | aria-labelledby | Trạng thái 4.2 |
|---|---|---|---|---|
| `CreateTaskModal.tsx` (`<dialog>`) | implicit `dialog` | ✓ `aria-modal="true"` (dòng 134) | ✓ `aria-labelledby="create-task-heading"` (dòng 135) | OK — KHÔNG đụng |
| `CreateProjectModal.tsx` | ✓ `role="dialog"` (dòng 115) | ✓ `aria-modal="true"` (dòng 116) | ✓ `aria-labelledby="create-project-title"` (dòng 117) | OK — KHÔNG đụng |
| `ConfirmationDialog.tsx` (`<dialog>`) | implicit `dialog` | ✗ thiếu | ✓ `aria-labelledby={titleId}` | UPDATE: thêm `aria-modal="true"` (mặc dù `<dialog>` showModal() implicit, thêm để rõ ràng cho screen reader cũ) |

**And** focus chuyển vào heading h2 (KHÔNG phải first focusable button) khi modal mở:
- `useEffect(() => { if (open) headingRef.current?.focus(); }, [open]);`
- Heading element nhận `tabIndex={-1}` để programmatically focusable nhưng KHÔNG vào Tab order.
- Update `CreateTaskModal.tsx`, `CreateProjectModal.tsx`, `ConfirmationDialog.tsx` mỗi file thêm `headingRef` + focus heading on open.
- **Lưu ý:** `CreateTaskModal.tsx` input title có `autoFocus` (dòng 177). Thay đổi: bỏ `autoFocus`, focus heading trước, user nhấn Tab 1 lần để xuống input title. UX trade-off: chậm hơn 1 keystroke nhưng screen reader announce heading trước.
- **Hoặc** giữ `autoFocus` trên input title, KHÔNG focus heading — chấp nhận trade-off ngược lại. **Quyết định:** Giữ `autoFocus` trên CreateTaskModal vì user mở modal để TẠO task, expect input ngay. ConfirmationDialog + CreateProjectModal → focus heading (khác use case: confirm/create project ít urgent hơn). Document quyết định này trong PR description.

**Test verification:** Mount modal `open={true}` → assert active element là heading (cho CreateProjectModal + ConfirmationDialog) hoặc input title (cho CreateTaskModal).

---

**AC-6 — Icon-only buttons có descriptive `aria-label` (UX-DR19, UX spec dòng 1841):**

**Given** bất kỳ icon-only button nào (button chỉ có icon, KHÔNG có visible text)
**When** screen reader navigate
**Then** button có `aria-label` mô tả action.

**Trạng thái hiện tại — audit:**

| File / Dòng | Button | aria-label | Trạng thái 4.2 |
|---|---|---|---|
| `TaskDetailPanel.tsx:189-194` (close ✕) | close panel | ✓ `aria-label="Close task detail panel"` | OK |
| `TaskDetailPanel.tsx:119-126` ("Show ID" / "Hide ID" toggle) | có visible text — KHÔNG icon-only | N/A | OK |
| `ProjectSwitcher.tsx:147-149` (··· overflow menu trigger per project) | ✓ `aria-label={`More options for ${project.name}`}` | OK |
| `ProjectSwitcher.tsx:89` (main trigger button) | ✓ `aria-label={triggerLabel}` | OK |
| `Toast.tsx:92` (dismiss ×) | ✓ `aria-label="Dismiss notification"` | OK |
| `TopBar.tsx:15-25` ("+ New Task") | có visible text "+ New Task" — KHÔNG icon-only | N/A | OK |
| `Sidebar.tsx:34-36` (avatar circle "L") | KHÔNG là button — là `role="img"` với aria-label | OK |
| `CreateTaskModal.tsx` Cancel/Create | có text labels — N/A | OK |
| **`AppShell.tsx`** — sau khi thêm Skip Link (AC-7) | Skip Link là `<a>` với visible text "Skip to main content" | N/A | OK |
| **`SearchOverlay.tsx`** mới — close button + clear input button (nếu có) | bắt buộc thêm `aria-label="Close search"` / `aria-label="Clear search input"` nếu render | OK trong implementation |

**Hành động Story 4.2:** Audit pass — KHÔNG icon-only button nào hiện thiếu aria-label. **Bổ sung quy tắc trong AGENTS rule cho future stories** (out-of-scope cho 4.2 — chỉ làm verification).

**Test verification:** `frontend/src/components/__a11y_audit__.test.tsx` (file mới optional, hoặc inline test trong từng component test) — render component, query `button[aria-label]`, assert count match expected.

---

**AC-7 — Skip to main content link (UX-DR19, UX spec dòng 1835):**

**Given** dashboard / board page load
**When** user nhấn Tab lần đầu tiên (KHÔNG focus được vào input/element nào khác trước đó)
**Then** một `<a href="#main-content">` link render đầu trang với text "Skip to main content".

**And** link visually hidden theo CSS pattern WCAG (position absolute + clip + width:1px) **CHO ĐẾN KHI** nhận focus → expand thành visible button gắn top-left của viewport:
```css
.skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  z-index: 100;
  padding: var(--space-3) var(--space-4);
  background: var(--brand-primary);
  color: var(--text-inverse);
  border-radius: var(--radius-sm);
  font-weight: 600;
  text-decoration: none;
}
.skip-link:focus,
.skip-link:focus-visible {
  left: var(--space-3);
  top: var(--space-3);
  box-shadow: var(--shadow-focus);
}
```

**And** Skip Link click HOẶC Enter → focus chuyển vào `#main-content` (là `<main>` element trong `AppShell.tsx` dòng 15). Cập nhật `AppShell.tsx`:
```tsx
<main id="main-content" tabIndex={-1} className="app-shell__main" role="main">
  <Outlet />
</main>
```

**And** Skip Link là **first child** của `<body>` (hoặc của `<div className="app-shell">` — DOM order trước TopBar/Sidebar/Main).

**Component:** `frontend/src/components/SkipLink.tsx`:
```tsx
import "./SkipLink.css";

export default function SkipLink() {
  return (
    <a href="#main-content" className="skip-link" data-testid="skip-link">
      Skip to main content
    </a>
  );
}
```

**UPDATE `AppShell.tsx`:** Render `<SkipLink />` đầu tiên trước `<TopBar />`.

**Test verification:** Mount `AppShell` → `userEvent.tab()` → assert focus là Skip Link element → assert link visible (computed style `left` ≠ `-9999px`).

---

**AC-8 — `⌘K` / `Ctrl+K` mở Search overlay (UX-DR19, UX spec dòng 998, 1749):**

**Given** app load, user KHÔNG focus trong input / textarea
**When** user nhấn `⌘K` (Mac) hoặc `Ctrl+K` (Windows/Linux)
**Then** Search overlay mở (centered dialog, 480px width, 60vh max-height).

**And** Search overlay component `frontend/src/features/search/SearchOverlay.tsx`:
- Native `<dialog>` element với `showModal()` (cùng pattern `CreateTaskModal`).
- Header: input text `[Search tasks, agents, sessions…]` width 100%, autoFocus.
- Content: filtered list từ `useAggregatedTasks()` (Story 4.1 hook). Filter logic:
  - Match `task.title.toLowerCase().includes(query.toLowerCase())`
  - Match `task.id.toLowerCase().includes(query.toLowerCase())`
  - Match `task.project.name.toLowerCase().includes(query.toLowerCase())`
  - Combine với OR, limit top 10 results sorted by `updatedAt` desc.
- Empty query (query.trim() === "") → hiển thị 5 task gần nhất (sorted by updatedAt desc).
- Empty results → render `<EmptyState heading="No matches for '{query}'" description="Try checking the spelling or search with different keywords." />` (variant=`"inline"`).
- Click vào result row → `openTask(task, task.project)` qua `useTaskDetail()` + đóng overlay.
- Escape → đóng overlay (native dialog behavior).
- Backdrop click → đóng overlay.

**And** keyboard navigation trong list: ArrowDown / ArrowUp chuyển highlight (selected index state), Enter → activate currently highlighted result. Selected row visual indicator: `--bg-hover` background + `box-shadow: var(--shadow-focus)`.

**And** chỉ KHÔNG mở overlay nếu user đang focus vào `<input>`, `<textarea>`, hoặc element có `contenteditable="true"` (tránh hijack ⌘K khi user đang gõ trong CreateTaskModal title field). Check trong handler:
```ts
const target = e.target as HTMLElement;
if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
```

**And** keyboard listener register ở `useKeyboardShortcuts` hook mount trong `AppShell.tsx` (global scope qua `document.addEventListener("keydown", ...)`).

**Test verification:** Mount AppShell → `userEvent.keyboard("{Meta>}k{/Meta}")` → assert overlay mở (query by `data-testid="search-overlay"`). Type "review" → assert filtered results. ArrowDown twice → Enter → assert `openTask` được gọi với correct task.

---

**AC-9 — `⌘N` / `Ctrl+N` mở New Task modal (UX-DR19, UX spec dòng 999, 1750):**

**Given** app load, user KHÔNG focus trong input / textarea, AND có active project (`activeProjectId !== null`)
**When** user nhấn `⌘N` (Mac) hoặc `Ctrl+N` (Windows/Linux)
**Then** CreateTaskModal mở.

**And** nếu KHÔNG có active project (`activeProjectId === null`) → KHÔNG mở modal; show toast warning `"Select a project first"` (tone: `"warning"` hoặc `"error"`). Lý do: CreateTaskModal yêu cầu `projectId` (`CreateTaskModal.tsx:12-15`).

**And** keyboard listener check focus context (same logic AC-8): skip nếu focus đang trong input/textarea.

**Implementation:**
- Thêm `useKeyboardShortcuts` hook expose callback `onNewTask: () => void`.
- `TopBar.tsx` lift state lên hoặc dùng custom event/context: state `open` cho CreateTaskModal hiện ở `TopBar.tsx:8`. Để keyboard handler ở `AppShell` trigger CreateTaskModal mở từ `TopBar` → cần dispatch mechanism.
- **Pattern chọn:** Thêm `NewTaskModalContext` mới ở `frontend/src/contexts/NewTaskModalContext.tsx`:
  ```tsx
  interface NewTaskModalContextValue {
    open: boolean;
    openModal: () => void;  // có thể được gọi từ keyboard shortcut HOẶC TopBar button
    closeModal: () => void;
  }
  ```
- Mount `NewTaskModalProvider` trong `AppShell.tsx` bao quanh `<TopBar />` + `<Outlet />`.
- `TopBar.tsx` lấy `openModal` qua context thay vì local `setOpen(true)`. CreateTaskModal cũng được mount trong `AppShell` (hoặc giữ trong `TopBar` — nhưng tốt hơn move lên `AppShell` cho consistency).
- `useKeyboardShortcuts` gọi `openModal()` khi handle ⌘N.

**Test verification:** Mount AppShell + project context với activeProjectId → `userEvent.keyboard("{Meta>}n{/Meta}")` → assert CreateTaskModal render (`screen.getByRole("dialog", { name: /create task/i })`). Test với `activeProjectId = null` → assert toast warning hiển thị, modal KHÔNG mở.

---

**AC-10 — `R` triggers Resume Session khi Task Detail Panel mở + status cho phép (UX-DR19, UX spec dòng 1003, 1751):**

**Given** Task Detail Panel mở với task ở status `paused` HOẶC `failed`
**When** user nhấn `R` (KHÔNG modifier, KHÔNG focus trong input/textarea)
**Then** Resume Session button trong `ActionBar` được trigger (programmatic click).

**Implementation:**
- Resume button hiện ở `TaskDetailPanel.tsx:71`: `<Button variant="primary" size="md">Resume Session</Button>` — **THIẾU `onClick` + `data-testid`**.
- UPDATE `TaskDetailPanel.tsx` ActionBar:
  - Thêm `data-action="resume-session"` vào Resume button: `<Button variant="primary" size="md" data-action="resume-session">Resume Session</Button>`. **KHÔNG đụng onClick** — onClick wiring là scope của Story 3.3 (Resume Session implementation, status `ready-for-dev`).
- `useKeyboardShortcuts` handle `R` key (case-insensitive):
  ```ts
  if (e.key.toLowerCase() === "r" && !e.metaKey && !e.ctrlKey && !isInputFocused(e.target)) {
    const resumeBtn = document.querySelector<HTMLButtonElement>('[data-action="resume-session"]:not([disabled])');
    resumeBtn?.click();
  }
  ```
- KHÔNG cần check task status — nếu task status KHÔNG resumable, `ActionBar` KHÔNG render Resume button (xem `TaskDetailPanel.tsx:54-77` — chỉ render khi status === `assigned` / `paused` / `failed`). Selector `:not([disabled])` đảm bảo skip disabled button.
- KHÔNG cần check Task Detail Panel mở — nếu panel đóng, button KHÔNG ở DOM.

**Edge case:** Story 3.3 chưa merge → Resume button click KHÔNG có handler → click là no-op. Đây là expected: AC-10 chỉ require "Resume Session is triggered" — click event dispatch là trigger, even nếu downstream handler chưa wire.

**Test verification:** Mount AppShell + open Task Detail Panel với task status=paused → `userEvent.keyboard("r")` → assert Resume button click event được dispatch (mock onClick prop, assert called once). Test với task status=`completed` → assert Resume button KHÔNG render → keyboard R = no-op.

---

**AC-11 — Color contrast ≥ 4.5:1 (text normal) AND ≥ 3:1 (text large) — verify đã đạt (UX-DR19, NFR-6, UX spec dòng 1825):**

**Given** mọi token color trong `frontend/src/styles/tokens.css` được dùng cho text + background
**When** kiểm tra contrast ratio
**Then** đạt WCAG AA:
- `--text-primary #111827` trên `--bg-app #F4F5F7` → 16.1:1 ✓
- `--text-primary #111827` trên `--bg-card #FFFFFF` → 17.1:1 ✓
- `--text-secondary #6B7280` trên `--bg-card #FFFFFF` → 4.7:1 ✓
- `--brand-primary #4F46E5` trên `--bg-card #FFFFFF` → 7.0:1 ✓
- Status text colors (đã verified ở UX spec dòng 1825 "Indigo #4F46E5 trên white verified")

**Hành động Story 4.2:**
1. **KHÔNG thay đổi token values.**
2. Tạo doc reference (optional, nếu chưa có): `_bmad-output/planning-artifacts/contrast-audit.md` — Markdown table với computed contrast ratios cho 9 status color pairs. **Defer nếu không có** — UX spec đã claim verification ở dòng 1825.
3. Audit code: tìm `grep -rn "#[0-9A-Fa-f]\{3,8\}" frontend/src --include="*.css" --include="*.tsx"`. Bất kỳ hex hardcode nào (ngoài tokens.css) → flag thành dev note trong PR description nhưng KHÔNG fix trong scope 4.2 nếu KHÔNG là blocking violation.

**Test verification:** N/A (visual/manual). Có thể thêm runtime test snapshot computed style `color` + `background-color` của StatusBadge cho mỗi status, verify match expected token value (không phải hardcoded hex). Optional task.

---

## Tasks / Subtasks

> **Quy ước:** Mỗi task root checkable. Subtasks indented. Tasks chia 6 nhóm: **A** (Hooks: keyboard shortcut + focus trap), **B** (Skip Link), **C** (Search Overlay), **D** (Modal focus management updates), **E** (TaskDetailPanel focus trap + restore), **F** (NewTaskModalContext refactor + ⌘N wiring), **G** (Tests + verification).

### A. Hooks: keyboard shortcuts + focus trap

- [ ] **Task A.1 — Tạo `frontend/src/hooks/useKeyboardShortcuts.ts`** (AC: 8, 9, 10)
  - [ ] A.1.1 Export interface `KeyboardShortcutHandlers`:
    ```ts
    export interface KeyboardShortcutHandlers {
      onSearch: () => void;       // ⌘K / Ctrl+K
      onNewTask: () => void;      // ⌘N / Ctrl+N
      // onResume: KHÔNG truyền vào — handler tự query DOM cho [data-action="resume-session"]
    }
    ```
  - [ ] A.1.2 Export hook `useKeyboardShortcuts(handlers: KeyboardShortcutHandlers): void`:
    ```ts
    export function useKeyboardShortcuts({ onSearch, onNewTask }: KeyboardShortcutHandlers): void {
      useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
          if (isEditableElement(e.target)) return;
          const isMeta = e.metaKey || e.ctrlKey;
          if (isMeta && e.key.toLowerCase() === "k") {
            e.preventDefault();
            onSearch();
            return;
          }
          if (isMeta && e.key.toLowerCase() === "n") {
            e.preventDefault();
            onNewTask();
            return;
          }
          if (!isMeta && e.key.toLowerCase() === "r") {
            const btn = document.querySelector<HTMLButtonElement>('[data-action="resume-session"]:not([disabled])');
            if (btn) {
              e.preventDefault();
              btn.click();
            }
            return;
          }
        }
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
      }, [onSearch, onNewTask]);
    }
    ```
  - [ ] A.1.3 Helper `isEditableElement(target: EventTarget | null): boolean` (export named):
    ```ts
    export function isEditableElement(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
    }
    ```
  - [ ] A.1.4 `e.preventDefault()` cho ⌘K + ⌘N (block browser default — ⌘K nhiều browser dùng cho search, ⌘N cho new window). `R` chỉ preventDefault khi resume button tồn tại.
  - [ ] A.1.5 KHÔNG dependencies array có giá trị thay đổi — `onSearch` + `onNewTask` từ context phải stable (wrap qua `useCallback` ở caller).

- [ ] **Task A.2 — Tạo `frontend/src/hooks/useFocusTrap.ts`** (AC: 2)
  - [ ] A.2.1 Export hook `useFocusTrap(containerRef: RefObject<HTMLElement>, active: boolean): void`:
    ```ts
    const FOCUSABLE_SELECTOR =
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    export function useFocusTrap(containerRef: RefObject<HTMLElement>, active: boolean): void {
      useEffect(() => {
        if (!active) return;
        const container = containerRef.current;
        if (!container) return;
        function handleKeyDown(e: KeyboardEvent) {
          if (e.key !== "Tab") return;
          const focusables = Array.from(container!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
            .filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
          if (focusables.length === 0) return;
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
        container.addEventListener("keydown", handleKeyDown);
        return () => container.removeEventListener("keydown", handleKeyDown);
      }, [active, containerRef]);
    }
    ```
  - [ ] A.2.2 Sử dụng `el.offsetParent !== null` để skip hidden elements (CSS display:none). KHÔNG dùng `getComputedStyle` (chậm).
  - [ ] A.2.3 KHÔNG attempt focus restoration trong hook — đó là responsibility của caller (xem Task E.2 cho TaskDetailPanel).
  - [ ] A.2.4 KHÔNG add npm dependency — pure utility hook.

### B. Skip Link

- [ ] **Task B.1 — Tạo `frontend/src/components/SkipLink.tsx` + `SkipLink.css`** (AC: 7)
  - [ ] B.1.1 Component:
    ```tsx
    import "./SkipLink.css";

    export default function SkipLink() {
      return (
        <a href="#main-content" className="skip-link" data-testid="skip-link">
          Skip to main content
        </a>
      );
    }
    ```
  - [ ] B.1.2 CSS pattern WCAG visually-hidden + focus expand (xem AC-7 CSS block). Sử dụng `--brand-primary`, `--text-inverse`, `--space-3`, `--space-4`, `--radius-sm`, `--shadow-focus` — KHÔNG hardcode.
  - [ ] B.1.3 z-index cao (`100`) để overlay trên TopBar (đã sticky).

- [ ] **Task B.2 — UPDATE `frontend/src/components/AppShell.tsx`** (AC: 7)
  - [ ] B.2.1 Import `SkipLink`.
  - [ ] B.2.2 Render `<SkipLink />` đầu tiên trước `<TopBar />` trong `<div className="app-shell">`.
  - [ ] B.2.3 Thêm `id="main-content"` + `tabIndex={-1}` vào `<main>`:
    ```tsx
    <main id="main-content" tabIndex={-1} className="app-shell__main" role="main">
      <Outlet />
    </main>
    ```
  - [ ] B.2.4 KHÔNG đụng `<TaskDetailProvider>` wrapping.

### C. Search Overlay

- [ ] **Task C.1 — Tạo `frontend/src/features/search/SearchOverlay.tsx` + `SearchOverlay.css`** (AC: 8)
  - [ ] C.1.1 Props:
    ```ts
    interface SearchOverlayProps {
      open: boolean;
      onClose: () => void;
    }
    ```
  - [ ] C.1.2 State internal:
    - `query: string` — input value.
    - `selectedIndex: number` — highlighted result index (-1 nếu không có).
  - [ ] C.1.3 Data source: `const { tasks } = useAggregatedTasks();` từ Story 4.1 hook. **Story 4.1 phải done trước.**
  - [ ] C.1.4 Filter logic (memoized):
    ```ts
    const results = useMemo<Array<Task & { project: Project }>>(() => {
      const q = query.trim().toLowerCase();
      if (q === "") {
        return [...tasks].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)).slice(0, 5);
      }
      return tasks
        .filter((t) =>
          t.title.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q) ||
          t.project.name.toLowerCase().includes(q)
        )
        .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
        .slice(0, 10);
    }, [tasks, query]);
    ```
  - [ ] C.1.5 Render — `<dialog ref={dialogRef} className="app-search-overlay" aria-modal="true" aria-labelledby="search-heading">`:
    - Heading h2 `id="search-heading"` text "Search" (visually-hidden, screen reader only).
    - Input `type="search"` `autoFocus`, value bound, placeholder "Search tasks, agents, sessions…", `aria-label="Search tasks"`.
    - Result list `<ul role="listbox">` với `<li role="option">` per item. Selected item: `aria-selected="true"`, class `app-search-overlay__result--selected`, `box-shadow: var(--shadow-focus)`.
    - Empty results → `<EmptyState variant="inline" icon="🔍" heading={`No matches for "${query}"`} description="Try checking the spelling or search with different keywords." />`.
  - [ ] C.1.6 Keyboard navigation handler trong input:
    ```ts
    function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && selectedIndex >= 0 && results[selectedIndex]) {
        e.preventDefault();
        handleSelectResult(results[selectedIndex]);
      }
    }
    ```
  - [ ] C.1.7 `handleSelectResult(item)`:
    ```ts
    const { openTask } = useTaskDetail();
    function handleSelectResult(item: Task & { project: Project }) {
      openTask(item, item.project);
      onClose();
    }
    ```
  - [ ] C.1.8 useEffect sync `open` prop ↔ `dialog.showModal()` / `dialog.close()` (pattern giống CreateTaskModal `frontend/src/components/CreateTaskModal.tsx:37-46`).
  - [ ] C.1.9 useEffect dialog `close` event → `onClose()` (Escape + backdrop click qua `<dialog>`).
  - [ ] C.1.10 useEffect reset `query` + `selectedIndex` khi `open` chuyển từ false → true.
  - [ ] C.1.11 `useEffect` reset `selectedIndex = 0` khi `results.length > 0`, `-1` khi `results.length === 0`.
  - [ ] C.1.12 CSS:
    - Native `<dialog>` `::backdrop` background rgba black 50%.
    - `.app-search-overlay`: width 480px, max-width 90vw, max-height 60vh, padding `var(--space-4)`, background `var(--bg-card)`, border-radius `var(--radius-md)`, box-shadow `var(--shadow-lg)` (nếu token tồn tại) hoặc `0 10px 30px rgba(0,0,0,0.15)`.
    - `.app-search-overlay__result`: padding `var(--space-2) var(--space-3)`, border-radius `var(--radius-sm)`, cursor pointer.
    - `.app-search-overlay__result--selected`: background `var(--bg-hover)`, box-shadow `var(--shadow-focus)`.
  - [ ] C.1.13 Wrap render qua `ReactDOM.createPortal(dialog, document.body)` (giống CreateTaskModal:283).

- [ ] **Task C.2 — Tạo `frontend/src/contexts/SearchOverlayContext.tsx`** (AC: 8)
  - [ ] C.2.1 Context expose `{ open: boolean; openOverlay: () => void; closeOverlay: () => void }`.
  - [ ] C.2.2 Provider mount trong `AppShell.tsx` bao quanh phần body (cùng level với `TaskDetailProvider`).
  - [ ] C.2.3 Hook `useSearchOverlay()` throws nếu không có provider — pattern giống `useTaskDetail()`.

- [ ] **Task C.3 — UPDATE `AppShell.tsx`** mount `SearchOverlay` (AC: 8)
  - [ ] C.3.1 Mount `<SearchOverlay open={searchOpen} onClose={closeOverlay} />` inside `SearchOverlayProvider`.
  - [ ] C.3.2 Pattern tham khảo `TaskDetailPanel` mounted trong `AppShell` (dòng 19): mount overlay ở app-shell root, KHÔNG mount trong route component.

### D. Modal focus management updates

- [ ] **Task D.1 — UPDATE `frontend/src/components/CreateTaskModal.css`** (AC: 1)
  - [ ] D.1.1 Block `.app-create-task-modal__input:focus, .app-create-task-modal__textarea:focus` (dòng 65–69 hiện tại) thêm property `box-shadow: var(--shadow-focus);`. Tổng cộng:
    ```css
    .app-create-task-modal__input:focus,
    .app-create-task-modal__textarea:focus {
      outline: none;
      border-color: var(--brand-primary);
      box-shadow: var(--shadow-focus);
    }
    ```
  - [ ] D.1.2 KHÔNG đụng các block khác.

- [ ] **Task D.2 — UPDATE `frontend/src/components/ConfirmationDialog.tsx`** (AC: 5)
  - [ ] D.2.1 Thêm `aria-modal="true"` vào `<dialog>` element (dòng ~ trong file, sau `aria-labelledby={titleId}`).
  - [ ] D.2.2 Thêm `headingRef = useRef<HTMLHeadingElement>(null)`. Heading h2 nhận `ref={headingRef}` + `tabIndex={-1}`.
  - [ ] D.2.3 `useEffect(() => { if (open) headingRef.current?.focus(); }, [open]);`
  - [ ] D.2.4 KHÔNG đụng Cancel/Confirm button order hoặc Esc handler.

- [ ] **Task D.3 — UPDATE `frontend/src/features/project/CreateProjectModal.tsx`** (AC: 5, 3)
  - [ ] D.3.1 Thêm `headingRef` + focus heading on open (cùng pattern D.2.2 + D.2.3).
  - [ ] D.3.2 Lưu `triggeringElementRef = useRef<HTMLElement | null>(null)`. Khi modal `open` prop chuyển từ false → true, capture `document.activeElement` (qua useEffect).
  - [ ] D.3.3 Khi modal đóng (qua `useEffect` deps `[open]` chạy lần kế tiếp), nếu `triggeringElementRef.current?.isConnected` → `setTimeout(() => triggeringElementRef.current?.focus(), 0)`.
  - [ ] D.3.4 Pattern tách thành utility hook `useFocusRestoration(active: boolean): void` trong `frontend/src/hooks/useFocusRestoration.ts` để reuse cho CreateTaskModal + ConfirmationDialog + SearchOverlay sau. Optional refactor — nếu over-engineer, inline trong từng modal.
  - [ ] D.3.5 KHÔNG đụng existing Escape handler hoặc dialog showModal logic.

- [ ] **Task D.4 — UPDATE `frontend/src/components/CreateTaskModal.tsx`** (AC: 3, 5)
  - [ ] D.4.1 Focus restoration logic giống D.3.2–D.3.3 (capture `document.activeElement` on open, restore on close).
  - [ ] D.4.2 Giữ `autoFocus` trên input title (quyết định AC-5: input urgent hơn heading cho create modal). KHÔNG thêm `headingRef` focus.
  - [ ] D.4.3 KHÔNG đụng `aria-modal`, `aria-labelledby` (đã có).

### E. TaskDetailPanel focus trap + restore

- [ ] **Task E.1 — UPDATE `frontend/src/contexts/TaskDetailContext.tsx`** (AC: 3)
  - [ ] E.1.1 Mở rộng `openTask` signature: `openTask: (task: Task, project: Project, triggeringElement?: HTMLElement) => void`.
  - [ ] E.1.2 Thêm internal state `triggeringElement: HTMLElement | null` trong `TaskDetailState`.
  - [ ] E.1.3 `openTask` mặc định: nếu `triggeringElement` undefined → fallback `document.activeElement instanceof HTMLElement ? document.activeElement : null`.
  - [ ] E.1.4 `closeTask` mặc định: sau khi `setState({ task: null, project: null, triggeringElement: null })`, schedule `setTimeout(() => element?.isConnected && element.focus(), 0)`.
  - [ ] E.1.5 Expose `triggeringElement` qua context value? KHÔNG cần — `closeTask` đã handle restoration internally.
  - [ ] E.1.6 KHÔNG đụng `selectedTask`/`selectedProject` API surface (backward-compat).
  - [ ] E.1.7 **Update callers nếu cần:** `TaskBoard.tsx:134` `onClick={() => openTask(t, activeProject)}` → giữ nguyên (fallback `document.activeElement` đảm bảo TaskCard là triggering element vì user vừa click vào nó). Test verify behavior trong jsdom.

- [ ] **Task E.2 — UPDATE `frontend/src/features/detail/TaskDetailPanel.tsx`** (AC: 2, 10)
  - [ ] E.2.1 Import `useFocusTrap` từ `../../hooks/useFocusTrap`.
  - [ ] E.2.2 `const panelRef = useRef<HTMLElement>(null);` — ref trên `<aside>` element.
  - [ ] E.2.3 `useFocusTrap(panelRef, isOpen);` — gọi sau existing useEffects.
  - [ ] E.2.4 Update `<aside ref={panelRef} ...>` — KHÔNG đụng existing aria-label/role.
  - [ ] E.2.5 ActionBar Resume button (dòng 71): thêm `data-action="resume-session"`:
    ```tsx
    <Button variant="primary" size="md" data-action="resume-session">Resume Session</Button>
    ```
  - [ ] E.2.6 KHÔNG đụng existing Escape handler (dòng 142–147) hoặc close button focus (dòng 150–154).
  - [ ] E.2.7 KHÔNG add new onClick cho Resume — đó là scope Story 3.3.

### F. NewTaskModal context + ⌘N wiring

- [ ] **Task F.1 — Tạo `frontend/src/contexts/NewTaskModalContext.tsx`** (AC: 9)
  - [ ] F.1.1 Interface:
    ```ts
    interface NewTaskModalContextValue {
      open: boolean;
      openModal: () => void;
      closeModal: () => void;
    }
    ```
  - [ ] F.1.2 Provider tương tự `TaskDetailProvider`. Hook `useNewTaskModal()` throws nếu không có provider.
  - [ ] F.1.3 KHÔNG manage `projectId` ở context — projectId vẫn lấy từ `useActiveProjectId()` ở `TopBar` HOẶC ở modal mount point.

- [ ] **Task F.2 — UPDATE `AppShell.tsx`** wire keyboard shortcuts + NewTaskModal mount (AC: 8, 9, 10)
  - [ ] F.2.1 Import `useKeyboardShortcuts`, `useSearchOverlay`, `useNewTaskModal`, `useActiveProjectId`, `useToast`, `CreateTaskModal`.
  - [ ] F.2.2 Wrap order: `<TaskDetailProvider><SearchOverlayProvider><NewTaskModalProvider><AppShellInner /></NewTaskModalProvider></SearchOverlayProvider></TaskDetailProvider>`. Tạo inner component `AppShellInner` để có thể call context hooks (Providers phải bọc ngoài consumers).
  - [ ] F.2.3 Trong `AppShellInner`:
    ```tsx
    const { openOverlay } = useSearchOverlay();
    const { openModal, open: newTaskOpen, closeModal } = useNewTaskModal();
    const activeProjectId = useActiveProjectId();
    const { showToast } = useToast();

    const handleNewTask = useCallback(() => {
      if (activeProjectId === null) {
        showToast({ tone: "error", message: "Select a project first" });
        return;
      }
      openModal();
    }, [activeProjectId, openModal, showToast]);

    useKeyboardShortcuts({ onSearch: openOverlay, onNewTask: handleNewTask });
    ```
  - [ ] F.2.4 Mount `<CreateTaskModal open={newTaskOpen} projectId={activeProjectId} onClose={closeModal} />` ở app-shell root, after `<TaskDetailPanel />`.
  - [ ] F.2.5 `<SearchOverlay open={searchOpen} onClose={closeOverlay} />` mount tương tự.

- [ ] **Task F.3 — UPDATE `frontend/src/components/TopBar.tsx`** (AC: 9)
  - [ ] F.3.1 Bỏ local `useState<boolean>` cho modal open (dòng 8).
  - [ ] F.3.2 Bỏ import `CreateTaskModal` (đã mount ở AppShell).
  - [ ] F.3.3 Replace `onClick={() => setOpen(true)}` bằng `onClick={() => openModal()}` qua `useNewTaskModal()` hook.
  - [ ] F.3.4 Disabled logic `!activeProjectId` giữ nguyên (UI feedback cho user — KHÔNG dùng toast pattern cho button click; toast chỉ cho keyboard shortcut path).

### G. Tests + verification

- [ ] **Task G.1 — Test `frontend/src/hooks/useKeyboardShortcuts.test.tsx`** (AC: 8, 9, 10)
  - [ ] G.1.1 Mount test component dùng hook + render hidden buttons với spies (`onSearch`, `onNewTask`).
  - [ ] G.1.2 Test cases:
    - ⌘K → onSearch called.
    - Ctrl+K → onSearch called.
    - ⌘N → onNewTask called.
    - K alone (no modifier) → no call.
    - ⌘K khi `document.activeElement` là input → no call.
    - R + có `[data-action="resume-session"]` button trong DOM → button click event dispatched (mock onClick, assert called).
    - R + `data-action="resume-session"` button disabled → no click.
    - R + không có button → no error, no call.
    - R khi input focused → no action.
  - [ ] G.1.3 Cleanup listener khi unmount (test re-render unmount, dispatch keydown, assert no call).

- [ ] **Task G.2 — Test `frontend/src/hooks/useFocusTrap.test.tsx`** (AC: 2)
  - [ ] G.2.1 Mount container với 3 buttons + 1 input → activate trap → focus last button → Tab → focus first button.
  - [ ] G.2.2 Shift+Tab từ first → focus last.
  - [ ] G.2.3 `active={false}` → Tab thoát ra ngoài container (no trap).
  - [ ] G.2.4 Empty container (no focusables) → no error.

- [ ] **Task G.3 — Test `frontend/src/components/SkipLink.test.tsx`** (AC: 7)
  - [ ] G.3.1 Render SkipLink → query by testid → assert `href="#main-content"`, text "Skip to main content".
  - [ ] G.3.2 Render trong `AppShell` (integration) → `userEvent.tab()` → assert SkipLink là `document.activeElement`.
  - [ ] G.3.3 Click SkipLink → assert `document.activeElement` là `<main id="main-content">` (cần jsdom support for hash navigation + tabIndex=-1 focus).

- [ ] **Task G.4 — Test `frontend/src/features/search/SearchOverlay.test.tsx`** (AC: 8)
  - [ ] G.4.1 Mock `useAggregatedTasks` returning array of test tasks.
  - [ ] G.4.2 Render `<SearchOverlay open={true} onClose={vi.fn()} />` trong test harness (with TaskDetailProvider).
  - [ ] G.4.3 Test cases:
    - Empty query → render top 5 recent tasks.
    - Type "review" → filter to tasks with title/id matching.
    - ArrowDown twice → selected index = 1.
    - Enter on selected → openTask called with correct args.
    - Escape → onClose called.
    - Empty results → EmptyState rendered.
  - [ ] G.4.4 Async: type query through userEvent.type, await render update.

- [ ] **Task G.5 — Test `frontend/src/features/detail/TaskDetailPanel.test.tsx`** UPDATE (AC: 2, 3, 10)
  - [ ] G.5.1 Bổ sung test focus trap: render panel mở → focus close button → tab qua tabs → assert focus cycle back to close button.
  - [ ] G.5.2 Bổ sung test focus restoration: render Board → click TaskCard → press Escape → assert TaskCard nhận focus.
  - [ ] G.5.3 Test Resume button có `data-action="resume-session"`: render panel với task status=paused → query `[data-action="resume-session"]` → assert exists.
  - [ ] G.5.4 KHÔNG đụng existing tests (chỉ append).

- [ ] **Task G.6 — Test `frontend/src/components/CreateTaskModal.test.tsx`** UPDATE nếu file tồn tại; nếu chưa, defer (AC: 1, 3, 5)
  - [ ] G.6.1 Verify focus restoration sau onClose. Render TopBar → click "+ New Task" → wait modal open → press Escape → assert "+ New Task" button regains focus.
  - [ ] G.6.2 Verify input focus ring: focus title input → assert computed `box-shadow` non-empty (jsdom có support `:focus` style computation từ jsdom v22; nếu jsdom KHÔNG support `:focus-visible`, skip + add comment).

- [ ] **Task G.7 — Integration smoke test `frontend/src/App.test.tsx`** (optional, defer nếu chưa có App-level test)
  - [ ] G.7.1 Render full app với providers → press ⌘K → assert search overlay render.
  - [ ] G.7.2 Render full app + activeProjectId → press ⌘N → assert CreateTaskModal render.

- [ ] **Task G.8 — Manual verification checklist** (paste vào PR description khi tạo PR)
  - [ ] G.8.1 Tab navigation: Sidebar → TopBar → Main → Detail Panel theo UX spec dòng 1831.
  - [ ] G.8.2 SkipLink visible khi Tab đầu tiên, expand top-left, click → focus `<main>`.
  - [ ] G.8.3 Mở Task Detail Panel → Tab qua close/tabs/buttons → cycle correctly.
  - [ ] G.8.4 Escape đóng panel → focus về TaskCard trigger.
  - [ ] G.8.5 ⌘K mở SearchOverlay → type → ArrowDown → Enter → mở task.
  - [ ] G.8.6 ⌘N (có project active) → mở CreateTaskModal → focus input title.
  - [ ] G.8.7 ⌘N (không project) → toast warning, KHÔNG mở modal.
  - [ ] G.8.8 R khi panel mở + task paused → Resume button click event dispatched.
  - [ ] G.8.9 Screen reader sanity (VoiceOver Mac hoặc NVDA Windows): heading hierarchy, StatusBadge label announces.

- [ ] **Task G.9 — TypeScript + ESLint verification**
  - [ ] G.9.1 Chạy `cd frontend && pnpm tsc -b` (nếu repo dùng pnpm) hoặc `npm run build` — verify strict TS pass.
  - [ ] G.9.2 Chạy `cd frontend && npm test -- --run` — verify tất cả test pass (KHÔNG có flaky).
  - [ ] G.9.3 KHÔNG có warning về unused imports / vars sau cleanup.

---

## Dev Notes

### Architecture compliance

**File locations (theo `_bmad-output/planning-artifacts/architecture.md` §"Project Directory Structure" dòng 460–484):**

```
frontend/src/
├── hooks/
│   ├── useKeyboardShortcuts.ts        ← NEW
│   ├── useKeyboardShortcuts.test.tsx  ← NEW
│   ├── useFocusTrap.ts                ← NEW
│   ├── useFocusTrap.test.tsx          ← NEW
│   └── useFocusRestoration.ts         ← NEW (optional — D.3.4)
├── contexts/
│   ├── SearchOverlayContext.tsx       ← NEW
│   └── NewTaskModalContext.tsx        ← NEW
├── components/
│   ├── SkipLink.tsx                   ← NEW
│   ├── SkipLink.css                   ← NEW
│   ├── SkipLink.test.tsx              ← NEW
│   ├── AppShell.tsx                   ← UPDATE (mount SkipLink, providers, keyboard hook, modal)
│   ├── TopBar.tsx                     ← UPDATE (lift modal state to context)
│   ├── ConfirmationDialog.tsx         ← UPDATE (aria-modal, focus heading)
│   ├── CreateTaskModal.tsx            ← UPDATE (focus restoration)
│   └── CreateTaskModal.css            ← UPDATE (input focus ring)
├── features/
│   ├── search/                        ← NEW directory
│   │   ├── SearchOverlay.tsx          ← NEW
│   │   ├── SearchOverlay.css          ← NEW
│   │   └── SearchOverlay.test.tsx     ← NEW
│   ├── detail/
│   │   ├── TaskDetailPanel.tsx        ← UPDATE (focus trap, resume button data-action)
│   │   └── TaskDetailPanel.test.tsx   ← UPDATE (append tests)
│   └── project/
│       └── CreateProjectModal.tsx     ← UPDATE (focus restoration, focus heading)
└── contexts/
    └── TaskDetailContext.tsx          ← UPDATE (triggering element capture, focus restoration on closeTask)
```

**Tổng file mới: ~13 (8 source + 5 test). File update: 8.**

**Files KHÔNG đụng (regression guard):**
- `frontend/src/App.tsx` (routes giữ nguyên).
- `frontend/src/components/StatusBadge.tsx` (đã đúng aria-label — chỉ test verification).
- `frontend/src/components/Button.tsx` + `Button.css` (focus-visible đã đúng).
- `frontend/src/components/TaskCard.tsx` (Enter/Space keyboard handler đã có — KHÔNG đụng).
- `frontend/src/components/Sidebar.tsx` (navigation aria-label đã có — KHÔNG đụng; collapsed mode defer 4.3).
- `frontend/src/features/board/*` (chỉ verify TaskCard regression).
- `frontend/src/features/project/ProjectSwitcher.tsx` (aria-haspopup/aria-expanded đã đúng).
- `frontend/src/styles/tokens.css` (KHÔNG đổi token values).
- `frontend/src/styles/global.css` (no changes needed).
- `backend/*` (KHÔNG đụng — frontend-only story).

### Library/Framework requirements

| Library | Version (locked) | Dùng trong 4.2 |
|---|---|---|
| `react` | 19.x (project-context §"Technology Stack"; `frontend/package.json:14`) | `useState`, `useEffect`, `useRef`, `useMemo`, `useCallback`, `createContext`, `useContext` |
| `react-dom` | 19.x (`frontend/package.json:15`) | `createPortal` cho SearchOverlay |
| `react-router` | 7.15.1 (`frontend/package.json:16`) | KHÔNG dùng — keyboard shortcut KHÔNG navigate route |
| `@tanstack/react-query` | 5.100.11 (`frontend/package.json:13`) | KHÔNG dùng trực tiếp — reuse `useAggregatedTasks` từ 4.1 |
| `vitest` + `@testing-library/react` + `@testing-library/user-event` | matches `frontend/package.json:22-26` (đã pinned) | Tests |

**KHÔNG thêm dependency mới.** Đặc biệt KHÔNG add `focus-trap-react`, `react-hotkeys-hook`, `cmdk`, hoặc `react-aria` — pure implementation đủ cho scope.

### Keyboard shortcut casing + cross-platform handling

- `e.key` giữ nguyên casing của user — `Shift+K` → `e.key === "K"`. Story 4.2 dùng `e.key.toLowerCase()` cho consistent matching.
- Cross-platform: dùng `e.metaKey || e.ctrlKey` (cùng pattern UX spec dòng 838 "`⌘K` (or `Ctrl+K`)"). KHÔNG detect OS qua `navigator.platform` (deprecated) hoặc `navigator.userAgent` (spoofable).
- `R` shortcut KHÔNG modifier — pure `e.key.toLowerCase() === "r"` AND `!e.metaKey && !e.ctrlKey && !e.altKey`.
- KHÔNG implement Sequence shortcut (Vim-style "gd") cho 4.2.

### Focus management patterns

- **Focus trap chỉ trên overlay UI** (Detail Panel, Modal, Search). KHÔNG trap trên Main page (defeats Tab navigation).
- **Focus restoration**: ưu tiên restore về element đã trigger overlay mở. Fallback: nếu `triggeringElement?.isConnected === false` (element đã unmount), KHÔNG try focus — để browser default behavior (focus `<body>`).
- **setTimeout 0ms** cho `.focus()` sau React commit — đảm bảo DOM đã update + React đã release control. Pattern tương tự CodeMirror, Monaco, Material UI dialog implementations.
- **`tabIndex={-1}`** cho `<main>` (Skip Link target), heading h2 trong modal (programmatic focus target) — đảm bảo focusable nhưng KHÔNG vào Tab order natural.

### State management for global shortcuts

| State | Owner | Notes |
|---|---|---|
| `SearchOverlay.open` | `SearchOverlayContext` | Triggered by ⌘K from `useKeyboardShortcuts` |
| `NewTaskModal.open` | `NewTaskModalContext` | Triggered by ⌘N from `useKeyboardShortcuts` OR "+ New Task" button click in TopBar |
| `TaskDetailPanel.triggeringElement` | `TaskDetailContext` (internal state, not exposed) | Captured on `openTask`, restored on `closeTask` |
| `searchQuery`, `selectedIndex` | `SearchOverlay` local state (useState) | Reset on each open |

**KHÔNG dùng URL state** cho overlay open status — keyboard-triggered overlay không nên ảnh hưởng history. Future story có thể thêm `?search=foo` query param nếu yêu cầu deep-link.

### Critical don't-miss rules

- ❌ **KHÔNG** mount keyboard listener nhiều lần (tránh duplicate handlers). `useKeyboardShortcuts` chỉ gọi 1 lần ở `AppShellInner`. Test verify cleanup khi unmount.
- ❌ **KHÔNG** dùng `window.addEventListener` cho keyboard — dùng `document.addEventListener` để phía bubble từ body lên.
- ❌ **KHÔNG** preventDefault tất cả keystroke — chỉ preventDefault khi shortcut match AND action sẽ execute (tránh block typing trong input).
- ❌ **KHÔNG** focus element trong overlay khi overlay đang đóng — race condition gây focus thrashing.
- ❌ **KHÔNG** assume `dialog.showModal()` available — jsdom v22+ has support; nếu test fail trong CI cũ, polyfill nhẹ trong `test-setup.ts` (xem `frontend/src/test-setup.ts`).
- ❌ **KHÔNG** add npm dependencies mới — đã list ở §Library/Framework requirements.
- ❌ **KHÔNG** đụng `StatusBadge.tsx`, `Button.tsx`, `TaskCard.tsx`, `Sidebar.tsx` (regression guard).
- ❌ **KHÔNG** wire Resume button onClick — đó là scope Story 3.3. Chỉ thêm `data-action="resume-session"` cho keyboard handler query.
- ❌ **KHÔNG** implement RunTimeline aria-live — defer Story 3.5b.
- ❌ **KHÔNG** implement responsive breakpoint changes — defer Story 4.3.

### Critical implementation rules

**React (project-context §"Framework-Specific Rules"):**
- TypeScript strict mode — khai báo type rõ cho mọi prop, hook return, ref.
- KHÔNG dùng `any`, `getattr`, `setattr` — đối với DOM, dùng `HTMLElement` / `HTMLButtonElement` cụ thể.
- State management: `useState` + `useContext` + `useRef`. KHÔNG dùng Redux/Zustand.
- `useCallback` cho callback truyền xuống hook deps (tránh re-bind listener).
- `useMemo` cho expensive computation (filter results trong SearchOverlay).

**CSS:**
- Bắt buộc dùng CSS variables: `--shadow-focus`, `--brand-primary`, `--bg-card`, `--bg-hover`, `--text-inverse`, `--space-*`, `--radius-*`. List đầy đủ ở `frontend/src/styles/tokens.css`.
- KHÔNG hardcode `#hex`.
- `:focus-visible` (NOT `:focus`) cho indicator chỉ hiện khi keyboard navigation. Exception: `<input>` focus có thể dùng `:focus` (user expect ring khi click hoặc keyboard).
- `transition: box-shadow 0.15s` — match existing Button.css transition timing.

**Routing:**
- KHÔNG đụng routes / `App.tsx`. Keyboard shortcut KHÔNG navigate qua `useNavigate()` — chỉ mở overlay/modal.

**Accessibility-specific:**
- Heading hierarchy: `<h1>` cho page (DashboardRoute / BoardRoute đã có), `<h2>` cho section + modal title, `<h3>` cho card title. SearchOverlay heading h2 hidden visually nhưng vẫn ở DOM cho screen reader.
- Semantic HTML5: `<main>`, `<nav>`, `<aside>`, `<dialog>`, `<section aria-labelledby>`. Skip Link `<a href="#main-content">` (NOT `<button>`) — semantically là link tới anchor.
- `aria-label` chỉ thêm cho icon-only buttons hoặc khi visible text KHÔNG đủ context.
- `aria-modal="true"` luôn kèm `role="dialog"` (hoặc native `<dialog>`).
- `tabIndex={0}` chỉ cho element cần vào Tab order nhưng KHÔNG natively focusable (e.g. TaskCard `<div>`). `tabIndex={-1}` cho programmatic focus target (heading, `<main>`).

### Previous story intelligence

**Từ Story 1.4 (done):**
- `AppShell.tsx` đã có `<main role="main">` (dòng 15). Story 4.2 chỉ thêm `id="main-content"` + `tabIndex={-1}`.
- `<TaskDetailProvider>` wrap (dòng 10) — pattern provider mounting; Story 4.2 mở rộng wrap thêm `SearchOverlayProvider` + `NewTaskModalProvider`.

**Từ Story 2.0 (done):**
- `Button.css` `:focus-visible { box-shadow: var(--shadow-focus); }` đã đúng — Story 4.2 reuse pattern này cho input focus + Skip Link focus.
- `ConfirmationDialog.tsx` có Escape handler + `aria-labelledby` — Story 4.2 chỉ thêm `aria-modal` + focus heading.

**Từ Story 2.1 (done):**
- `CreateProjectModal.tsx` đã có `role="dialog"` + `aria-modal` + `aria-labelledby` (dòng 115–117) — Story 4.2 chỉ thêm focus heading + focus restoration.
- `ProjectSwitcher.tsx` có `aria-haspopup`/`aria-expanded` đầy đủ — KHÔNG đụng.

**Từ Story 2.2 (done):**
- `CreateTaskModal.tsx` Escape handler (dòng 69–79) — Story 4.2 reuse pattern cho focus restoration logic.
- `CreateTaskModal.tsx` `aria-modal` + `aria-labelledby` đã có (dòng 134–135) — chỉ thêm focus restoration.
- `useTasks.ts` + `useProjects.ts` queryKeys conventions — Story 4.2 KHÔNG add new query.

**Từ Story 2.3 (done):**
- `TaskCard.tsx` Enter/Space keyboard handler (dòng 29–43) — Story 4.2 KHÔNG đụng. Pattern này tương tự cho SearchOverlay result rows nhưng implement riêng (KHÔNG copy-paste).
- TaskCard `tabIndex={0}` (dòng 49) — pattern cho clickable non-button — Story 4.2 reuse cho SearchOverlay result `<li>`.

**Từ Story 2.4 (done):**
- `TaskDetailPanel.tsx` Escape handler (dòng 142–147) — Story 4.2 KEEP, chỉ append `useFocusTrap` + focus restoration logic.
- `TaskDetailContext` `openTask(task, project)` signature — Story 4.2 MỞ RỘNG thêm optional `triggeringElement` param.
- Close button focus on open (dòng 150–154) — Story 4.2 KEEP nhưng có thể đổi sang focus heading h2 (`task-detail-panel__title`, `aria-labelledby` reference) trong follow-up nếu cần better screen reader UX. KHÔNG đổi trong 4.2 (out of scope).

**Từ Story 4.1 (ready-for-dev, depend hard):**
- `useAggregatedTasks` hook (sẽ tạo ở `frontend/src/hooks/useAggregatedTasks.ts`) — SearchOverlay data source. Type returned: `Array<Task & { project: Project }>`. **Nếu 4.1 chưa done khi dev 4.2 → HALT.**
- `Dashboard.tsx` + `DashboardSection.tsx` ở `frontend/src/features/dashboard/` — KHÔNG đụng. Skip Link target `<main>` đảm bảo Tab focus rơi vào Dashboard heading (Story 4.1 AC-1 sẽ tạo `<section aria-labelledby="dashboard-heading">`).

**Từ Stories 3.x (ready-for-dev, chưa merged):**
- Story 3.3 (Resume Session) sẽ implement Resume button onClick + mutation. Story 4.2 ADD `data-action="resume-session"` attribute — Story 3.3 phải PRESERVE attribute khi wire onClick.
- Story 3.5b (RunTimeline + Comments/Runs/Logs tabs) sẽ implement RunTimeline. Story 3.5b TỰ IMPLEMENT `aria-live="polite"` (UX spec dòng 1840) — KHÔNG phụ thuộc 4.2.

### Git intelligence

**Recent commits (last 5):**
- `14ea16b Merge PR #13: 4-1-morning-dashboard story doc` — Story 4.1 story file merged (chưa implement).
- `a9f2c46 docs(story): create 4-1-morning-dashboard` — same as above.
- `fe91262 Merge PR #12: 3-5b story doc` — Story 3.5b story file merged.
- `4b06bf4 docs(story): create 3-5b-comments-runs-and-logs-tabs-and-runtimeline` — same.
- `20b3bd7 Merge PR #11: 3-5a story doc` — Story 3.5a story file merged.

**Patterns observed:**
- Story creation PRs chứa 2 files: story `.md` + `sprint-status.yaml` update (recent pattern — verify by looking at PR #11, #12, #13 diffs).
- Implementation PRs (frontend-only) thường 8–15 files (components + tests).
- Story files sử dụng Vietnamese narrative + English code blocks + English UX terms — consistent với 4-1, 3-5a, 3-5b.

**Branch naming:** `devin/<unix-timestamp>-story-<key>` — Story 4.2 dùng `devin/<ts>-story-4-2-accessibility-and-keyboard-shortcuts`.

### Latest technical specifics

Không có technical area nào yêu cầu research version mới cho 4.2:
- React 19.x + TypeScript 6.x — đã pinned, API stable.
- HTML5 `<dialog>` element + `showModal()` — Chrome 37+, Firefox 98+, Safari 15.4+ — đã cover architecture target (Chrome 120+ primary).
- CSS `:focus-visible` — Chrome 86+, Firefox 85+, Safari 15.4+ — cover.
- Native focus trap qua `<dialog>` showModal() — Chrome 37+. Browser-level trap mạnh hơn library-based, KHÔNG cần `focus-trap-react`.
- jsdom `:focus-visible` support — jsdom v22+ (kiểm tra `frontend/package.json` jsdom version 29.x — OK).
- `Intl.Collator` cho sort kết quả search — KHÔNG cần (sort by `updatedAt` numeric, not locale-aware string).

### Project Structure Notes

**Alignment với architecture.md (dòng 460–484):**
- `features/dashboard/` directory pre-allocated (dòng 461–463) — Story 4.1 sẽ fill.
- `features/task-detail/` directory pre-allocated (dòng 467–474) — currently mismatch: code dùng `features/detail/` (lowercase, no hyphen). Architecture nói `task-detail/` nhưng code đã commit `detail/` từ Story 2.4. **Variance accepted** — KHÔNG đụng trong 4.2.
- `features/search/` directory KHÔNG có trong architecture.md. **Detected variance:** Story 4.2 thêm `features/search/` cho SearchOverlay. Rationale: Search là feature-level component (giống dashboard, board, detail) — đặt ở `features/` đúng convention. KHÔNG conflict architecture intent.
- `contexts/` directory đã có 1 file (`TaskDetailContext.tsx`). Story 4.2 thêm 2 file (`SearchOverlayContext`, `NewTaskModalContext`) — cùng pattern.
- `hooks/` directory đã có (3 files: `useStartSession`, `useProjects`, `useTasks`). Story 4.2 thêm 2 hooks (`useKeyboardShortcuts`, `useFocusTrap`) — cùng pattern.

**Detected variance from architecture:**
- Architecture chỉ list 1 layer của Project structure — không enumeration đầy đủ cho contexts/hooks. Story 4.2 thêm files mới theo natural project convention. **KHÔNG conflict architecture intent.**

### References

- `_bmad-output/planning-artifacts/epics.md#Story 4.2: Accessibility & Keyboard Shortcuts` (dòng 800–852) — Source AC-1 đến AC-11 (mapping: AC-1↔focus indicator, AC-2↔focus trap, AC-3↔Escape return focus, AC-4↔StatusBadge aria-label + RunTimeline aria-live deferred, AC-5↔modal role/labelledby/focus heading, AC-6↔icon button aria-label, AC-7↔Skip link, AC-8↔⌘K search, AC-9↔⌘N new task, AC-10↔R resume, AC-11↔contrast).
- `_bmad-output/planning-artifacts/epics.md#Epic 4 framing` (dòng 749–751) — narrative.
- `_bmad-output/planning-artifacts/epics.md#UX-DR19` (dòng 123) — Accessibility & Keyboard Shortcuts spec summary.
- `_bmad-output/planning-artifacts/epics.md#NFR-6` (dòng 58) — WCAG 2.1 AA target.
- `_bmad-output/planning-artifacts/ux-design-specification.md#Accessibility Strategy` (dòng 1820–1845) — semantic HTML + aria + keyboard + screen reader full spec.
- `_bmad-output/planning-artifacts/ux-design-specification.md#Accessibility Baseline (WCAG AA Practical)` (dòng 1451–1459) — contrast + focus.
- `_bmad-output/planning-artifacts/ux-design-specification.md#Keyboard shortcuts (progressive disclosure)` (dòng 1745–1754) — shortcut table.
- `_bmad-output/planning-artifacts/ux-design-specification.md#Keyboard Shortcuts (Interaction Rules)` (dòng 994–1003) — full shortcut table including J/K navigation (out of scope cho 4.2 — UX spec list nhưng epics.md AC KHÔNG yêu cầu).
- `_bmad-output/planning-artifacts/ux-design-specification.md#Implementation Guidelines` (dòng 1846–1859) — HTML semantics.
- `_bmad-output/planning-artifacts/architecture.md#Frontend Architecture` (dòng 230–246) — TanStack Query patterns (KHÔNG dùng cho 4.2 trực tiếp).
- `_bmad-output/planning-artifacts/architecture.md#Project Directory Structure` (dòng 460–484) — file location source.
- `_bmad-output/planning-artifacts/architecture.md#Cross-Cutting Concerns Identified` (dòng 83) — "Accessibility — WCAG AA, focus trap, aria-live, keyboard nav | Toàn bộ React component layer".
- `_bmad-output/project-context.md#Critical Implementation Rules` — Language/Framework rules cho React.
- `_bmad-output/project-context.md#Critical Don't-Miss Rules` (dòng 122–131) — don't display Session ID etc.
- `frontend/src/styles/tokens.css` — `--shadow-focus` (dòng 95), `--brand-primary` (dòng 19), `--bg-hover` (dòng 12).
- `frontend/src/components/Button.css` (dòng 18–21) — `:focus-visible` pattern reference.
- `frontend/src/components/AppShell.tsx` — mount point for SkipLink + providers + global hook.
- `frontend/src/components/StatusBadge.tsx` (dòng 29) — aria-label đã đúng, regression guard.
- `frontend/src/components/CreateTaskModal.tsx` (dòng 130–141, 69–79) — modal pattern + Escape handler reference.
- `frontend/src/components/ConfirmationDialog.tsx` — modal pattern + aria-labelledby reference.
- `frontend/src/features/detail/TaskDetailPanel.tsx` (dòng 142–154, 179–194) — panel Escape + focus management reference.
- `frontend/src/features/project/CreateProjectModal.tsx` (dòng 115–117) — modal role/aria reference.
- `frontend/src/contexts/TaskDetailContext.tsx` — context pattern reference.
- `frontend/src/hooks/useStartSession.ts` + `useTasks.ts` + `useProjects.ts` — hook pattern reference.
- `_bmad-output/implementation-artifacts/4-1-morning-dashboard.md` — Story 4.1 sibling cho cross-reference (dependency).

---

## Dev Agent Record

### Agent Model Used

_To be filled by dev agent_

### Debug Log References

_To be filled by dev agent_

### Completion Notes List

_To be filled by dev agent_

### File List

_To be filled by dev agent_
