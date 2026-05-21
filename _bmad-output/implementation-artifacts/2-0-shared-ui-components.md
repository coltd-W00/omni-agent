# Story 2.0: Shared UI Components

**Status:** in-progress
**Epic:** 2 — Project & Task Management
**Story ID:** 2.0
**Story Key:** 2-0-shared-ui-components

<!-- Validation là optional. Có thể chạy validate-create-story cho fresh-context quality check trước khi vào dev-story. -->

---

## Story

As a developer using omni-agent,
I want shared UI components (Button, Toast, ConfirmationDialog, StatusBadge, AgentAvatar, SessionBadge, TaskCard, Empty State) available trong `frontend/src/components/`,
So that các feature story tiếp theo (2.1 Project Management, 2.2 Task CRUD, 2.3 Task Board, 2.4 Task Detail Panel) có sẵn một foundation UI nhất quán, accessible, và dùng đúng design tokens — không story nào sau Epic 1 phải tự build lại các primitive này.

---

## Acceptance Criteria

> **Bối cảnh đọc AC:** "Variant styles" = các class CSS + `var(--*)` token trong file `*.css` cạnh component. Mọi giá trị màu/spacing/radius/shadow/font phải tham chiếu tới tokens trong `frontend/src/styles/tokens.css` (đã có từ Story 1.3). Bất kỳ hardcode hex nào ngoài `tokens.css` đều fail review.

**AC-1 (Button — 4 variants × 3 sizes × 2 trạng thái):**
Given import `Button` từ `frontend/src/components/Button` / When render với prop `variant ∈ {"primary", "secondary", "ghost", "destructive"}` và `size ∈ {"sm", "md", "lg"}` / Then:
- `primary`: background `var(--brand-primary)`, hover `var(--brand-hover)`, text `var(--text-inverse)`.
- `secondary`: background `var(--bg-card)`, border `1px solid var(--border)`, text `var(--text-primary)`, hover `var(--bg-hover)`.
- `ghost`: background `transparent`, không border, text `var(--text-primary)`, hover `var(--bg-hover)`.
- `destructive`: background `var(--status-failed-bg)`, text `var(--status-failed-text)`, border `1px solid var(--status-failed-border)`, hover background `#FCA5A5` alias không được dùng → dùng `filter: brightness(0.96)` để giữ token-only.
- Sizes: `sm` height 28px (`var(--space-1) var(--space-3)`), `md` 36px (default — `var(--space-2) var(--space-4)`), `lg` 44px (modal CTA — `var(--space-3) var(--space-5)`).
- Default `size = "md"`, `variant = "primary"`.
- Khi `loading={true}`: button `aria-busy="true"`, `disabled={true}` (không click được), text giữ nguyên, một inline spinner (`<span aria-hidden="true">` quay 360° infinite, CSS animation, 16px) render trước text. KHÔNG đổi label thành "Loading…".
- Khi `disabled={true}` (kể cả do `loading`): opacity 40%, `cursor: not-allowed`. Click handler KHÔNG được gọi.
- Focus visible: `box-shadow: var(--shadow-focus)` trên `:focus-visible` (không phải `:focus` thuần để tránh trigger khi click chuột).
- Render `<button type="button">` mặc định — nếu `type` được truyền vào thì respect (`submit` / `reset` / `button`).

**AC-2 (Toast — Provider + hook + 3-stack cap):**
Given app wrap `<ToastProvider>` ở root (cấp ngang `<BrowserRouter>` trong `main.tsx`) / When component bất kỳ gọi `const { showToast } = useToast(); showToast({ tone: "success", message: "Comment saved" })` / Then:
- Toast container đặt `position: fixed; right: var(--space-6); bottom: var(--space-6); z-index: 1000;` — bottom-right, không che TopBar.
- Toast width 360px, padding `var(--space-3) var(--space-4)`, border-radius `var(--radius-md)`, shadow `var(--shadow-md)`.
- Tones (background / text / leading icon):
  - `success`: `var(--status-completed-bg)` / `var(--status-completed-text)` / "✓".
  - `warning`: `var(--status-needs-review-bg)` / `var(--status-needs-review-text)` / "⚠".
  - `error`: `var(--status-failed-bg)` / `var(--status-failed-text)` / "✕".
  - `info`: `var(--status-ready-bg)` / `var(--status-ready-text)` / "ℹ".
- Animation: slide in từ dưới (`transform: translateY(20px)` → `translateY(0)`, opacity 0 → 1, 200ms ease-out). Fade out khi remove (opacity 1 → 0, 150ms).
- Auto-dismiss sau 4000ms cho `success | warning | info`. `error` KHÔNG auto-dismiss — user phải click nút `✕` close.
- Stack tối đa **3** toast cùng lúc — khi gọi `showToast` thứ 4 trong khi đã có 3 toast, **bỏ toast cũ nhất** (FIFO drop) trước khi push toast mới. KHÔNG queue, KHÔNG silently drop toast mới.
- Mỗi toast container có `role="status"` (`success | warning | info`) hoặc `role="alert"` (`error`) — screen reader announce ngay.
- `useToast()` gọi ngoài `<ToastProvider>` phải throw error rõ ràng (`"useToast must be used within ToastProvider"`).

**AC-3 (ConfirmationDialog — focus trap + Esc + variant):**
Given import `ConfirmationDialog` / When render với props `{ open, title, description, confirmLabel, cancelLabel?, onConfirm, onCancel, variant: "destructive" | "primary" }` / Then:
- Dialog render qua React Portal (`ReactDOM.createPortal`) vào `document.body` — không bị clip bởi `overflow: hidden` ở parent.
- Dùng native `<dialog>` HTML element với method `showModal()` để get focus trap + Esc handler miễn phí (browser handles). Khi `open` đổi từ `false` → `true`: gọi `dialogRef.current?.showModal()`. Khi `false`: gọi `.close()`.
- Backdrop có `::backdrop { background: rgba(0, 0, 0, 0.4); }` — click backdrop = Cancel.
- Layout: title (`var(--font-size-heading-m)`, font-weight 600), description (`var(--font-size-body)`, `var(--text-secondary)`), khoảng cách `var(--space-4)` giữa title và description, `var(--space-6)` từ description tới footer.
- Footer: 2 button, `display: flex; justify-content: flex-end; gap: var(--space-3)`:
  - Cancel: bên TRÁI (trong footer thứ tự DOM), `<Button variant="ghost" size="md">{cancelLabel || "Cancel"}</Button>`.
  - Confirm: bên PHẢI, `variant = "destructive"` nếu prop `variant === "destructive"`, ngược lại `variant = "primary"`.
- Phím `Escape` đóng dialog (native `<dialog>` đã handle — chỉ cần lắng nghe event `close` để gọi `onCancel`).
- Khi mở: focus tự động chuyển vào Cancel button (default safe action), KHÔNG focus Confirm (đặc biệt với destructive — tránh user enter nhầm). Implementation: dùng `autoFocus` trên Cancel button trong JSX (React auto-applies sau khi dialog visible).
- Dialog phải có `aria-labelledby` trỏ tới id của title element, `aria-describedby` trỏ tới description.
- Confirm callback nhận `event` arg; nếu `await onConfirm()` throw / reject, dialog **không** tự đóng (caller chịu trách nhiệm gọi `setOpen(false)` sau khi xử lý thành công). Document rõ trong JSDoc.

**AC-4 (StatusBadge — 9 variants + Running pulse + aria):**
Given import `StatusBadge` / When render với prop `status ∈ ["draft", "ready", "assigned", "running", "needs-review", "changes-requested", "completed", "failed", "cancelled"]` và `size ∈ {"sm", "md", "lg"}` (default `"md"`) / Then:
- Mỗi variant lấy đúng `--status-{name}-{bg,text,border}` từ `tokens.css`. Không hardcode hex. Mapping chính xác:
  | Prop | bg token | text token | border token | Label hiển thị | Icon ký tự |
  |---|---|---|---|---|---|
  | `draft` | `--status-draft-bg` | `--status-draft-text` | `--status-draft-border` | "Draft" | "●" |
  | `ready` | `--status-ready-bg` | `--status-ready-text` | `--status-ready-border` | "Ready" | "●" |
  | `assigned` | `--status-assigned-bg` | `--status-assigned-text` | `--status-assigned-border` | "Assigned" | "●" |
  | `running` | `--status-running-bg` | `--status-running-text` | `--status-running-border` | "Running" | "●" (pulse) |
  | `needs-review` | `--status-needs-review-bg` | `--status-needs-review-text` | `--status-needs-review-border` | "Needs Review" | "⚑" |
  | `changes-requested` | `--status-changes-requested-bg` | `--status-changes-requested-text` | `--status-changes-requested-border` | "Changes Requested" | "!" |
  | `completed` | `--status-completed-bg` | `--status-completed-text` | `--status-completed-border` | "Completed" | "✓" |
  | `failed` | `--status-failed-bg` | `--status-failed-text` | `--status-failed-border` | "Failed" | "✕" |
  | `cancelled` | `--status-cancelled-bg` | `--status-cancelled-text` | `--status-cancelled-border` | "Cancelled" | "─" |
- Sizes:
  - `sm`: height 20px, font 10px, padding `0 var(--space-2)`, radius `var(--radius-sm)`.
  - `md` (default): height 24px, font 12px, padding `0 var(--space-2)`, radius `var(--radius-sm)`.
  - `lg`: height 28px, font 13px, padding `0 var(--space-3)`, radius `var(--radius-md)`.
- `running` variant: icon dot có animation `pulse` (opacity 1 → 0.4 → 1 trong 1.5s infinite, dùng `@keyframes`). KHÔNG dùng `animation` cho các variant khác.
- Mọi badge phải có `aria-label="Status: {Label}"` (vd `aria-label="Status: Running"`).
- KHÔNG dùng all-caps trong badge label (UX rule line 925).

**AC-5 (AgentAvatar — initials + hash color + runtime overlay):**
Given import `AgentAvatar` / When render với props `{ name, runtime, size }` với `runtime ∈ {"codex" | "claude" | undefined}` và `size ∈ {"sm" | "md" | "lg"}` (default `"md"`) / Then:
- Hiển thị initials: split `name` theo whitespace + `-` + `_`, lấy first character của tối đa 2 tokens, uppercase. Vd `"backend-coder"` → `"BC"`, `"planner"` → `"P"`, `"Frontend Coder"` → `"FC"`.
- Background color = derive từ `name` hash:
  - Function `nameToHue(name: string): number` — sum char codes mod 360.
  - CSS: `background-color: hsl(${hue}, 60%, 88%); color: hsl(${hue}, 50%, 30%);` (đảm bảo contrast WCAG AA).
  - **Lưu ý:** Đây là **derived runtime color**, KHÔNG phải hardcoded hex — coding theo CSS-in-JS inline style là acceptable cho dynamic value (architecture rule "không hardcode hex" áp dụng cho static values; computed hue from input không vi phạm).
- Sizes:
  - `sm`: 20px diameter, font 10px.
  - `md` (default): 28px, font 12px.
  - `lg`: 36px, font 14px.
- Container hình tròn (`border-radius: 50%`), `display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0`.
- Khi `runtime` truthy: render overlay badge ở góc phải-dưới (`position: absolute`, parent `position: relative`):
  - Overlay 12px (`sm`), 14px (`md`), 16px (`lg`) diameter.
  - `codex`: background `#F97316` (orange — không phải status token; lấy từ UX 8.2 "orange"), text `var(--text-inverse)`, ký tự `"⚙"`.
  - `claude`: background `var(--status-running-text)` (violet `#6D28D9`), text `var(--text-inverse)`, ký tự `"✦"`.
- Codex orange `#F97316` **là exception về hardcode hex** — UX spec 8.2 chỉ định runtime brand color này; tokens.css không có entry tương ứng. Document rõ trong Dev Notes (Spec Gap) và Comment trong CSS. KHÔNG mở rộng pattern này sang các component khác.
- `aria-label="{name}, runtime: {Codex CLI | Claude CLI}"` nếu có runtime; ngược lại `aria-label="{name}"`.

**AC-6 (SessionBadge — 4 variants):**
Given import `SessionBadge` / When render với prop `state ∈ ["no-session" | "active" | "resumable" | "closed"]` / Then:
- Mỗi variant style đúng UX 8.4:
  - `no-session`: background `transparent`, text `var(--text-disabled)`, border `1px dashed var(--border-strong)`, label `"─ No session"`.
  - `active`: background `var(--status-running-bg)`, text `var(--status-running-text)`, border `1px solid var(--status-running-border)`, label `"● Active"`, dot pulse animation (cùng keyframe với StatusBadge running).
  - `resumable`: background `var(--status-ready-bg)`, text `var(--status-ready-text)`, border `1px solid var(--status-ready-border)`, label `"↩ Resumable"`.
  - `closed`: background `var(--status-completed-bg)`, text `var(--status-completed-text)`, border `1px solid var(--status-completed-border)`, label `"✓ Closed"`.
- Kích thước cố định: height 24px, font 12px, padding `0 var(--space-2)`, radius `var(--radius-sm)`. KHÔNG có size prop (story 2.0 chỉ cần 1 size — story sau extend nếu cần).
- `aria-label="Session: {state-human-readable}"` (e.g. `"Session: Active"`).

**AC-7 (TaskCard — composition + hover):**
Given import `TaskCard` / When render với props `{ task: Task, project: { key: string, color?: string }, agent: { name: string, runtime: "codex" | "claude" }, sessionState: SessionState, commentsCount: number, lastActivity: string }` / Then:
- Render Project tag pill bên trái + AgentAvatar (size `sm`) bên phải trên cùng 1 hàng (header):
  - Project tag: `background: var(--bg-hover); color: var(--text-secondary); border-radius: var(--radius-sm); padding: 2px var(--space-2); font-size: var(--font-size-caption); font-weight: 500`. Hiển thị `project.key` uppercase (e.g. "ERP-CB"). KHÔNG dùng `project.color` trong story này — sẽ implement project color trong Story 2.1.
- Title (`<h3>`): `var(--font-size-body)`, font-weight 500, color `var(--text-primary)`, max **2 lines** với `display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden`.
- Hàng thứ 3 (giữa header và footer): `SessionBadge` align phải. (Runtime badge inline KHÔNG render ở story này — `AgentAvatar` overlay đã thể hiện runtime; xem Spec Gap.)
- Footer 1 dòng: `<span>● {commentsCount} comments</span>`, spacer, `<span>{lastActivity}</span>` (vd "2h"). Caption size `var(--font-size-caption)`, color `var(--text-secondary)`.
- Card container:
  - Background `var(--bg-card)`, border `1px solid var(--border)`, border-radius `var(--radius-md)`, padding `var(--space-3)`, box-shadow `var(--shadow-sm)`.
  - Hover (`:hover`): box-shadow `var(--shadow-md)`, border-color `var(--border-strong)`, `cursor: pointer`.
  - Khoảng cách giữa các row trong card: `var(--space-2)` (gap).
- TaskCard nhận optional `onClick?: () => void` — gọi khi user click card. KHÔNG navigate trong story này (Story 2.4 sẽ wire click → open Detail Panel).
- Card có `role="button"`, `tabIndex={0}` khi có `onClick`; phím `Enter`/`Space` cũng trigger `onClick`. Nếu không có `onClick`, KHÔNG set `role`/`tabIndex` (avoid fake interactive).
- Field `lastActivity`: PROP đã là string đã format (vd "2h", "5 min ago") — TaskCard KHÔNG tự format. Format helper là responsibility của caller (Story 2.3 sẽ format từ timestamps).
- `Task` type chỉ cần fields `id` (string), `title` (string), `status` (TaskStatus enum) — minimal cho story này. Story 2.2 sẽ extend.

**AC-8 (EmptyState — 48px icon + heading + body + optional CTA):**
Given import `EmptyState` / When render với props `{ icon: string, heading: string, description?: string, ctaLabel?: string, onCtaClick?: () => void, variant?: "full" | "inline" }` (default `variant = "full"`) / Then:
- `variant === "full"`:
  - Container `padding: var(--space-10) var(--space-4)`, `text-align: center`, `max-width: 360px`, `margin: 0 auto`.
  - Icon: font-size 48px, color `var(--text-disabled)`, margin-bottom `var(--space-4)`.
  - Heading: `var(--font-size-heading-m)`, font-weight 600, color `var(--text-primary)`, margin-bottom `var(--space-2)`.
  - Description: `var(--font-size-body)`, color `var(--text-secondary)`, margin-bottom `var(--space-5)`.
  - Nếu `ctaLabel && onCtaClick`: render `<Button variant="primary" size="md" onClick={onCtaClick}>{ctaLabel}</Button>`.
- `variant === "inline"`:
  - Container `padding: var(--space-6) var(--space-3)`, `text-align: center`.
  - Icon: font-size 32px, optional — nếu `icon` chuỗi rỗng `""` thì bỏ icon.
  - Heading: `var(--font-size-body-s)`, font-weight 500.
  - Description: `var(--font-size-body-s)`, color `var(--text-secondary)`.
  - Nếu có CTA: render `<Button variant="secondary" size="sm">`.
- Text rule: **KHÔNG được phép render** literal `"No data found"` — đây là anti-pattern theo UX spec 9.1. Nếu caller pass `heading === "No data found"`, throw `console.warn("EmptyState heading should explain why state is empty — see ux-design-specification.md §9.1")` trong dev mode. (Production builds: do NOT throw; just don't crash. Optional check, không hardcode reject — chỉ warn.)

**AC-9 (Vitest + React Testing Library setup):**
Given `frontend/package.json` / When chạy `cd frontend && npm install` / Then các devDependencies sau tồn tại với latest stable version từ npm registry tại thời điểm dev execute (KHÔNG pin version cụ thể trong story — dev verify version mới nhất khi chạy `npm install`):
- `vitest`
- `@testing-library/react`
- `@testing-library/jest-dom`
- `@testing-library/user-event`
- `jsdom`

`package.json` scripts thêm:
- `"test": "vitest run"`
- `"test:watch": "vitest"`

`frontend/vite.config.ts` extend với `test: { environment: "jsdom", globals: true, setupFiles: ["./src/test-setup.ts"], css: true }`. Cần khai báo type Vitest config cho TypeScript: `/// <reference types="vitest" />` hoặc import explicit (xem Dev Notes).

`frontend/src/test-setup.ts` tạo mới, import `"@testing-library/jest-dom/vitest"` để mở rộng matchers (`toBeInTheDocument`, etc.).

Chạy `npm run test` từ `frontend/` phải exit 0 với 0 failing test sau khi component test (AC-10) được implement.

**AC-10 (Test coverage cho mỗi component):**
Given mỗi component file `Foo.tsx` / Then có file `Foo.test.tsx` cạnh nó với tối thiểu các test sau (mỗi test KHÔNG cần 100% coverage — focus vào behavior xảy ra khi user dùng):

| Component | Test cases bắt buộc |
|---|---|
| `Button` | (a) render label; (b) calls `onClick` khi click; (c) `loading={true}` blocks click + sets `aria-busy`; (d) `disabled={true}` blocks click; (e) all 4 variants render correct class |
| `Toast` (test qua provider) | (a) `showToast` makes toast appear với text; (b) auto-dismiss sau 4s với `success` (use fake timers); (c) `error` toast KHÔNG auto-dismiss; (d) push 4th toast → oldest (toast #1) bị remove; (e) `useToast` outside provider throws |
| `ConfirmationDialog` | (a) open=true → dialog visible với title/desc/buttons; (b) click Confirm → `onConfirm` called; (c) click Cancel → `onCancel` called; (d) press Escape → `onCancel` called; (e) focus lands on Cancel khi opens |
| `StatusBadge` | (a) render label + correct class cho mỗi 9 status; (b) `aria-label` chứa "Status: {Label}"; (c) `running` variant có pulse class |
| `AgentAvatar` | (a) render initials từ name `"backend-coder"` → `"BC"`; (b) runtime overlay render khi `runtime="codex"`; (c) `aria-label` include name + runtime |
| `SessionBadge` | (a) 4 variants render đúng label + class; (b) `aria-label` chứa state |
| `TaskCard` | (a) renders title, project key, agent name, comments count, lastActivity; (b) onClick called khi user click card; (c) Enter key trigger onClick; (d) title truncate class applied; (e) `role="button"` chỉ khi có onClick |
| `EmptyState` | (a) full variant với CTA renders button; (b) inline variant không có icon khi `icon=""`; (c) `onCtaClick` called khi click; (d) heading + description render |

Tests dùng `@testing-library/user-event` (không fireEvent thuần) cho mọi user interaction, dùng `screen.getByRole` ưu tiên hơn `getByTestId`.

**AC-11 (File structure — chỉ tạo file Story 2.0 yêu cầu):**
Given `frontend/src/` sau story này / Then có các file MỚI:
- `frontend/src/components/Button.tsx`
- `frontend/src/components/Button.css`
- `frontend/src/components/Button.test.tsx`
- `frontend/src/components/Toast.tsx`            ← chứa cả `ToastProvider`, `useToast`, `Toast` component, exports `ToastProvider, useToast` từ component file (không tách thành multiple file để giữ scope nhỏ).
- `frontend/src/components/Toast.css`
- `frontend/src/components/Toast.test.tsx`
- `frontend/src/components/ConfirmationDialog.tsx`
- `frontend/src/components/ConfirmationDialog.css`
- `frontend/src/components/ConfirmationDialog.test.tsx`
- `frontend/src/components/StatusBadge.tsx`
- `frontend/src/components/StatusBadge.css`
- `frontend/src/components/StatusBadge.test.tsx`
- `frontend/src/components/AgentAvatar.tsx`
- `frontend/src/components/AgentAvatar.css`
- `frontend/src/components/AgentAvatar.test.tsx`
- `frontend/src/components/SessionBadge.tsx`
- `frontend/src/components/SessionBadge.css`
- `frontend/src/components/SessionBadge.test.tsx`
- `frontend/src/components/TaskCard.tsx`
- `frontend/src/components/TaskCard.css`
- `frontend/src/components/TaskCard.test.tsx`
- `frontend/src/components/EmptyState.tsx`
- `frontend/src/components/EmptyState.css`
- `frontend/src/components/EmptyState.test.tsx`
- `frontend/src/types/task.ts`                  ← `Task` interface + `TaskStatus` const-object enum (xem Dev Notes về `erasableSyntaxOnly`).
- `frontend/src/types/session.ts`               ← `SessionState` union type.
- `frontend/src/test-setup.ts`

File MODIFIED (UPDATE):
- `frontend/package.json` — thêm vitest + RTL + jsdom + scripts.
- `frontend/vite.config.ts` — thêm `test:` config (extend defineConfig).
- `frontend/src/main.tsx` — wrap `<App />` bằng `<ToastProvider>` bên trong `<BrowserRouter>`.

KHÔNG tạo:
- `frontend/src/api/`, `frontend/src/hooks/` — Story 2.1/2.2.
- `frontend/src/features/` — các feature story.
- `frontend/src/routes/TaskRoute.tsx` — Story 2.4.
- `RunTimeline.tsx` — Story 3.5b.
- Component test cho `AppShell.tsx`, `Sidebar.tsx`, `TopBar.tsx` (đã ship Story 1.4 không có test; thêm test trong story này là scope creep — defer).

**AC-12 (TypeScript strict + verbatimModuleSyntax + erasableSyntaxOnly):**
Given `cd frontend && npx tsc --noEmit` / Then exit 0 với 0 errors. Các constraint cụ thể:
- `verbatimModuleSyntax: true` — mọi type-only import phải dùng `import type { Foo } from "./bar"` (không phải `import { type Foo }`).
- `erasableSyntaxOnly: true` — KHÔNG được dùng TS `enum`, `namespace`, hay parameter properties (`constructor(private foo)`). Thay `enum TaskStatus { Draft, Ready }` bằng:
  ```ts
  export const TaskStatus = {
    Draft: "draft",
    Ready: "ready",
    Assigned: "assigned",
    Running: "running",
    NeedsReview: "needs-review",
    ChangesRequested: "changes-requested",
    Completed: "completed",
    Failed: "failed",
    Cancelled: "cancelled",
  } as const;
  export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];
  ```
  Pattern này cũng áp dụng cho `SessionState`.
- `noUnusedLocals` + `noUnusedParameters` — destruct prop đầy đủ; nếu không dùng prop, prefix `_` (vd `_event`).

**AC-13 (Build + dev verify):**
Given `cd frontend && npm run build` / Then exit 0, tạo `frontend/dist/` với bundle. Given `npm run dev` chạy nền và `npm run test` chạy ở terminal khác / Then test exit 0.

**AC-14 (No regression Story 1.4):**
Given AppShell components (`AppShell.tsx`, `Sidebar.tsx`, `TopBar.tsx`) / Then KHÔNG có file nào trong Story 1.4 bị xóa/sửa visual. Story 2.0 chỉ wrap `<App />` thêm `<ToastProvider>` ở `main.tsx` — không thay đổi route structure, không thay đổi Sidebar/TopBar layout. Manual visual check: `/dashboard`, `/board`, `/random-route` vẫn render đúng như trước (xem Manual checklist).

---

## Tasks / Subtasks

- [ ] **Task 1: Cài Vitest + React Testing Library + jsdom** (AC: 9, 13)
  - [ ] 1.1 Verify Story 1.3 + 1.4 đã merge: `frontend/package.json` có `react@^19`, `react-dom@^19`, `react-router@^7.15.1`, `vite@^8.0.13`. Nếu thiếu → STOP và escalate.
  - [ ] 1.2 Từ `frontend/`, chạy `npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom`. Dùng latest version có sẵn trên npm registry tại thời điểm execute — KHÔNG pin trong story.
  - [ ] 1.3 Verify `package.json` có cả 5 packages trong `devDependencies` (`vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`).
  - [ ] 1.4 Thêm scripts vào `package.json`:
    ```json
    "test": "vitest run",
    "test:watch": "vitest"
    ```
    Giữ nguyên `dev`, `build`, `preview`.

- [ ] **Task 2: Cấu hình Vite test config** (AC: 9, 12, 13)
  - [ ] 2.1 Mở `frontend/vite.config.ts`. Thêm reference cho Vitest types ở đầu file:
    ```ts
    /// <reference types="vitest" />
    ```
  - [ ] 2.2 Mở rộng `defineConfig` với block `test`:
    ```ts
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test-setup.ts"],
      css: true,
    },
    ```
    Giữ nguyên `server.proxy` và `plugins`.
  - [ ] 2.3 Tạo `frontend/src/test-setup.ts`:
    ```ts
    import "@testing-library/jest-dom/vitest";
    ```
    Một dòng — chỉ extend `expect` matchers. KHÔNG thêm global mock, KHÔNG configure JSDOM custom — giữ minimal.
  - [ ] 2.4 Mở `frontend/tsconfig.app.json`. Thêm `"vitest/globals"` vào `compilerOptions.types`:
    ```json
    "types": ["vite/client", "vitest/globals"],
    ```
    Để TS không complain về `describe`, `it`, `expect` globals.

- [ ] **Task 3: Tạo `Task` + `SessionState` types** (AC: 11, 12)
  - [ ] 3.1 Tạo `frontend/src/types/task.ts` với `TaskStatus` const-object pattern (xem AC-12 snippet) và interface:
    ```ts
    export interface Task {
      id: string;          // e.g. "ERP-CB-001"
      title: string;
      status: TaskStatus;
    }
    ```
    Story 2.2 sẽ extend (thêm `description`, `acceptanceCriteria`, `agentId`, etc.).
  - [ ] 3.2 Tạo `frontend/src/types/session.ts`:
    ```ts
    export const SessionState = {
      NoSession: "no-session",
      Active: "active",
      Resumable: "resumable",
      Closed: "closed",
    } as const;
    export type SessionState = (typeof SessionState)[keyof typeof SessionState];
    ```
  - [ ] 3.3 KHÔNG tạo `Session`, `Run`, `Comment` types — các story sau scope.

- [ ] **Task 4: Implement `Button`** (AC: 1, 10, 11, 12)
  - [ ] 4.1 Tạo `frontend/src/components/Button.tsx`. Props interface:
    ```ts
    type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
    type ButtonSize = "sm" | "md" | "lg";
    interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
      variant?: ButtonVariant;
      size?: ButtonSize;
      loading?: boolean;
      type?: "button" | "submit" | "reset";
    }
    ```
    Component render `<button>` với classes `app-button app-button--{variant} app-button--{size}`. Nếu `loading`, thêm `app-button--loading` và `aria-busy="true"`, `disabled={true}`. Spinner element: `<span className="app-button__spinner" aria-hidden="true" />`.
  - [ ] 4.2 Tạo `frontend/src/components/Button.css` với classes per AC-1. Spinner keyframe:
    ```css
    @keyframes app-button-spin { to { transform: rotate(360deg); } }
    .app-button__spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      margin-right: var(--space-2);
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: app-button-spin 0.8s linear infinite;
      vertical-align: middle;
    }
    ```
    Focus: `.app-button:focus-visible { outline: none; box-shadow: var(--shadow-focus); }`.
  - [ ] 4.3 Tạo `frontend/src/components/Button.test.tsx` cover 5 cases AC-10. Dùng `userEvent.setup()` + `await user.click(...)`. Verify `aria-busy` qua `screen.getByRole("button").getAttribute("aria-busy")`.

- [ ] **Task 5: Implement `Toast` provider + hook + component** (AC: 2, 10, 11, 12)
  - [ ] 5.1 Tạo `frontend/src/components/Toast.tsx`. Public API:
    ```ts
    export type ToastTone = "success" | "warning" | "error" | "info";
    export interface ToastInput { tone: ToastTone; message: string; }
    export interface ToastContextValue { showToast: (input: ToastInput) => string; dismissToast: (id: string) => void; }
    export const ToastProvider: React.FC<{ children: React.ReactNode }>;
    export const useToast: () => ToastContextValue;
    ```
    State internally: `Array<{ id, tone, message }>` (max 3 entries enforced trong reducer). Auto-dismiss qua `useEffect(() => { setTimeout(... dismiss ..., 4000) }, [toasts])` — chỉ schedule cho non-`error` tones.
  - [ ] 5.2 Stack cap enforcement: trong `showToast`, nếu `state.length >= 3`, drop `state[0]` (FIFO) trước khi push toast mới. Dùng `useReducer` để dễ test logic này.
  - [ ] 5.3 `useToast` throw `new Error("useToast must be used within ToastProvider")` nếu context = `null` (default).
  - [ ] 5.4 Render `<ToastContainer>` qua portal vào `document.body`. Mỗi toast `role="status"` (`success | warning | info`) hoặc `role="alert"` (`error`).
  - [ ] 5.5 Tạo `frontend/src/components/Toast.css` với positioning + tone variants + slide-in animation. Use `@keyframes app-toast-slide-in`.
  - [ ] 5.6 Tạo `frontend/src/components/Toast.test.tsx` cover 5 cases AC-10:
    - (b) fake timer: `vi.useFakeTimers()`, `act(() => { vi.advanceTimersByTime(4000); })`, assert toast gone. Restore với `vi.useRealTimers()` trong `afterEach`.
    - (d) push 4 toasts với distinct messages, assert toast 1 (oldest) bị remove khỏi DOM.

- [ ] **Task 6: Implement `ConfirmationDialog`** (AC: 3, 10, 11, 12)
  - [ ] 6.1 Tạo `frontend/src/components/ConfirmationDialog.tsx`. Props:
    ```ts
    interface ConfirmationDialogProps {
      open: boolean;
      title: string;
      description?: string;
      confirmLabel: string;
      cancelLabel?: string;
      variant?: "destructive" | "primary";
      onConfirm: () => void | Promise<void>;
      onCancel: () => void;
    }
    ```
    Implementation: `useRef<HTMLDialogElement>(null)` + `useEffect` đồng bộ `open` ↔ `showModal()`/`close()`. Lắng nghe event `"close"` của `<dialog>` để gọi `onCancel()` (handles Esc + backdrop click + programmatic close).
  - [ ] 6.2 Render qua `ReactDOM.createPortal(dialog, document.body)`.
  - [ ] 6.3 Tạo `frontend/src/components/ConfirmationDialog.css`. Key rules:
    ```css
    .app-confirm-dialog::backdrop { background: rgba(0, 0, 0, 0.4); }
    .app-confirm-dialog { border: none; border-radius: var(--radius-lg); padding: var(--space-6); box-shadow: var(--shadow-lg); max-width: 480px; width: 90vw; }
    .app-confirm-dialog__title { font-size: var(--font-size-heading-m); font-weight: 600; color: var(--text-primary); margin: 0 0 var(--space-4); }
    .app-confirm-dialog__description { font-size: var(--font-size-body); color: var(--text-secondary); margin: 0 0 var(--space-6); }
    .app-confirm-dialog__footer { display: flex; justify-content: flex-end; gap: var(--space-3); }
    ```
  - [ ] 6.4 Tạo `frontend/src/components/ConfirmationDialog.test.tsx` cover 5 cases AC-10. Dùng `screen.getByRole("dialog")`. Lưu ý: JSDOM (version 24+) hỗ trợ HTMLDialogElement `showModal`/`close`/`returnValue`. Nếu test fail vì JSDOM thiếu support, polyfill bằng `HTMLDialogElement.prototype.showModal = function() { this.setAttribute("open", ""); };` trong `test-setup.ts` — verify trước khi áp dụng.

- [ ] **Task 7: Implement `StatusBadge`** (AC: 4, 10, 11, 12)
  - [ ] 7.1 Tạo `frontend/src/components/StatusBadge.tsx`. Props:
    ```ts
    import type { TaskStatus } from "../types/task";
    interface StatusBadgeProps { status: TaskStatus; size?: "sm" | "md" | "lg"; }
    ```
    Lookup table label + icon được hardcode trong `STATUS_DISPLAY` const trong file.
  - [ ] 7.2 Tạo `frontend/src/components/StatusBadge.css` với 9 variant classes:
    ```css
    .app-status-badge { display: inline-flex; align-items: center; gap: var(--space-1); border-radius: var(--radius-sm); border: 1px solid; font-weight: 500; }
    .app-status-badge--md { height: 24px; padding: 0 var(--space-2); font-size: 12px; }
    /* ... sm / lg ... */
    .app-status-badge--draft { background: var(--status-draft-bg); color: var(--status-draft-text); border-color: var(--status-draft-border); }
    /* ... 8 variants còn lại ... */
    .app-status-badge__dot--pulse { animation: app-status-pulse 1.5s infinite; }
    @keyframes app-status-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    ```
  - [ ] 7.3 Tạo `frontend/src/components/StatusBadge.test.tsx` cover 3 cases AC-10 (parameterize 9 status với `test.each`).

- [ ] **Task 8: Implement `AgentAvatar`** (AC: 5, 10, 11, 12)
  - [ ] 8.1 Tạo `frontend/src/components/AgentAvatar.tsx`. Helper functions internal:
    ```ts
    function getInitials(name: string): string {
      const tokens = name.trim().split(/[\s\-_]+/).filter(Boolean).slice(0, 2);
      return tokens.map((t) => t[0]!.toUpperCase()).join("");
    }
    function nameToHue(name: string): number {
      let hash = 0;
      for (const ch of name) hash = (hash + ch.charCodeAt(0)) % 360;
      return hash;
    }
    ```
    Dùng inline `style={{ background: `hsl(...)`, color: `hsl(...)` }}` cho dynamic color.
  - [ ] 8.2 Tạo `frontend/src/components/AgentAvatar.css` cho static layout (size variants, runtime overlay positioning, codex orange `#F97316`). Comment rõ:
    ```css
    /* Runtime overlay colors theo UX 8.2 — Codex orange #F97316 KHÔNG có entry trong tokens.css vì UX spec định nghĩa đây là runtime brand color, không phải status. Document trong Story 2.0 Dev Notes. */
    .app-agent-avatar__runtime--codex { background: #F97316; color: var(--text-inverse); }
    .app-agent-avatar__runtime--claude { background: var(--status-running-text); color: var(--text-inverse); }
    ```
  - [ ] 8.3 Tạo `frontend/src/components/AgentAvatar.test.tsx` cover 3 cases AC-10. Test `getInitials` riêng nếu export, hoặc qua component render output.

- [ ] **Task 9: Implement `SessionBadge`** (AC: 6, 10, 11, 12)
  - [ ] 9.1 Tạo `frontend/src/components/SessionBadge.tsx`. Props:
    ```ts
    import type { SessionState } from "../types/session";
    interface SessionBadgeProps { state: SessionState; }
    ```
    Lookup `STATE_DISPLAY: Record<SessionState, { label: string; ariaLabel: string }>`.
  - [ ] 9.2 Tạo `frontend/src/components/SessionBadge.css` với 4 variants (xem AC-6). Reuse `@keyframes app-status-pulse` nếu cùng định nghĩa? **KHÔNG** — keyframes scope global trong file riêng dễ collision. Định nghĩa lại `@keyframes app-session-pulse` (giống pattern) trong SessionBadge.css để mỗi component CSS self-contained.
  - [ ] 9.3 Tạo `frontend/src/components/SessionBadge.test.tsx` cover 2 cases AC-10 (4 variants + aria-label).

- [ ] **Task 10: Implement `TaskCard`** (AC: 7, 10, 11, 12)
  - [ ] 10.1 Tạo `frontend/src/components/TaskCard.tsx`. Props:
    ```ts
    import type { Task } from "../types/task";
    import type { SessionState } from "../types/session";
    interface TaskCardProps {
      task: Task;
      project: { key: string };
      agent: { name: string; runtime: "codex" | "claude" };
      sessionState: SessionState;
      commentsCount: number;
      lastActivity: string;
      onClick?: () => void;
    }
    ```
    Khi `onClick` truthy: set `role="button"`, `tabIndex={0}`, handle `onKeyDown` (Enter/Space → `onClick`).
  - [ ] 10.2 Compose AgentAvatar (size `sm`), SessionBadge.
  - [ ] 10.3 Tạo `frontend/src/components/TaskCard.css`:
    ```css
    .app-task-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: var(--space-3); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: var(--space-2); }
    .app-task-card--clickable:hover { box-shadow: var(--shadow-md); border-color: var(--border-strong); cursor: pointer; }
    .app-task-card__title { font-size: var(--font-size-body); font-weight: 500; color: var(--text-primary); margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    /* ... header row, footer row, project-tag styles ... */
    ```
  - [ ] 10.4 Tạo `frontend/src/components/TaskCard.test.tsx` cover 5 cases AC-10.

- [ ] **Task 11: Implement `EmptyState`** (AC: 8, 10, 11, 12)
  - [ ] 11.1 Tạo `frontend/src/components/EmptyState.tsx`. Props:
    ```ts
    interface EmptyStateProps {
      icon: string;
      heading: string;
      description?: string;
      ctaLabel?: string;
      onCtaClick?: () => void;
      variant?: "full" | "inline";
    }
    ```
    Dev-mode check: `if (import.meta.env.DEV && heading === "No data found") console.warn(...)`. KHÔNG throw production.
  - [ ] 11.2 Tạo `frontend/src/components/EmptyState.css` với 2 variant classes.
  - [ ] 11.3 Tạo `frontend/src/components/EmptyState.test.tsx` cover 4 cases AC-10.

- [ ] **Task 12: Wrap app với `ToastProvider`** (AC: 2, 11, 14)
  - [ ] 12.1 Mở `frontend/src/main.tsx`. Wrap `<App />` bằng `<ToastProvider>`:
    ```tsx
    <React.StrictMode>
      <BrowserRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    </React.StrictMode>
    ```
    Import path: `import { ToastProvider } from "./components/Toast";`.
  - [ ] 12.2 KHÔNG render bất kỳ Toast nào trong story này — chỉ wire provider. Story 2.1+ sẽ dùng `useToast()` để show feedback.

- [ ] **Task 13: Verify build, typecheck, tests** (AC: 9, 12, 13, 14)
  - [ ] 13.1 `cd frontend && npx tsc --noEmit` → exit 0.
  - [ ] 13.2 `npm run test` → exit 0, all tests pass.
  - [ ] 13.3 `npm run build` → exit 0, `frontend/dist/` tạo.
  - [ ] 13.4 `npm run dev` chạy nền. Browser visual check (Playwright qua CDP hoặc manual):
    - `/dashboard`, `/board`, `/random` vẫn render đúng AppShell layout (no regression — AC-14).
    - Console không có error (`React strict mode` không cảnh báo).
  - [ ] 13.5 Screenshot 1 trang showcase (nếu thuận tiện) hoặc note bằng tay rằng visual OK.

- [ ] **Task 14: Update docs** (AC: ngoài, harness rule)
  - [ ] 14.1 Update `docs/TEST_MATRIX.md` row Story 2.0:
    ```
    | 2.0 Shared UI Components | Button, Toast, ConfirmationDialog, StatusBadge, AgentAvatar, SessionBadge, TaskCard, EmptyState với accessible/tokens-only styles + Vitest setup | yes | no | no | no | implemented | npm run test passed; _bmad-output/implementation-artifacts/2-0-shared-ui-components.md |
    ```
    (Dev agent set `status = implemented` và update evidence lúc đóng story, KHÔNG ở story creation.)
  - [ ] 14.2 Update `docs/stories/backlog.md` row Story 2.0 từ `backlog | _bmad-output/implementation-artifacts/sprint-status.yaml` → `ready-for-dev | _bmad-output/implementation-artifacts/2-0-shared-ui-components.md`. (Story creation phase đã làm — dev agent chỉ cần xác nhận.)
  - [ ] 14.3 Cập nhật `_bmad-output/implementation-artifacts/sprint-status.yaml`:
    - `2-0-shared-ui-components: ready-for-dev` (story creation phase đã làm).
    - `epic-2: in-progress` (story creation phase đã làm).
    Dev agent chỉ verify, không cần update lại.

---

## Dev Notes

### CRITICAL: Không scaffold quá phạm vi Story 2.0

Story này CHỈ tạo 8 shared components + types + Vitest setup + wire ToastProvider. KHÔNG:
- Tạo `frontend/src/api/` — Story 2.1.
- Tạo `frontend/src/hooks/` — Story 2.2/2.3.
- Tạo `frontend/src/features/board/` hay `task-detail/` — Story 2.3/2.4.
- Tạo `frontend/src/types/project.ts`, `session.ts` (full Session model), `run.ts`, `comment.ts` — chỉ `task.ts` (minimal) + `session.ts` (`SessionState` only).
- Implement RunTimeline, ReviewFindingCard, DashboardSection — Story 3.x/4.x.
- Implement project color, agent runtime API, real session state polling — Story 2.1/3.x.
- Thêm dark mode tokens — pre-existing defer (Story 1.3 review).

AGENTS.md hard rule: "Không scaffold thêm application source folders ... trừ khi một selected story rõ ràng yêu cầu". Story 2.0 yêu cầu rõ `frontend/src/components/` (đã có từ 1.4) và `frontend/src/types/` (chưa có, story này tạo).

### Stack & versions

| Package | Lý do | Phạm vi version |
|---|---|---|
| `vitest` | Test framework (architecture line 137) | Latest stable trên npm registry tại thời điểm dev execute |
| `@testing-library/react` | React 19 compatibility — verify peer dep accepts `react@19` trước install. Nếu RTL latest chưa support React 19, dùng `@testing-library/react@^16` (đã ship React 18 + 19 support). | Latest, với verify React 19 compat |
| `@testing-library/jest-dom` | Custom matchers (`toBeInTheDocument`, etc.) | Latest |
| `@testing-library/user-event` | User interaction helpers (preferred over fireEvent) | Latest |
| `jsdom` | Browser-like env cho Vitest | Latest |

**KHÔNG add:**
- `happy-dom` (alternative jsdom — architecture chốt jsdom).
- `@vitest/coverage-v8` — coverage không phải AC; defer.
- `playwright` / `cypress` — E2E không phải scope Story 2.0.
- Storybook — không trong architecture, không trong epic.

**Version pinning policy:** Story 2.0 KHÔNG pin version cụ thể (theo pattern Story 1.3 vs registry reality — pin trước có thể gây error nếu version không tồn tại). Dev agent verify version mới nhất bằng `npm view vitest version` trước khi install.

### Tokens reference từ Story 1.3

`frontend/src/styles/tokens.css` đã định nghĩa:
- Neutrals: `--bg-app`, `--bg-card`, `--bg-hover`, `--border`, `--border-strong`, `--text-primary`, `--text-secondary`, `--text-disabled`, `--text-inverse`.
- Brand: `--brand-primary`, `--brand-hover`, `--brand-light`.
- 9 status triples + 1 paused alias: `--status-{name}-{bg,text,border}` cho `draft, ready, assigned, running, paused, needs-review, changes-requested, completed, failed, cancelled`.
- Spacing: `--space-1` (4px) → `--space-12` (48px).
- Radius: `--radius-sm` (4px) → `--radius-xl` (16px).
- Shadow: `--shadow-sm | -md | -lg | -focus`.
- Font: `--font-family-sans | -mono`, `--font-size-{heading-l, heading-m, heading-s, body, body-s, caption, mono}` + matching `--line-height-*`.

**Quan trọng:** Story 2.0 **chỉ dùng** tokens này — KHÔNG thêm token mới vào `tokens.css`. Nếu cần value không có (như Codex orange `#F97316`), inline trong component CSS với comment giải thích nguồn UX spec (xem AC-5 + Task 8.2).

### `<dialog>` vs custom modal — decision

Story 2.0 chốt dùng native `<dialog>` HTML element thay vì custom modal với focus-trap library vì:
1. **Browser-native focus trap** — không cần `focus-trap-react` hay `react-focus-lock` dependency.
2. **Native Esc key handling** — Browser tự dispatch `close` event khi user nhấn Esc.
3. **Backdrop pseudo-element** — `::backdrop` CSS selector handle backdrop styling natively.
4. **Accessibility built-in** — `<dialog>` đã có ARIA role implicit; chỉ cần `aria-labelledby` + `aria-describedby`.
5. **No extra dependencies** — architecture chốt "tránh UI library", `<dialog>` là HTML5 standard (Chrome 37+, Firefox 98+, Safari 15.4+ — đã GA toàn bộ MVP target browser).

**JSDOM caveat:** `jsdom@24+` hỗ trợ `HTMLDialogElement.showModal()`. Nếu test fail (assert `dialog.open === true` không hoạt động) → kiểm tra version `jsdom` trong `package.json`. Workaround tạm thời: polyfill trong `test-setup.ts`:
```ts
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
}
```
Dev agent verify JSDOM version trước; chỉ polyfill nếu cần.

### CSS Module vs plain `.css` — convention

Story 1.4 đã chốt **plain `.css`** file cạnh component (`AppShell.css`, không phải `AppShell.module.css`). Story 2.0 follow chính xác convention này. Tránh class collision bằng:
- Mỗi component dùng prefix riêng: `app-button-*`, `app-toast-*`, `app-confirm-dialog-*`, `app-status-badge-*`, `app-agent-avatar-*`, `app-session-badge-*`, `app-task-card-*`, `app-empty-state-*`.
- BEM-like: `block__element--modifier`.

**Không** dùng CSS Modules (`*.module.css`) trong story này — Vite hỗ trợ nhưng project chưa adopt pattern này (precedent từ AppShell).

### TypeScript strict patterns đáng nhớ

| Pattern | Lý do |
|---|---|
| `import type { Foo } from "./bar"` (không `import { type Foo }`) | `verbatimModuleSyntax: true` enforce |
| `const TaskStatus = { Draft: "draft", ... } as const; type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus]` | `erasableSyntaxOnly: true` không cho phép TS `enum` |
| `function foo(_event: MouseEvent)` khi không dùng param | `noUnusedParameters: true` enforce |
| `<button type="button">` mặc định | TS không enforce nhưng default browser type là `submit` — gây bug khi nest trong `<form>` |
| `useRef<HTMLDialogElement>(null)` rồi guard `dialogRef.current?.showModal()` | Strict null check |
| `as const satisfies Record<TaskStatus, ...>` cho lookup table | Giữ literal type + verify completeness |

### Test pattern (RTL + user-event)

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import Button from "./Button";

describe("Button", () => {
  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("blocks click when loading", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("aria-busy", "true");
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

**Quy ước:**
- `userEvent.setup()` ở đầu mỗi test (KHÔNG ở `beforeEach` cấp suite — userEvent docs khuyến cáo).
- Prefer `screen.getByRole(...)` > `getByLabelText` > `getByText` > `getByTestId`.
- Dùng `data-testid` chỉ khi role + label không phân biệt được.
- Fake timers cho Toast auto-dismiss:
  ```ts
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  ```

### Toast — chi tiết state machine

```
state: Array<{ id: string, tone: ToastTone, message: string }>

action SHOW_TOAST { tone, message }:
  newId = crypto.randomUUID()
  if state.length >= 3:
    state = state.slice(1)  // drop oldest (FIFO)
  state = [...state, { id: newId, tone, message }]
  return newId

action DISMISS_TOAST { id }:
  state = state.filter(t => t.id !== id)

side effect (sau SHOW_TOAST):
  if tone !== "error":
    setTimeout(() => dispatch(DISMISS_TOAST, id), 4000)
    return cleanup() => clearTimeout(...)
```

**Lưu ý:** `crypto.randomUUID()` available trong browser + JSDOM. Nếu lo về compat, dùng counter increment (`let _idCounter = 0; const newId = String(++_idCounter)`). Verify JSDOM hỗ trợ trước.

### ConfirmationDialog — sync `open` ↔ dialog

```tsx
const dialogRef = useRef<HTMLDialogElement>(null);

useEffect(() => {
  const dialog = dialogRef.current;
  if (!dialog) return;
  if (open && !dialog.open) {
    dialog.showModal();
  } else if (!open && dialog.open) {
    dialog.close();
  }
}, [open]);

useEffect(() => {
  const dialog = dialogRef.current;
  if (!dialog) return;
  const handleClose = () => onCancel();
  dialog.addEventListener("close", handleClose);
  return () => dialog.removeEventListener("close", handleClose);
}, [onCancel]);
```

**Gotcha:** Khi `onConfirm` được gọi, KHÔNG tự `dialog.close()` — caller chịu trách nhiệm gọi `setOpen(false)` nếu confirm thành công, hoặc giữ dialog mở nếu cần show error. Document trong JSDoc.

### AgentAvatar — hardcode hex exception

Story 2.0 phá rule "không hardcode hex ngoài tokens.css" tại đúng 1 nơi: **Codex CLI orange `#F97316`** trong `AgentAvatar.css`. Lý do:
- UX spec section 8.2 chỉ định `⚙ Codex CLI (orange)` và `✦ Claude CLI (violet)` — Codex orange là runtime brand color, không phải status color.
- `tokens.css` của Story 1.3 chỉ có 9 status triples + brand indigo + neutrals — không có entry cho runtime brand.
- Adding `--runtime-codex-orange: #F97316` vào `tokens.css` là scope creep (Story 1.3 tokens đã merge, sửa tokens cần spec-driven decision).
- Claude violet dùng được `var(--status-running-text)` (#6D28D9) — đã match — không cần hex.

**Decision tạm:** Inline `#F97316` trong `AgentAvatar.css` với comment rõ. Nếu future story thêm runtime nữa (Aider, Cursor, etc.), mở `docs/decisions/` cho runtime color system. KHÔNG mở rộng pattern này sang component khác.

### Spec Gap đã phát hiện (ghi nhận để decision sau)

| Gap | Nguồn | Quyết định tạm | Story xử lý |
|---|---|---|---|
| Epic 2.0 AC liệt kê StatusBadge có 10 variants ("Draft/Ready/Assigned/Running/Paused/NeedsReview/ChangesRequested/Completed/Failed/Cancelled") nhưng UX 8.1 + tokens.css chỉ có 9 (không có Paused entry riêng) | `_bmad-output/planning-artifacts/epics.md` line 349 vs `_bmad-output/planning-artifacts/ux-design-specification.md` line 921 vs `frontend/src/styles/tokens.css` (`--status-paused-*` là alias) | Story 2.0 implement **9 variants** (không có `paused` prop). Architecture task lifecycle có Paused status nhưng UI badge có thể reuse Running visual (token alias đã làm). Khi Story 2.4 cần render Paused task, gọi `<StatusBadge status="running" />` hoặc thêm `paused` prop alias sau. | Nếu Story 2.2/2.3/2.4 cần phân biệt Paused vs Running visually, mở `docs/decisions/` mới |
| TaskCard AC liệt kê "AgentAvatar chip" + "SessionBadge" nhưng UX 4.2 card mô tả thêm `[Runtime badge]` row separator | `_bmad-output/planning-artifacts/epics.md` line 364 vs `_bmad-output/planning-artifacts/ux-design-specification.md` line 407 | AgentAvatar đã có runtime overlay badge (UX 8.2) — đủ thông tin runtime. KHÔNG render RuntimeBadge inline trong TaskCard Story 2.0. Nếu Story 2.3 (Kanban) hoặc Story 2.4 (Detail Panel) cần RuntimeBadge standalone, tạo file riêng `frontend/src/components/RuntimeBadge.tsx`. | Story 2.3 hoặc 2.4 (assess sau) |
| Epic AC mention "findings count" trong TaskCard footer nhưng Story 2.0 scope không có `findings` model | `_bmad-output/planning-artifacts/ux-design-specification.md` line 409, 422 | TaskCard Story 2.0 chỉ render `commentsCount + lastActivity`. Findings = Story 3.5b (Review tab). Khi TaskCard cần findings count, extend props trong Story 3.5b. | Story 3.5b |
| `lastActivity` formatting (vd "2h ago", "12m") — UX show literal "2h" nhưng nguồn data là timestamp | UX 4.2 card example | TaskCard nhận `lastActivity: string` đã format — caller chịu trách nhiệm format. Story 2.0 KHÔNG implement time formatter helper. | Story 2.3 (Kanban) sẽ implement `formatRelativeTime(date: Date): string` trong `frontend/src/utils/` |
| Toast 4s auto-dismiss với non-error nhưng `info` tone (UX 1714) sometimes có "kèm CTA button" | UX 1718 | Story 2.0 Toast KHÔNG hỗ trợ action button trong toast (chỉ message + dismiss). Nếu Story 2.x cần action toast, extend `ToastInput` với optional `action: { label, onClick }`. | Story 3.5a (resume toast với "View task" link) |

KHÔNG fix các gap này trong Story 2.0 — chỉ document để dev agent biết và pick up trong story sau.

### Cross-story dependencies

Story 2.0 là **prerequisite** cho:
- **Story 2.1 (Project Management):** Cần `Button` (Create Project CTA), `ConfirmationDialog` (delete project), `EmptyState` ("No projects yet"), `useToast` (success/error feedback). `Depends on: Story 2.0` — epics.md line 378.
- **Story 2.2 (Task CRUD & Agent Assignment):** Cần `Button`, `ConfirmationDialog` (delete task), `useToast`, `Task` + `TaskStatus` types, `AgentAvatar` (assign agent dropdown selected display).
- **Story 2.3 (Task Board Kanban View):** Cần `TaskCard`, `StatusBadge` (column header), `SessionBadge`, `EmptyState` (column empty + board empty), `AgentAvatar`.
- **Story 2.4 (Task Detail Panel):** Cần `StatusBadge` (lg size), `SessionBadge`, `AgentAvatar` (lg), `Button` variants, `ConfirmationDialog` (close task, delete, reassign).
- **Story 3.x:** Cần `Button`, `useToast`, `StatusBadge` (Running pulse), `SessionBadge` (Active/Resumable transitions).
- **Story 4.x:** Cần `EmptyState`, `Button`, `StatusBadge`.

**Nếu Story 2.0 chưa merge:** KHÔNG story nào trong Epic 2/3/4 frontend được phép bắt đầu, vì sẽ phải reinvent các component và tạo CSS divergence.

### Learnings từ Story 1.3 + 1.4

| Learning | Tác động đến Story 2.0 |
|---|---|
| `tokens.css` import qua `global.css` đã global cho mọi component | Story 2.0 component CSS file CHỈ dùng `var(--*)`, KHÔNG re-import tokens |
| Vite 8.0.13 (latest verified 2026-05-21), không phải Vite 9 | Vitest cần version compat với Vite 8 — `vitest@^2` có thể conflict; verify với `npm view vitest peerDependencies` trước install |
| React Router v7 imports từ `"react-router"` (không `"react-router-dom"`) | Story 2.0 KHÔNG import React Router — chỉ wrap ToastProvider. Nếu cần test component dùng `<NavLink>` (none trong story này), import từ `"react-router"` |
| AppShell dùng plain `.css` cạnh component, prefix `app-shell-*` | Story 2.0 follow chính xác — prefix `app-{component-name}-*` |
| TS strict + `verbatimModuleSyntax` + `erasableSyntaxOnly` + `noUnusedLocals` + `noUnusedParameters` enforce trong `tsconfig.app.json` | Story 2.0 TUÂN THỦ — đặc biệt `erasableSyntaxOnly` cấm `enum` (xem AC-12) |
| Story 1.4 không có Vitest setup (test framework là "thêm thủ công" theo architecture line 137) | Story 2.0 là story đầu tiên adopt Vitest. Tasks 1-2 phải làm sạch sẽ vì các story sau dựa vào setup này |
| Backend dùng `127.0.0.1:8080` (không `localhost`) | KHÔNG ảnh hưởng Story 2.0 — không touch network code |
| `.gitignore` đã cover `node_modules/`, `frontend/dist/`, `frontend/.vite/` | KHÔNG sửa `.gitignore` |
| Đã có `frontend/src/components/AppShell.css|tsx`, `Sidebar.tsx`, `TopBar.tsx` | Story 2.0 ADD file mới, KHÔNG sửa file Story 1.4 |
| Vite proxy rewrite `/api` → `/` ở dev (Story 1.3 + 1.4 review fix) | KHÔNG sửa `vite.config.ts.server.proxy` — chỉ thêm `test:` block |

### Git intelligence — recent commits trên `main`

Recent merged work (theo workspace info + repo state):
- Story 1.4 (PR #2) — AppShell layout + React Router v7.
- Story 1.3 (PR #1) — Vite + React + design tokens.
- Epic 1 retro (`epic-1-retro-2026-05-21.md`).

Convention từ các PR này:
- Branch name: `devin/<timestamp>-story-X-Y-<slug>`.
- Commit messages: `docs(bmad): create story X.Y - <Title>` cho story creation PR; `feat(...)`, `chore(...)` cho dev-story implementation.
- Trailers (do harness append): "Session-Url", "Requested-By" — không cần dev tự thêm.

### Manual visual check sau khi implement

```bash
cd frontend
npm install
npx tsc --noEmit
# Expect: exit 0

npm run test
# Expect: all pass, exit 0

npm run build
# Expect: dist/ created, exit 0

npm run dev
# Expect: "Local: http://localhost:5173/"

# Browser manual check:
# 1. http://localhost:5173/ → redirect /dashboard, layout OK (Story 1.4 regression check)
# 2. http://localhost:5173/board → BoardRoute placeholder, layout OK
# 3. http://localhost:5173/random-route → NotFound page, layout OK
# 4. DevTools Console → no React warnings, no unhandled errors
```

Story 2.0 KHÔNG mount component nào vào route — chỉ wire ToastProvider. Visual check là regression-only.

### Project Structure Notes

- **Boundary:** `frontend/src/components/` chứa cả layout component (AppShell, Sidebar, TopBar từ Story 1.4) và shared UI (Story 2.0). Architecture line 450-459 chốt pattern này. **KHÔNG** tạo sub-folders như `components/ui/`, `components/layout/`, `components/badges/` — flat structure giữ import path ngắn.
- **`frontend/src/types/` mới tạo trong story này** — chỉ chứa primitive types dùng cho component props (Task, TaskStatus, SessionState). Domain types đầy đủ (Project, Run, Comment, full Session model) thuộc story API sau (2.1+).
- **CSS file naming:** `Foo.tsx` ↔ `Foo.css` (cùng tên gốc, lowercase extension). Import: `import "./Foo.css";` ở đầu component file, sau imports khác. Vite tự bundle CSS vào single stylesheet ở build.
- **Test file naming:** `Foo.tsx` ↔ `Foo.test.tsx`. Vitest default pattern match.
- **No barrel file (`index.ts`)** trong `components/` — explicit import path (`import Button from "./components/Button"`) tốt hơn cho tree-shaking + IDE jump-to-definition.
- **`test-setup.ts`** đặt tại `frontend/src/`, không trong `frontend/` root, để Vitest pick up đúng working dir của TypeScript project.

### References

- **UX Design Spec:** `_bmad-output/planning-artifacts/ux-design-specification.md` — Section 1.2 (Visual System), 1.3 (Spacing/Radius/Elevation), 8 (Component Library 8.1–8.8), 9 (Empty States), 18 (Component Strategy)
- **Architecture:** `_bmad-output/planning-artifacts/architecture.md` — Section "Frontend (create-vite react-ts)" line 130-141 (Vitest + RTL "thêm thủ công"), "Project Structure" line 415-484 (folder layout), "Enforcement Guidelines" line 396-411 ("không hardcode hex")
- **Epics:** `_bmad-output/planning-artifacts/epics.md` — Story 2.0 Acceptance Criteria (line 322-371)
- **Previous Story 1.3:** `_bmad-output/implementation-artifacts/1-3-frontend-scaffold-and-design-tokens.md` — design tokens reference, CSS file convention
- **Previous Story 1.4:** `_bmad-output/implementation-artifacts/1-4-appshell-layout-and-routing.md` — component file convention (`.css` next to `.tsx`), BEM prefix pattern, React Router import path
- **Project Context:** `_bmad-output/project-context.md` — TypeScript strict (line 41), Vitest + RTL (line 76-79), CSS variables (line 91), naming (line 87-89), accessibility (architecture line 83)
- **Tokens:** `frontend/src/styles/tokens.css` — single source of truth cho color/spacing/radius/shadow/font values
- **Harness:** `AGENTS.md` — Source of truth ordering, "Không scaffold thêm folder trừ khi story yêu cầu"

---

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

### Review Findings

- [x] [Review][Patch] Toast auto-dismiss timer resets whenever the toast stack changes [frontend/src/components/Toast.tsx:90]
- [x] [Review][Patch] Toast removes items immediately and does not implement the required 150ms fade-out [frontend/src/components/Toast.css:14]
- [x] [Review][Patch] ConfirmationDialog does not implement backdrop click = Cancel [frontend/src/components/ConfirmationDialog.tsx:70]
- [x] [Review][Patch] ConfirmationDialog calls `onCancel` when the parent closes the dialog after a successful confirm [frontend/src/components/ConfirmationDialog.tsx:42]
- [x] [Review][Patch] ConfirmationDialog `onConfirm` does not receive the click event argument required by AC-3 [frontend/src/components/ConfirmationDialog.tsx:18]
- [x] [Review][Patch] Button `ghost` variant still reserves a transparent border despite AC-1 requiring no border [frontend/src/components/Button.css:42]
- [x] [Review][Patch] TaskCard `project` prop omits optional `color?: string` from the AC-7 public contract [frontend/src/components/TaskCard.tsx:10]
- [x] [Review][Patch] Toast tests use `fireEvent.click` for user interactions despite AC-10 requiring `@testing-library/user-event` [frontend/src/components/Toast.test.tsx:1]
- [x] [Review][Patch] TaskCard handles Space on `keydown`, so holding Space can trigger `onClick` repeatedly [frontend/src/components/TaskCard.tsx:29]
