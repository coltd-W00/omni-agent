# Story 4.3: Responsive Layout

Status: ready-for-dev

<!-- Validation tùy chọn — chạy validate-create-story trước khi dev-story nếu muốn double-check. -->

**Epic:** 4 — Dashboard & Operational Visibility
**Story ID:** 4.3
**Story Key:** 4-3-responsive-layout
**Lane:** normal — frontend-only, KHÔNG thêm public API contract mới, KHÔNG đổi DB schema, KHÔNG đụng `backend/`. Toàn bộ thay đổi nằm ở React component layer (3 hook mới + 1 component mới + 1 context mới) + CSS layer (media queries thêm vào existing files). Blast radius: NEW `frontend/src/hooks/useMediaQuery.ts`, NEW `frontend/src/hooks/useBreakpoint.ts`, NEW `frontend/src/components/MobileFallback.tsx` + `MobileFallback.css`, NEW `frontend/src/contexts/SidebarDrawerContext.tsx`, UPDATE 7 file hiện hữu để thêm responsive behavior (`AppShell.tsx`, `AppShell.css`, `Sidebar.tsx`, `TopBar.tsx`, `TaskDetailPanel.tsx`, `TaskDetailPanel.css`, `TaskBoard.css`, `KanbanColumn.css`). Tổng UPDATE 8 file. Risk flags: 2 (mount global `window.matchMedia` listener ở `AppShell` — must cleanup; thay đổi positioning của `TaskDetailPanel` từ `fixed` sang flex layout ở Desktop L có thể ảnh hưởng tab order / focus trap đã wire ở Story 4.2). **2 flags → normal.**

**Depends on:**
- Story 1.3 (Frontend Scaffold & Design Tokens) — phải hoàn thành (status `done`); story 4.3 reuse `--space-*`, `--bg-card`, `--bg-app`, `--border`, `--brand-primary`, `--text-primary`, `--text-secondary`, `--text-disabled`, `--radius-*`, `--shadow-focus`, `--shadow-md`, `--shadow-lg` tokens ở `frontend/src/styles/tokens.css`.
- Story 1.4 (AppShell Layout & Routing) — phải hoàn thành (status `done`); story 4.3 UPDATE `AppShell.tsx` (thêm `SidebarDrawerProvider` wrap + mount `MobileFallback` + Outlet/Sidebar rendering conditional) và `AppShell.css` (thêm media queries cho `.app-shell__body`, `.app-shell__main`, `.app-sidebar`).
- Story 2.0 (Shared UI Components) — phải hoàn thành (status `done`); reuse `Button` component cho hamburger menu trigger + drawer close button (variant=`ghost`, size=`sm`).
- Story 2.3 (Task Board Kanban) — phải hoàn thành (status `done`); UPDATE `frontend/src/features/board/TaskBoard.css` (đã có `overflow-x: auto` ở dòng 9) + `KanbanColumn.css` (đổi `width: 280px` dòng 2 → `min-width: 240px; width: 280px;` để columns scroll ngang tại Desktop S theo AC-6).
- Story 2.4 (Task Detail Panel) — phải hoàn thành (status `done`); UPDATE `TaskDetailPanel.tsx` (backdrop conditional render based on breakpoint) + `TaskDetailPanel.css` (media queries: push layout ≥1440px, overlay 1024–1439px, full-width <1024px).
- Story 4.1 (Morning Dashboard) — **PHẢI done trước khi dev story 4.3** (status hiện `ready-for-dev`); story 4.3 UPDATE `frontend/src/features/dashboard/Dashboard.css` (sẽ được tạo ở 4.1) để thêm `grid-template-columns: repeat(auto-fit, minmax(300px, 1fr))` cho section cards reflow theo AC-7. Nếu 4.1 chưa done, dev agent phải HALT và yêu cầu hoàn thành 4.1 trước (KHÔNG tự tạo `Dashboard.css` để workaround).
- Story 4.2 (Accessibility & Keyboard Shortcuts) — **KHUYẾN KHÍCH** done trước khi dev story 4.3 (status hiện `ready-for-dev`); story 4.3 reuse `useFocusTrap` hook từ 4.2 cho sidebar drawer focus management theo AC-4. Nếu 4.2 chưa done, dev agent phải HALT — vì re-implement focus trap trong 4.3 sẽ duplicate code và conflict với 4.2 khi nó merge sau.

**Out of scope (defer to follow-up):**
- **Mobile <768px full support** — chỉ render fallback message theo AC-5 epics, KHÔNG implement responsive UI cho mobile. Sidebar/Board/Detail Panel layouts không cần optimize cho mobile. UX spec dòng 1810 và 1812 đã ghi rõ "Out of scope cho MVP".
- **Sidebar drawer animation** — slide-in từ trái với transition, hamburger icon morph thành `X` khi mở. AC-4 chỉ require "drawer opens" — implement transition CSS đơn giản (`transform: translateX(-100%)` → `translateX(0)`, 200ms ease) nhưng KHÔNG morph icon, KHÔNG add framer-motion. Defer animation polish cho story UX/CSS refresh sau.
- **`Sidebar.tsx` tooltips ở icon-only mode (Desktop S)** — AC-3 epics yêu cầu "hovering/clicking a sidebar icon shows a tooltip with the nav item label". Story 4.3 implement bằng **native `title` attribute** (browser-native tooltip với delay mặc định ~700ms). Custom tooltip component với Indigo background + 4px offset (UX spec dòng 1752 nếu có) defer cho story tooltip dedicated. Native `title` đủ pass AC-3.
- **Drawer click-outside-to-close** — AC-4 chỉ require drawer "opens via a hamburger menu". Story 4.3 implement Escape key đóng drawer (reuse pattern Story 2.4 TaskDetailPanel) + tap backdrop đóng drawer. KHÔNG implement click-on-nav-item-auto-close (sẽ làm sau).
- **Responsive Topbar layout** — UX spec section 2.3 mô tả Topbar có Project Switcher + Breadcrumb + Search + New Task button + Notification + Avatar, nhưng hiện tại TopBar chỉ có brand + `+ New Task`. Story 4.3 chỉ thêm hamburger menu button ở Topbar bên trái (visible chỉ tại Tablet breakpoint), KHÔNG re-layout TopBar.
- **Resize transitions / smooth viewport changes** — KHÔNG implement smooth animation khi user kéo viewport qua breakpoint. CSS media queries snap layout instantly.
- **`prefers-reduced-motion` cho responsive transitions** — defer (chung scope cho story UX/CSS refresh sau).
- **Multi-tab / multi-window state sync cho drawer** — drawer open state là per-tab local state, KHÔNG sync.
- **Server-side rendering responsive defaults** — frontend là CSR-only (`<Outlet />` + React Router 7), KHÔNG có SSR layer. `useMediaQuery` initial state default `false` ở SSR, sau hydrate updated qua `useEffect` (xem Dev Notes §"useMediaQuery SSR-safety").
- **Sidebar collapsed state persistence (localStorage)** — Story 4.3 KHÔNG persist sidebar collapsed state qua localStorage. Mặc định compute từ viewport mỗi lần mount. User collapse/expand manually defer scope.
- **Print stylesheet (@media print)** — out of scope cho MVP.
- **High-DPI / zoom-level handling** — `window.matchMedia` đã handle DPR transparently; KHÔNG cần extra logic.

---

## Story

As a developer using omni-agent,
I want the app layout to adapt gracefully to different screen sizes,
So that the app works well from large desktop monitors down to smaller laptop screens.

---

## Acceptance Criteria

> **Nguồn gốc AC:** `_bmad-output/planning-artifacts/epics.md` Story 4.3 (dòng 854–894) + Epic 4 framing (dòng 749–751) + UX-DR20 (dòng 125, 171) + NFR-6 (dòng 58). `_bmad-output/planning-artifacts/ux-design-specification.md` §"Responsive Strategy" + §"Breakpoints" (dòng 1790–1812), §"Layout Adaptation Rules" (dòng 1814–1818), §"Touch targets (Tablet)" (dòng 1844). `_bmad-output/project-context.md` §"Critical Implementation Rules" → React/Layout rules. Conventions: kebab-case CSS variables, semantic HTML5 (`<nav>`, `<aside>`, `<main>`, `<dialog>` cho drawer), CSS `@media (min-width: …)` mobile-first cascade, `window.matchMedia` cho JS-side breakpoint detection.

---

**AC-1 — Detail Panel push layout tại Desktop L (≥1440px) (UX-DR20, epics AC §"Given a viewport ≥ 1440px"):**

**Given** viewport width ≥ 1440px (Desktop L)
**When** Task Detail Panel `isOpen === true` (user click TaskCard, `useTaskDetail.openTask()` đã fire)
**Then** panel **push** main content area, KHÔNG overlay. Main content shrinks (flex-grow giảm) để accommodate panel width 420px.

**And** layout achieved bằng CSS:
- `.app-shell__body` giữ `display: flex` (hiện tại ở `AppShell.css:9–13`).
- Khi panel mở (CSS class `.app-shell--detail-open` thêm vào `.app-shell` root): `.app-shell__main` `padding-right: 420px` (push effect không cần thay đổi `flex` của panel) **hoặc** thay strategy: panel có `position: static; flex: 0 0 420px;` (NOT `position: fixed`) tại media query `@media (min-width: 1440px)`. **Lựa chọn approach:** Approach 2 (panel as flex item) — cho phép browser tự reflow main area, KHÔNG cần JS-driven padding logic.
- Sidebar giữ full width 220px (KHÔNG đổi).

**And** backdrop element (`.task-detail-panel__backdrop`) **KHÔNG render** tại Desktop L (push mode không có overlay → backdrop = không cần). Component conditional: `breakpoint === "desktop-l" ? null : <div className="task-detail-panel__backdrop" .../>`.

**And** entry animation slide-in từ phải (existing `task-detail-panel-slide-in` keyframes ở `TaskDetailPanel.css:31–38`) vẫn áp dụng. **Lưu ý:** `position: static` + `transform: translateX(100%)` initial state KHÔNG hoạt động với flex-item (panel chiếm width nhưng visually translated). Solution: wrap panel content trong `<div className="task-detail-panel__inner">` và áp animation lên inner element. **Chi tiết implementation trong Task D.2.3.**

**Test verification:** Vitest test mock `window.matchMedia` returning matches for `min-width: 1440px`, mount `<AppShell>` + open TaskDetailPanel qua context → assert (a) backdrop DOM **không** present; (b) `.app-shell` có class `app-shell--detail-open`; (c) panel render trong DOM tree main flow (kiểm computed `position` ≠ `fixed` qua `getComputedStyle`).

---

**AC-2 — Detail Panel overlay layout tại Desktop M (1280–1439px) (UX-DR20, epics AC §"Given a viewport between 1280px and 1439px"):**

**Given** viewport width ∈ [1280, 1440) (Desktop M)
**When** Task Detail Panel `isOpen === true`
**Then** panel **overlay** main content. Backdrop visible với `background: rgba(0, 0, 0, 0.30)` (30% opacity per AC).

**And** layout achieved bằng CSS:
- `.task-detail-panel` giữ `position: fixed; top: 0; right: 0; bottom: 0; width: 420px;` (hiện tại defaults).
- `.task-detail-panel__backdrop` render với `background: rgba(0, 0, 0, 0.30);` (override `background: transparent` hiện tại ở `TaskDetailPanel.css:10`). Override qua media query — base CSS giữ transparent (Desktop L tránh visible backdrop), tại `@media (max-width: 1439px)` thêm `background: rgba(0, 0, 0, 0.30);`.
- Sidebar giữ full width 220px (KHÔNG đổi).

**And** click vào backdrop đóng panel (đã wire ở Story 2.4 — `onClick={closeTask}` ở `TaskDetailPanel.tsx:174`). KHÔNG đụng handler này.

**And** focus trap ở panel (Story 4.2 sẽ wire qua `useFocusTrap`) hoạt động bình thường — focus đang ở element trong panel KHÔNG bị Tab escape ra ngoài.

**Test verification:** Mock matchMedia cho viewport 1280px, mount + open panel → assert (a) backdrop DOM present + computed `background-color` ≠ transparent; (b) panel computed `position` === `fixed`.

---

**AC-3 — Sidebar icon-only mode tại Desktop S (1024–1279px) (UX-DR20, epics AC §"Given a viewport between 1024px and 1279px"):**

**Given** viewport width ∈ [1024, 1280) (Desktop S)
**When** AppShell render (page load HOẶC viewport resize từ Desktop M xuống)
**Then** sidebar collapses to icon-only mode (width: 48px theo UX spec dòng 1798).

**And** layout achieved bằng CSS:
- `.app-sidebar` base width 220px (hiện tại `AppShell.css:48`).
- Media query `@media (max-width: 1279px) and (min-width: 1024px)`: `.app-sidebar` `width: 48px;`.
- Nav item labels `.app-sidebar__item` ẩn text (chỉ hiện icon hoặc 1 char fallback) qua CSS:
  - `.app-sidebar__item__label` (NEW span wrapping text): `display: none;` ở icon-only mode.
  - `.app-sidebar__item__icon` (NEW span wrapping icon char) vẫn display.
- Section headers (UPPERCASE TASKS / AGENTS / PROJECT) — hiện tại Sidebar chỉ có "Dashboard" + "All Tasks" (KHÔNG có section headers), nên KHÔNG cần ẩn. Khi section headers được add trong story sau (UX section 2.2), pattern là cùng `.app-sidebar__section-header { display: none; }` tại icon-only mode.
- ProjectSwitcher (`frontend/src/features/project/ProjectSwitcher.tsx`) — width đang `calc(100% - 24px)` (24px = 2 × `--space-3`); tại icon-only mode set `display: none` (KHÔNG có space hiển thị dropdown). Khi user click hamburger ở Desktop S (NEW behavior cho 4.3) → switch sang **drawer mode** giống Tablet (xem AC-4 drawer cũng dùng ở Desktop S khi user collapse manually). **NOTE:** Story 4.3 KHÔNG implement manual collapse toggle ở Desktop S — sidebar tự collapse theo viewport. Manual toggle defer story sau.

**And** mỗi nav item có **`title` attribute** = nav item label (browser-native tooltip). Native `title` đủ pass AC "hovering/clicking a sidebar icon shows a tooltip with the nav item label" (xem Out of scope cho rationale).
- `<NavLink to="/dashboard" title="Dashboard" ...>` (cần ensure `title` đến full `<a>` element, KHÔNG bị React Router ăn mất prop — verify với test).

**And** Detail Panel vẫn overlay (KHÔNG push) tại Desktop S — panel `position: fixed` (giống AC-2 Desktop M).

**And** Avatar placeholder ở bottom sidebar (`.app-sidebar__avatar` `AppShell.css:126–131`): tại icon-only mode chỉ hiện circle 32px (`.app-sidebar__avatar-circle`), ẩn label text (KHÔNG có label text hiện tại ở avatar — nhưng future-proof CSS rule).

**Test verification:** Mock matchMedia cho viewport 1024px, mount + assert (a) sidebar computed `width === "48px"`; (b) NavLink text labels có computed `display: none` (qua wrapping span); (c) `<NavLink>` có DOM attribute `title="Dashboard"`.

---

**AC-4 — Sidebar drawer mode tại Tablet (768–1023px) (UX-DR20, epics AC §"Given a viewport between 768px and 1023px"):**

**Given** viewport width ∈ [768, 1024) (Tablet)
**When** AppShell render
**Then** sidebar **ẩn mặc định** (NOT mounted in flex flow), thay vào đó hamburger menu button hiện ở TopBar góc trái.

**And** layout achieved bằng:
- `.app-sidebar` CSS `@media (max-width: 1023px)`: `display: none;` (default state — sidebar không occupy flex flow).
- Hamburger button (NEW `.app-top-bar__hamburger`) render trong `<TopBar>`:
  ```tsx
  {isTabletOrBelow && (
    <button
      type="button"
      className="app-top-bar__hamburger"
      aria-label="Open navigation menu"
      aria-expanded={drawerOpen}
      onClick={openDrawer}
    >
      ☰
    </button>
  )}
  ```
  - `isTabletOrBelow` = breakpoint ∈ {`tablet`, `mobile`} (mobile fallback sẽ replace UI hoàn toàn — xem AC-5; nhưng nếu mobile fallback chưa render — e.g. width === 768px exactly — hamburger vẫn hữu ích).
  - Practically: only visible at tablet, mobile shows fallback. CSS `.app-top-bar__hamburger { display: none; } @media (min-width: 768px) and (max-width: 1023px) { display: inline-flex; }`.
  - `aria-expanded` reflects drawer state (Story 4.2 a11y AC-1 pattern: button có visible focus ring qua `:focus-visible { box-shadow: var(--shadow-focus); }`).

**And** drawer state managed qua NEW context `SidebarDrawerContext`:
- File: `frontend/src/contexts/SidebarDrawerContext.tsx`.
- Shape: `{ isOpen: boolean; open: () => void; close: () => void; toggle: () => void; }`.
- Wrap inside `<TaskDetailProvider>` ở `AppShell.tsx` (giữ existing provider chain).

**And** drawer mounted ở `AppShell.tsx` (NOT `Sidebar.tsx` — vì Sidebar còn dùng làm flex item ở Desktop L/M/S):
- Tại Tablet breakpoint: render NEW `<SidebarDrawer />` component đè lên main content khi `drawerOpen === true`.
- `SidebarDrawer` cấu trúc: `<aside role="navigation" aria-label="Primary" className="app-sidebar-drawer">` (full-width 220px, slide-in từ trái với `transform`).
- Inside drawer: reuse Sidebar nav items (extract chung subcomponent `SidebarNav.tsx` nếu cần dedupe; nếu chấp nhận duplicate inline nav links — 2-3 dòng, KHÔNG cần extract).
- Backdrop overlay (semi-transparent) cover phần main area còn lại; tap backdrop đóng drawer.

**And** drawer interactions:
- **Escape key** đóng drawer (reuse Story 2.4 pattern `TaskDetailPanel.tsx:140–147` keydown handler — copy pattern, KHÔNG share code).
- **Focus trap** inside drawer khi `isOpen === true` — reuse `useFocusTrap(drawerRef, isOpen)` từ Story 4.2 hook. **DEPENDENCY:** Story 4.2 phải done.
- **Initial focus** khi drawer mở: focus vào first NavLink (`useEffect(() => { if (isOpen) firstNavLinkRef.current?.focus(); }, [isOpen])`).
- **Return focus** khi drawer đóng: focus về hamburger button (Story 4.2 a11y AC-2 pattern — store `triggeringElement` ref).

**And** Detail Panel tại Tablet: full-width overlay (xem AC-7 hợp nhất với "Tablet" mention) — panel `width: 100%` thay vì 420px. Backdrop vẫn render với 30% opacity.

**Test verification:** Mock matchMedia cho viewport 768px, mount `<AppShell>` → assert (a) `.app-sidebar` KHÔNG present trong DOM (hoặc `display: none` qua computed style); (b) `.app-top-bar__hamburger` button present với `aria-label="Open navigation menu"`; (c) click hamburger → `.app-sidebar-drawer` render với `role="navigation"`; (d) `keydown Escape` → drawer disappears.

---

**AC-5 — Mobile fallback message tại viewport <768px (UX-DR20, epics AC §"Given a viewport < 768px"):**

**Given** viewport width < 768px (Mobile)
**When** AppShell render (page load HOẶC resize từ Tablet xuống Mobile)
**Then** toàn bộ AppShell UI (Sidebar/TopBar/Main/Detail Panel) **được replace** bằng full-screen message:
```
OmniAgent works best on desktop. Mobile support coming soon.
```

**And** layout achieved bằng:
- NEW component `frontend/src/components/MobileFallback.tsx`:
  ```tsx
  import "./MobileFallback.css";
  export default function MobileFallback() {
    return (
      <div className="app-mobile-fallback" role="alert">
        <div className="app-mobile-fallback__icon" aria-hidden="true">🖥️</div>
        <h1 className="app-mobile-fallback__heading">OmniAgent works best on desktop</h1>
        <p className="app-mobile-fallback__body">Mobile support coming soon.</p>
      </div>
    );
  }
  ```
- `AppShell.tsx` conditional render:
  ```tsx
  if (breakpoint === "mobile") return <MobileFallback />;
  return (
    <TaskDetailProvider>
      <SidebarDrawerProvider>
        <div className="app-shell">...</div>
      </SidebarDrawerProvider>
    </TaskDetailProvider>
  );
  ```
- CSS `app-mobile-fallback`:
  - `position: fixed; inset: 0;` full viewport.
  - `display: flex; flex-direction: column; align-items: center; justify-content: center;`.
  - `padding: var(--space-8); text-align: center;`.
  - `background: var(--bg-app); color: var(--text-primary);`.
  - Icon `font-size: 48px; margin-bottom: var(--space-4);`.
  - Heading: `font-size: var(--font-size-heading-l); margin: 0 0 var(--space-3); color: var(--text-primary);`.
  - Body: `font-size: var(--font-size-body); color: var(--text-secondary); max-width: 320px;`.

**And** `MobileFallback` **KHÔNG** mount `TaskDetailProvider`, `SidebarDrawerProvider`, `<Outlet />`, hoặc `QueryClientProvider` children — fallback là dead-end state. Backend queries KHÔNG run.

**And** breakpoint detection: `useBreakpoint() === "mobile"` chỉ true khi `window.innerWidth < 768`. SSR-safety: initial state assume Desktop L (giả thiết user trên desktop), sau hydrate `useEffect` update — xem Dev Notes §"useMediaQuery SSR-safety". Vite SPA mode KHÔNG có SSR nên flicker không xảy ra trong prod, nhưng test SSR-safe để future-proof.

**And** `role="alert"` cho `MobileFallback` — assistive technology announce message khi component mount (screen reader user trên mobile sẽ nghe message).

**Test verification:** Mock matchMedia cho viewport 375px, mount `<App>` (full tree) → assert (a) `.app-mobile-fallback` present; (b) NO `.app-shell` / `.app-sidebar` / `<main>` DOM tree; (c) text content match "OmniAgent works best on desktop. Mobile support coming soon."

---

**AC-6 — Kanban board horizontal scroll tại Desktop S và below (UX-DR20, epics AC §"Given the Kanban board at Desktop S or smaller"):**

**Given** viewport width ≤ 1279px (Desktop S, Tablet — KHÔNG bao gồm Mobile vì mobile fallback)
**When** Task Board route `/board` render
**Then** Kanban columns scroll ngang, mỗi column **min-width 240px**, KHÔNG wrap thành dòng mới.

**And** layout achieved bằng:
- `frontend/src/features/board/TaskBoard.css:6–13` (`.task-board__columns`) đã có `display: flex; overflow-x: auto; flex: 1 1 auto;` — **KHÔNG đụng**. Đã đúng pattern scroll ngang.
- `frontend/src/features/board/KanbanColumn.css:2` (`width: 280px;`) → UPDATE thành `width: 280px; min-width: 240px;`. **Rationale:** base case (Desktop L/M) giữ 280px nice spacing; tại Desktop S+ columns vẫn 280px fixed (đủ space horizontal scroll). `min-width: 240px` chỉ là constraint safety — nếu future container shrink columns xuống, min-width chặn ≥ 240px.
- **Alternative interpretation:** Spec nói "min-width 240px" → có thể nghĩa columns shrink tới 240px tại Desktop S. **Implement approach:** Tại `@media (max-width: 1279px)`, `.kanban-column { width: 240px; }` để columns nhỏ lại 240px (more columns visible) ở Desktop S. Tại Tablet (768–1023px), giữ 240px (consistent). Pick **alternative interpretation** vì:
  1. Match epics AC literal: "columns scroll horizontally with each column min-width 240px".
  2. Match UX spec dòng 1816: "Kanban tại Desktop S: columns scroll ngang, min-width 240px".

**Final approach:** `.kanban-column` base `width: 280px;` + `@media (max-width: 1279px) { .kanban-column { width: 240px; min-width: 240px; } }`.

**And** `.task-board__columns` parent container **KHÔNG** `flex-wrap: wrap` (default `nowrap` đã đúng). Verify CSS line 6 không có wrap rule.

**And** scroll behavior native — KHÔNG add custom scroll buttons (UX spec không mention).

**Test verification:** Mock matchMedia cho viewport 1024px, mount `<BoardRoute />` (đã có mock data trong Story 2.3 tests) → assert KanbanColumn computed `width === "240px"`.

---

**AC-7 — Dashboard sections grid reflow tại ≥ 768px (UX-DR20, epics AC §"Given the Dashboard sections"):**

**Given** viewport width ≥ 768px (tất cả breakpoints trừ Mobile — vì Mobile show fallback, KHÔNG render dashboard)
**When** Dashboard route `/dashboard` render
**Then** section cards/items reflow tự động qua CSS Grid:
```css
grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
gap: var(--space-4);
```

**And** layout achieved bằng:
- UPDATE `frontend/src/features/dashboard/Dashboard.css` (sẽ tạo ở Story 4.1) HOẶC `DashboardSection.css` (cũng từ Story 4.1) — tùy 4.1 implement scope.
- **Where to put grid:** Trong Story 4.1, mỗi section là `<section aria-labelledby>` chứa danh sách cards. Story 4.3 thêm grid cho **container `<div>` inside section** chứa cards (KHÔNG ở section root vì section còn có heading + subtitle ở top).
- **Naming:** Story 4.3 add CSS class `.dashboard-section__grid` ở Story 4.1 component (Task A.4.4). Inline trong Story 4.1's CSS file (UPDATE).
- **Scope:** Grid áp dụng cho card sections: Needs Your Review, Failed & Blocked, Running Sessions, Recent Agent Activity. List sections (Ready to Assign, Completed Recently — 48px compact rows per Story 4.1 AC-4-AC-7) KHÔNG dùng grid (giữ vertical list).

**And** stats bar (Story 4.1 AC-2 — 4 stat cards) cũng dùng grid pattern tương tự: `grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));` (smaller minmax vì stat cards nhỏ hơn). UPDATE `DashboardStatsBar.css` (sẽ tạo ở 4.1).

**And** tại Mobile (<768px) — KHÔNG áp dụng (mobile fallback đã render thay thế dashboard).

**Test verification:** Mock matchMedia cho viewport 768px, mount `<DashboardRoute />` (sau khi Story 4.1 done) → assert section grid container `getComputedStyle.gridTemplateColumns` contains "minmax(300px, 1fr)" pattern. **NOTE:** Test này không pass cho đến khi Story 4.1 done và 4.3 chạm vào Dashboard.css. Skip với `it.skip()` + comment "Pending Story 4.1 done" nếu 4.1 chưa done.

---

## Tasks / Subtasks

> **Conventions:** Tasks A–G theo flow: hook → context → component → CSS → test. Số trong `(AC: …)` reference acceptance criteria. Tasks marked **OPTIONAL** chỉ chạy nếu deps done.

### A. Viewport detection hooks (foundation)

- [ ] **Task A.1 — Tạo `frontend/src/hooks/useMediaQuery.ts`** (AC: 1, 2, 3, 4, 5, 6, 7)
  - [ ] A.1.1 Export hook `useMediaQuery(query: string): boolean`:
    ```ts
    import { useEffect, useState } from "react";
    export function useMediaQuery(query: string): boolean {
      const [matches, setMatches] = useState<boolean>(() => {
        if (typeof window === "undefined") return false; // SSR-safety; CSR-only nhưng future-proof
        return window.matchMedia(query).matches;
      });
      useEffect(() => {
        if (typeof window === "undefined") return;
        const mql = window.matchMedia(query);
        const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
        setMatches(mql.matches); // sync initial state with current viewport
        mql.addEventListener("change", handler);
        return () => mql.removeEventListener("change", handler);
      }, [query]);
      return matches;
    }
    ```
  - [ ] A.1.2 KHÔNG dùng deprecated `mql.addListener` / `mql.removeListener` — Chrome 14+ / Firefox 55+ support `addEventListener("change")` (architecture dòng 1859: "Chrome 120+ primary, Firefox/Edge secondary").
  - [ ] A.1.3 KHÔNG add npm dependency (`react-responsive`, `usehooks-ts`, etc.) — pure utility, ~20 LOC.
  - [ ] A.1.4 Initial state `false` ở SSR, sau `useEffect` sync với `window.matchMedia(query).matches`. **CSR-only**, nhưng SSR-safe pattern future-proof.

- [ ] **Task A.2 — Tạo `frontend/src/hooks/useBreakpoint.ts`** (AC: 1, 2, 3, 4, 5)
  - [ ] A.2.1 Export type + hook:
    ```ts
    import { useMediaQuery } from "./useMediaQuery";
    export type Breakpoint = "desktop-l" | "desktop-m" | "desktop-s" | "tablet" | "mobile";
    export function useBreakpoint(): Breakpoint {
      const isDesktopL = useMediaQuery("(min-width: 1440px)");
      const isDesktopM = useMediaQuery("(min-width: 1280px) and (max-width: 1439px)");
      const isDesktopS = useMediaQuery("(min-width: 1024px) and (max-width: 1279px)");
      const isTablet = useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
      if (isDesktopL) return "desktop-l";
      if (isDesktopM) return "desktop-m";
      if (isDesktopS) return "desktop-s";
      if (isTablet) return "tablet";
      return "mobile";
    }
    ```
  - [ ] A.2.2 Breakpoint boundaries chính xác theo UX spec table (dòng 1804–1810):
    | Breakpoint | Min | Max | Query |
    |---|---|---|---|
    | desktop-l | 1440px | — | `(min-width: 1440px)` |
    | desktop-m | 1280px | 1439px | `(min-width: 1280px) and (max-width: 1439px)` |
    | desktop-s | 1024px | 1279px | `(min-width: 1024px) and (max-width: 1279px)` |
    | tablet | 768px | 1023px | `(min-width: 768px) and (max-width: 1023px)` |
    | mobile | — | 767px | (fallback else branch) |
  - [ ] A.2.3 Helper exports cho convenience (OPTIONAL):
    ```ts
    export function useIsTabletOrBelow(): boolean { return useMediaQuery("(max-width: 1023px)"); }
    export function useIsMobile(): boolean { return useMediaQuery("(max-width: 767px)"); }
    ```
    Sử dụng trong `<TopBar>` hamburger button visibility check (Task D.1.4).
  - [ ] A.2.4 Performance: tránh re-render unnecessarily — mỗi `useMediaQuery` call mount independent matchMedia listener, dẫn đến 4–5 listeners per `useBreakpoint()` call. **Acceptable** vì:
    - `useBreakpoint` only mounted ở 1–2 nơi (AppShell root + có thể TopBar).
    - `matchMedia` listeners là native browser-level, KHÔNG impact React render.
    - Browser fires `change` event chỉ khi cross-threshold — KHÔNG fire mỗi pixel resize.
  - [ ] A.2.5 Co-locate test `useBreakpoint.test.tsx` với mock `window.matchMedia` (xem Dev Notes §"Test infrastructure").

- [ ] **Task A.3 — Tests cho `useMediaQuery` + `useBreakpoint`**
  - [ ] A.3.1 `frontend/src/hooks/useMediaQuery.test.tsx`:
    - Mock `window.matchMedia` (xem Dev Notes mock pattern).
    - Render `function TestComponent() { const matches = useMediaQuery("(min-width: 1440px)"); return <span>{matches ? "match" : "no-match"}</span>; }`.
    - Mock returns matches=true → assert text "match".
    - Verify cleanup: re-render component với khác query, assert previous listener removed (spy trên `removeEventListener`).
  - [ ] A.3.2 `frontend/src/hooks/useBreakpoint.test.tsx`:
    - Parametric test cho 5 breakpoint values × 4–5 viewport widths each (test boundary values: 1440, 1439, 1280, 1279, 1024, 1023, 768, 767).
    - Mock matchMedia helper: `function setupMatchMedia(width: number) { ... }`.

### B. Drawer state context

- [ ] **Task B.1 — Tạo `frontend/src/contexts/SidebarDrawerContext.tsx`** (AC: 4)
  - [ ] B.1.1 Pattern theo `TaskDetailContext.tsx`:
    ```tsx
    import { createContext, useCallback, useContext, useRef, useState } from "react";
    import type { ReactNode, RefObject } from "react";
    interface SidebarDrawerValue {
      isOpen: boolean;
      open: () => void;
      close: () => void;
      toggle: () => void;
      triggerRef: RefObject<HTMLButtonElement | null>; // for return-focus
    }
    const Ctx = createContext<SidebarDrawerValue | null>(null);
    export function SidebarDrawerProvider({ children }: { children: ReactNode }) {
      const [isOpen, setIsOpen] = useState(false);
      const triggerRef = useRef<HTMLButtonElement | null>(null);
      const open = useCallback(() => setIsOpen(true), []);
      const close = useCallback(() => {
        setIsOpen(false);
        // Return focus to hamburger trigger
        setTimeout(() => triggerRef.current?.focus(), 0);
      }, []);
      const toggle = useCallback(() => setIsOpen((v) => !v), []);
      return <Ctx.Provider value={{ isOpen, open, close, toggle, triggerRef }}>{children}</Ctx.Provider>;
    }
    export function useSidebarDrawer(): SidebarDrawerValue {
      const ctx = useContext(Ctx);
      if (!ctx) throw new Error("useSidebarDrawer must be used within SidebarDrawerProvider");
      return ctx;
    }
    ```
  - [ ] B.1.2 `triggerRef` setup: hamburger button trong `TopBar` đặt `ref={triggerRef}` để `close()` return focus đúng element.
  - [ ] B.1.3 KHÔNG persist `isOpen` qua localStorage (defer scope).

- [ ] **Task B.2 — Tests cho `SidebarDrawerContext`**
  - [ ] B.2.1 `frontend/src/contexts/SidebarDrawerContext.test.tsx`:
    - Test `open` set isOpen true, `close` set isOpen false, `toggle` flip.
    - Test `useSidebarDrawer` throw nếu KHÔNG wrap với `SidebarDrawerProvider`.

### C. Mobile fallback component

- [ ] **Task C.1 — Tạo `frontend/src/components/MobileFallback.tsx` + `MobileFallback.css`** (AC: 5)
  - [ ] C.1.1 Component (xem code snippet ở AC-5).
  - [ ] C.1.2 CSS (xem styles ở AC-5).
  - [ ] C.1.3 KHÔNG mount providers / queries — fallback là dead-end.

- [ ] **Task C.2 — Tests cho `MobileFallback`**
  - [ ] C.2.1 `frontend/src/components/MobileFallback.test.tsx`:
    - Render → assert text content + heading hierarchy (h1 → p).
    - Assert `role="alert"` để screen reader announce.

### D. AppShell + TopBar updates

- [ ] **Task D.1 — UPDATE `frontend/src/components/AppShell.tsx`** (AC: 1, 4, 5)
  - [ ] D.1.1 Import `useBreakpoint` + `SidebarDrawerProvider` + `MobileFallback` + `SidebarDrawer` (NEW từ Task E.2).
  - [ ] D.1.2 Conditional render:
    ```tsx
    export default function AppShell() {
      const breakpoint = useBreakpoint();
      if (breakpoint === "mobile") return <MobileFallback />;
      return (
        <SidebarDrawerProvider>
          <TaskDetailProvider>
            <AppShellInner breakpoint={breakpoint} />
          </TaskDetailProvider>
        </SidebarDrawerProvider>
      );
    }
    function AppShellInner({ breakpoint }: { breakpoint: Breakpoint }) {
      const { selectedTask } = useTaskDetail();
      const isDetailOpen = selectedTask !== null;
      const shellClass = `app-shell${isDetailOpen ? " app-shell--detail-open" : ""} app-shell--bp-${breakpoint}`;
      return (
        <div className={shellClass}>
          <TopBar />
          <div className="app-shell__body">
            {breakpoint !== "tablet" && <Sidebar />}
            <main id="main-content" className="app-shell__main" role="main">
              <Outlet />
            </main>
          </div>
          <TaskDetailPanel />
          {breakpoint === "tablet" && <SidebarDrawer />}
        </div>
      );
    }
    ```
  - [ ] D.1.3 **CRITICAL:** Provider order — `SidebarDrawerProvider` PHẢI wrap ngoài `TaskDetailProvider` để TopBar (mount trong `AppShellInner`) consume drawer context. **NOTE:** Order matters cho test setup helpers.
  - [ ] D.1.4 KHÔNG remove `<TaskDetailProvider>` wrap (Story 1.4 + Story 2.4 dependency).
  - [ ] D.1.5 Nếu Story 4.2 done và đã add `<SearchOverlayProvider>` / Skip Link / `id="main-content"` cho `<main>` — **MERGE** thay đổi thay vì overwrite. Cụ thể:
    - Giữ `<SkipLink />` Story 4.2 đã add (đầu trong `<div className="app-shell">`).
    - Giữ `id="main-content"` + `tabIndex={-1}` Story 4.2 đã add.
    - Giữ `<SearchOverlayProvider>` wrap Story 4.2 đã add.
    - Story 4.3 chỉ thêm `<SidebarDrawerProvider>` wrap ngoài cùng + conditional rendering logic.
  - [ ] D.1.6 KHÔNG đụng `<Outlet />` (Story 1.4 routing).

- [ ] **Task D.2 — UPDATE `frontend/src/components/AppShell.css`** (AC: 1, 3, 4)
  - [ ] D.2.1 Add media queries cuối file (sau line 143):
    ```css
    /* ==== Story 4.3: Responsive layout ==== */

    /* Desktop S (1024–1279px) — Sidebar icon-only */
    @media (min-width: 1024px) and (max-width: 1279px) {
      .app-sidebar {
        width: 48px;
      }
      .app-sidebar__header {
        font-size: 0;
        justify-content: center;
        padding: 0;
      }
      .app-sidebar__header::before {
        content: "Ω";
        font-size: var(--font-size-heading-m);
      }
      .app-sidebar__project-switcher {
        display: none;
      }
      .app-sidebar__item {
        padding: var(--space-2);
        justify-content: center;
      }
      .app-sidebar__item-label {
        display: none;
      }
      .app-sidebar__avatar {
        padding: var(--space-3);
      }
    }

    /* Tablet (768–1023px) — Sidebar hidden, accessed via drawer */
    @media (max-width: 1023px) {
      .app-sidebar {
        display: none;
      }
    }

    /* Desktop L (≥1440px) — Detail Panel push layout */
    @media (min-width: 1440px) {
      .app-shell--detail-open .app-shell__main {
        padding-right: 420px;
      }
    }
    ```
  - [ ] D.2.2 **Lý do** dùng `padding-right` thay vì `flex: 0 0 420px` cho panel: Panel hiện tại `position: fixed` ở `TaskDetailPanel.css:14–29`. Để chuyển panel sang flex item cần thay đổi `position` ở base CSS, sẽ ảnh hưởng overlay behavior ở Desktop M/S. **Simpler:** Giữ panel `position: fixed`, push main content bằng `padding-right`. Visually: main content shrinks 420px (giữ same effect như push). Backdrop hidden ở Desktop L (xem AC-1 + Task F.1).
  - [ ] D.2.3 KHÔNG đụng existing rules (TopBar, Sidebar base, Avatar) — chỉ append.

- [ ] **Task D.3 — UPDATE `frontend/src/components/TopBar.tsx`** (AC: 4)
  - [ ] D.3.1 Import `useSidebarDrawer` + `useIsTabletOrBelow` (Task A.2.3).
  - [ ] D.3.2 Add hamburger button trước `<span className="app-top-bar__brand">`:
    ```tsx
    const { toggle, triggerRef, isOpen } = useSidebarDrawer();
    const isTablet = useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
    return (
      <header className="app-top-bar" role="banner">
        {isTablet && (
          <button
            type="button"
            ref={triggerRef}
            className="app-top-bar__hamburger"
            aria-label="Open navigation menu"
            aria-expanded={isOpen}
            onClick={toggle}
          >
            ☰
          </button>
        )}
        <span className="app-top-bar__brand">omni-agent</span>
        ...
      </header>
    );
    ```
  - [ ] D.3.3 CSS rule cho hamburger trong `AppShell.css`:
    ```css
    .app-top-bar__hamburger {
      display: none; /* hidden by default */
      width: 40px;
      height: 40px;
      border: none;
      background: none;
      cursor: pointer;
      color: var(--text-primary);
      font-size: 20px;
      border-radius: var(--radius-sm);
      margin-right: var(--space-2);
    }
    .app-top-bar__hamburger:hover {
      background: var(--bg-hover);
    }
    .app-top-bar__hamburger:focus-visible {
      outline: none;
      box-shadow: var(--shadow-focus);
    }
    @media (min-width: 768px) and (max-width: 1023px) {
      .app-top-bar__hamburger {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
    }
    ```
  - [ ] D.3.4 KHÔNG đụng `+ New Task` button logic.

### E. Sidebar updates + SidebarDrawer

- [ ] **Task E.1 — UPDATE `frontend/src/components/Sidebar.tsx`** (AC: 3)
  - [ ] E.1.1 Remove dòng 1 TODO comment (`// TODO(Story 4.3): collapse sidebar to icon-only at ≤1280px (UX-DR20).`) — story này đang resolve TODO đó.
  - [ ] E.1.2 Wrap each NavLink text trong span để CSS có thể ẩn ở icon-only mode:
    ```tsx
    <NavLink to="/dashboard" className={itemClass} title="Dashboard">
      <span className="app-sidebar__item-icon" aria-hidden="true">📊</span>
      <span className="app-sidebar__item-label">Dashboard</span>
    </NavLink>
    ```
  - [ ] E.1.3 Áp dụng cho cả "Dashboard" + "All Tasks" NavLink (2 nav items hiện tại).
    - Dashboard icon: `📊` (UX spec dòng 189).
    - All Tasks icon: `📋` (UX spec dòng 193).
  - [ ] E.1.4 Thêm `title` attribute cho mỗi `<NavLink>` — nội dung match label.
  - [ ] E.1.5 KHÔNG đụng `<ProjectSwitcher />` mount (CSS sẽ ẩn nó ở Desktop S qua media query Task D.2.1).
  - [ ] E.1.6 KHÔNG đụng `<aside role="navigation" aria-label="Primary">` (Story 2.x dependency).
  - [ ] E.1.7 Tests update — `Sidebar.test.tsx` nếu có; nếu KHÔNG có (verify với `ls frontend/src/components/Sidebar*`), tạo `Sidebar.test.tsx`:
    - Render → assert 2 NavLinks present với `title` attribute.
    - Assert icon span has `aria-hidden="true"`.

- [ ] **Task E.2 — Tạo `frontend/src/components/SidebarDrawer.tsx` + `SidebarDrawer.css`** (AC: 4)
  - [ ] E.2.1 Component:
    ```tsx
    import { useEffect, useRef } from "react";
    import { NavLink } from "react-router";
    import { useSidebarDrawer } from "../contexts/SidebarDrawerContext";
    import { useFocusTrap } from "../hooks/useFocusTrap"; // dependency Story 4.2
    import "./SidebarDrawer.css";

    const itemClass = ({ isActive }: { isActive: boolean }) =>
      isActive ? "app-sidebar-drawer__item app-sidebar-drawer__item--active" : "app-sidebar-drawer__item";

    export default function SidebarDrawer() {
      const { isOpen, close } = useSidebarDrawer();
      const drawerRef = useRef<HTMLElement>(null);
      const firstLinkRef = useRef<HTMLAnchorElement>(null);

      // Escape handler (AC-4 — pattern from Story 2.4 TaskDetailPanel)
      useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
      }, [isOpen, close]);

      // Initial focus when drawer opens
      useEffect(() => {
        if (isOpen) firstLinkRef.current?.focus();
      }, [isOpen]);

      // Focus trap (reuse Story 4.2 hook)
      useFocusTrap(drawerRef, isOpen);

      if (!isOpen) return null;

      return (
        <>
          <div
            className="app-sidebar-drawer__backdrop"
            aria-hidden="true"
            onClick={close}
            data-testid="drawer-backdrop"
          />
          <aside
            ref={drawerRef}
            className="app-sidebar-drawer"
            role="navigation"
            aria-label="Primary"
            data-testid="sidebar-drawer"
          >
            <div className="app-sidebar-drawer__header">
              <span>OmniAgent</span>
              <button
                type="button"
                className="app-sidebar-drawer__close"
                aria-label="Close navigation menu"
                onClick={close}
              >
                ✕
              </button>
            </div>
            <ul className="app-sidebar-drawer__nav">
              <li>
                <NavLink to="/dashboard" ref={firstLinkRef} className={itemClass} onClick={close}>
                  <span className="app-sidebar-drawer__item-icon" aria-hidden="true">📊</span>
                  <span>Dashboard</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/board" className={itemClass} onClick={close}>
                  <span className="app-sidebar-drawer__item-icon" aria-hidden="true">📋</span>
                  <span>All Tasks</span>
                </NavLink>
              </li>
            </ul>
          </aside>
        </>
      );
    }
    ```
  - [ ] E.2.2 CSS `SidebarDrawer.css`:
    ```css
    .app-sidebar-drawer__backdrop {
      position: fixed;
      inset: 0;
      z-index: 300;
      background: rgba(0, 0, 0, 0.30);
    }
    .app-sidebar-drawer {
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      width: 220px;
      z-index: 301;
      background: var(--bg-card);
      border-right: 1px solid var(--border);
      box-shadow: var(--shadow-lg);
      display: flex;
      flex-direction: column;
      overflow: auto;
      animation: app-sidebar-drawer-slide-in 200ms ease-out both;
    }
    @keyframes app-sidebar-drawer-slide-in {
      from { transform: translateX(-100%); }
      to   { transform: translateX(0); }
    }
    .app-sidebar-drawer__header {
      height: 52px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 var(--space-4);
      color: var(--brand-primary);
      font-weight: 600;
      font-size: var(--font-size-heading-m);
      border-bottom: 1px solid var(--border);
    }
    .app-sidebar-drawer__close {
      width: 28px;
      height: 28px;
      border: none;
      background: none;
      cursor: pointer;
      color: var(--text-secondary);
      border-radius: var(--radius-sm);
    }
    .app-sidebar-drawer__close:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }
    .app-sidebar-drawer__close:focus-visible {
      outline: none;
      box-shadow: var(--shadow-focus);
    }
    .app-sidebar-drawer__nav {
      list-style: none;
      padding: var(--space-2) var(--space-3);
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }
    .app-sidebar-drawer__item {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      height: 44px; /* AC: Touch target 44×44 — UX spec dòng 1844 */
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      text-decoration: none;
      font-size: var(--font-size-body);
    }
    .app-sidebar-drawer__item:hover {
      background: var(--bg-hover);
    }
    .app-sidebar-drawer__item--active {
      background: var(--brand-light);
      color: var(--brand-primary);
      font-weight: 500;
    }
    .app-sidebar-drawer__item:focus-visible {
      outline: none;
      box-shadow: var(--shadow-focus);
    }
    ```
  - [ ] E.2.3 **Touch target 44×44** (UX spec dòng 1844): `.app-sidebar-drawer__item` `height: 44px` (vs Sidebar base 34px). Tablet user có thể tap, cần target ≥ 44px.
  - [ ] E.2.4 Click `<NavLink>` đóng drawer (`onClick={close}`) — UX nature: chọn nav xong là đóng menu, tránh user phải close manual.
  - [ ] E.2.5 KHÔNG share `Sidebar.tsx` markup — minor duplication acceptable cho 2 NavLink. Nếu Story sau add nhiều nav items, refactor extract `<SidebarNavItems>` subcomponent.

- [ ] **Task E.3 — Tests cho `SidebarDrawer`**
  - [ ] E.3.1 `frontend/src/components/SidebarDrawer.test.tsx`:
    - Setup helper wrap với `<SidebarDrawerProvider>` + initial isOpen.
    - Test render khi `isOpen === false` → `null` (no DOM).
    - Test render khi `isOpen === true` → `role="navigation"` + 2 NavLinks + backdrop.
    - Test `Escape` key fire → `close` called (mock context value).
    - Test click backdrop → `close` called.
    - Test click NavLink → `close` called (and navigation happens — verify URL change qua MemoryRouter).
    - Test focus on first NavLink khi `isOpen` flip from false → true.
    - Test focus trap: from first NavLink → Shift+Tab → wrap về close button (Story 4.2 hook behavior).

### F. TaskDetailPanel updates (push vs overlay)

- [ ] **Task F.1 — UPDATE `frontend/src/features/detail/TaskDetailPanel.tsx`** (AC: 1, 2)
  - [ ] F.1.1 Import `useBreakpoint`.
  - [ ] F.1.2 Conditional render backdrop dựa vào breakpoint:
    ```tsx
    const breakpoint = useBreakpoint();
    const showBackdrop = breakpoint !== "desktop-l"; // push mode at Desktop L: no overlay
    // ...
    return (
      <>
        {showBackdrop && (
          <div
            className="task-detail-panel__backdrop"
            aria-hidden="true"
            onClick={closeTask}
            data-testid="panel-backdrop"
          />
        )}
        <aside className="task-detail-panel" ...>
          ...
        </aside>
      </>
    );
    ```
  - [ ] F.1.3 KHÔNG đụng other panel behavior (Escape handler, focus management).
  - [ ] F.1.4 Update existing test `frontend/src/features/detail/TaskDetailPanel.test.tsx` (nếu test backdrop presence): mock matchMedia để control breakpoint trong test cases. Add separate test cases:
    - Desktop L: backdrop NOT in DOM.
    - Desktop M/S/Tablet: backdrop IN DOM với computed bg ≠ transparent.

- [ ] **Task F.2 — UPDATE `frontend/src/features/detail/TaskDetailPanel.css`** (AC: 1, 2, 4)
  - [ ] F.2.1 UPDATE `.task-detail-panel__backdrop` (line 6–11):
    ```css
    /* Backdrop — visible overlay at <Desktop L breakpoints */
    .task-detail-panel__backdrop {
      position: fixed;
      inset: 0;
      z-index: 200;
      background: rgba(0, 0, 0, 0.30); /* CHANGED from transparent — visible overlay (UX-DR20 AC-2) */
    }
    ```
    **NOTE:** Tại Desktop L backdrop KHÔNG render (conditional ở Task F.1.2), nên giá trị `background` chỉ ảnh hưởng Desktop M/S/Tablet. Visible 30% opacity match AC-2 UX-DR20.
  - [ ] F.2.2 ADD media query cho Tablet (panel full-width):
    ```css
    /* Tablet — Detail Panel full-width overlay */
    @media (max-width: 1023px) {
      .task-detail-panel {
        width: 100%;
        left: 0;
      }
    }
    ```
  - [ ] F.2.3 KHÔNG đụng existing animation, panel base styles, close button, header, tabs CSS rules.

### G. Kanban board updates

- [ ] **Task G.1 — UPDATE `frontend/src/features/board/KanbanColumn.css`** (AC: 6)
  - [ ] G.1.1 Modify line 2 + add media query:
    ```css
    .kanban-column {
      width: 280px; /* base — Desktop L/M */
      min-width: 240px; /* safety constraint */
      flex-shrink: 0;
      ...
    }
    /* Desktop S + below: smaller column width per UX-DR20 */
    @media (max-width: 1279px) {
      .kanban-column {
        width: 240px;
      }
    }
    ```
  - [ ] G.1.2 KHÔNG đụng other Kanban column rules (header, body, dot, etc.).

- [ ] **Task G.2 — Verify `TaskBoard.css` `overflow-x: auto`** (AC: 6)
  - [ ] G.2.1 Read `TaskBoard.css:9` — confirm `overflow-x: auto` đã present.
  - [ ] G.2.2 KHÔNG sửa file (đã đúng).
  - [ ] G.2.3 Add test trong `TaskBoard.test.tsx` (nếu chưa có) hoặc `KanbanColumn.test.tsx`:
    - Mock matchMedia cho viewport 1024px → assert `.kanban-column` computed `width === "240px"`.
    - Mock matchMedia cho viewport 1440px → assert `.kanban-column` computed `width === "280px"`.

### H. Dashboard grid reflow (DEPENDS ON Story 4.1 done)

- [ ] **Task H.1 — UPDATE `frontend/src/features/dashboard/Dashboard.css`** (AC: 7) — **OPTIONAL nếu Story 4.1 chưa done**
  - [ ] H.1.1 PRE-CHECK: Verify Story 4.1 status === `done` in sprint-status.yaml. Nếu chưa done → HALT, raise blocker.
  - [ ] H.1.2 Add CSS rule cho section grid container (Story 4.1 sẽ tạo `.dashboard-section__grid` hoặc tương đương):
    ```css
    .dashboard-section__grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: var(--space-4);
    }
    ```
  - [ ] H.1.3 Verify Story 4.1's `DashboardStatsBar.css` có pattern tương tự:
    ```css
    .dashboard-stats-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: var(--space-3);
    }
    ```
    Nếu Story 4.1 đã implement grid → KHÔNG đụng. Nếu Story 4.1 dùng `flex` thay vì grid → UPDATE thành grid với auto-fit.
  - [ ] H.1.4 KHÔNG đụng section heading, subtitle, card styles.

- [ ] **Task H.2 — Tests cho Dashboard grid reflow** — **OPTIONAL nếu Story 4.1 chưa done**
  - [ ] H.2.1 UPDATE `frontend/src/features/dashboard/Dashboard.test.tsx` (Story 4.1 sẽ tạo):
    - Mock matchMedia cho viewport 768px → assert section grid `getComputedStyle.display === "grid"`.
    - Mock viewport 1440px → assert grid template same (auto-fit handles responsive).

### I. Test infrastructure (matchMedia mock)

- [ ] **Task I.1 — UPDATE `frontend/src/test-setup.ts`** (Infrastructure for AC tests)
  - [ ] I.1.1 Add global `window.matchMedia` mock (jsdom KHÔNG implement matchMedia natively):
    ```ts
    // Mock window.matchMedia for tests using useMediaQuery
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false, // default: no match — tests override per-case
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {}, // deprecated, included for safety
        removeListener: () => {}, // deprecated
        dispatchEvent: () => false,
      }),
    });
    ```
  - [ ] I.1.2 Export helper từ `frontend/src/test-utils/matchMedia.ts` (NEW file) để tests override per-test:
    ```ts
    export function mockMatchMedia(matchesFn: (query: string) => boolean): void {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: (query: string) => ({
          matches: matchesFn(query),
          media: query,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        }),
      });
    }
    export function mockViewport(width: number): void {
      mockMatchMedia((query) => {
        // Parse "(min-width: 1440px)" / "(max-width: 1279px)" / combined
        const minMatch = query.match(/\(min-width:\s*(\d+)px\)/);
        const maxMatch = query.match(/\(max-width:\s*(\d+)px\)/);
        const min = minMatch ? parseInt(minMatch[1], 10) : 0;
        const max = maxMatch ? parseInt(maxMatch[1], 10) : Infinity;
        return width >= min && width <= max;
      });
    }
    ```
  - [ ] I.1.3 Update existing tests dùng matchMedia (TaskDetailPanel.test.tsx, KanbanColumn.test.tsx etc.) để default mock không break.

### J. Validation, lint, regression

- [ ] **Task J.1 — TypeScript strict mode pass**
  - [ ] J.1.1 `cd frontend && npx tsc --noEmit` exit 0.
  - [ ] J.1.2 KHÔNG dùng `any` / `as any` trong code mới.

- [ ] **Task J.2 — Full test suite pass**
  - [ ] J.2.1 `cd frontend && npm test` → all tests pass.
  - [ ] J.2.2 Tests mới: useMediaQuery, useBreakpoint, SidebarDrawerContext, MobileFallback, SidebarDrawer, Sidebar (updated), TopBar (updated), TaskDetailPanel (updated), KanbanColumn (updated).
  - [ ] J.2.3 KHÔNG break existing tests — especially TaskDetailPanel.test.tsx (backdrop assertion update qua matchMedia mock per case).

- [ ] **Task J.3 — Lint pass**
  - [ ] J.3.1 `cd frontend && npx eslint .` exit 0. (Hoặc `npm run lint` nếu defined.)

- [ ] **Task J.4 — Manual smoke test (optional)**
  - [ ] J.4.1 `cd backend && cargo run` + `cd frontend && npm run dev`.
  - [ ] J.4.2 Mở Chrome DevTools → Responsive Design Mode.
  - [ ] J.4.3 Test viewport 1920px (Desktop L): Mở TaskCard → panel push main area, KHÔNG backdrop visible.
  - [ ] J.4.4 Test viewport 1366px (Desktop M): Mở TaskCard → panel overlay với 30% backdrop.
  - [ ] J.4.5 Test viewport 1280px (Desktop M boundary): Same as above.
  - [ ] J.4.6 Test viewport 1100px (Desktop S): Sidebar icon-only (48px wide), hover nav item → native `title` tooltip hiện.
  - [ ] J.4.7 Test viewport 900px (Tablet): Sidebar gone, hamburger icon ở TopBar góc trái. Click → drawer slide-in từ trái, Escape đóng drawer, click backdrop đóng drawer.
  - [ ] J.4.8 Test viewport 500px (Mobile): Full-screen fallback message hiện, KHÔNG có sidebar / topbar / outlet.
  - [ ] J.4.9 Test Kanban board ở Desktop S: columns 240px wide, scroll ngang.
  - [ ] J.4.10 Test dashboard ở Tablet (nếu Story 4.1 done): section cards reflow grid.

- [ ] **Task J.5 — KHÔNG được thay đổi (regression guard)**
  - [ ] J.5.1 KHÔNG đụng `frontend/src/api/*` (no new API call).
  - [ ] J.5.2 KHÔNG đụng `frontend/src/components/StatusBadge.tsx`, `Button.tsx`, `TaskCard.tsx`, `AgentAvatar.tsx`, `SessionBadge.tsx`, `EmptyState.tsx`, `Toast.tsx`, `ConfirmationDialog.tsx`, `CreateTaskModal.tsx`.
  - [ ] J.5.3 KHÔNG đụng `frontend/src/features/project/*` (KHÔNG resize ProjectSwitcher — sẽ ẩn qua CSS media query).
  - [ ] J.5.4 KHÔNG thêm backend endpoint mới. KHÔNG đụng `backend/`.
  - [ ] J.5.5 KHÔNG đụng routes `App.tsx`.
  - [ ] J.5.6 KHÔNG implement keyboard shortcuts (Story 4.2 scope).
  - [ ] J.5.7 KHÔNG implement sidebar collapsed manual toggle (defer).
  - [ ] J.5.8 KHÔNG implement localStorage persistence của drawer/sidebar state (defer).
  - [ ] J.5.9 KHÔNG implement print stylesheet (defer).

---

## Dev Notes

### Architecture compliance

**File locations (theo `_bmad-output/planning-artifacts/architecture.md` §"Project Directory Structure" dòng 460–484 + Story 4.2 pattern cho hooks/contexts):**

```
frontend/src/
├── hooks/
│   ├── useMediaQuery.ts        ← NEW (Task A.1)
│   ├── useMediaQuery.test.tsx  ← NEW
│   ├── useBreakpoint.ts        ← NEW (Task A.2)
│   ├── useBreakpoint.test.tsx  ← NEW
│   └── useFocusTrap.ts         ← REUSE (Story 4.2 dependency)
├── contexts/
│   ├── SidebarDrawerContext.tsx        ← NEW (Task B.1)
│   └── SidebarDrawerContext.test.tsx   ← NEW
├── components/
│   ├── AppShell.tsx            ← UPDATE (Task D.1)
│   ├── AppShell.css            ← UPDATE (Task D.2)
│   ├── Sidebar.tsx             ← UPDATE (Task E.1)
│   ├── Sidebar.test.tsx        ← NEW (currently missing)
│   ├── SidebarDrawer.tsx       ← NEW (Task E.2)
│   ├── SidebarDrawer.css       ← NEW (Task E.2)
│   ├── SidebarDrawer.test.tsx  ← NEW (Task E.3)
│   ├── TopBar.tsx              ← UPDATE (Task D.3)
│   ├── TopBar.test.tsx         ← UPDATE (existing — add hamburger render test)
│   ├── MobileFallback.tsx      ← NEW (Task C.1)
│   ├── MobileFallback.css      ← NEW (Task C.1)
│   └── MobileFallback.test.tsx ← NEW (Task C.2)
├── features/
│   ├── detail/
│   │   ├── TaskDetailPanel.tsx     ← UPDATE (Task F.1)
│   │   ├── TaskDetailPanel.css     ← UPDATE (Task F.2)
│   │   └── TaskDetailPanel.test.tsx ← UPDATE (matchMedia mock)
│   ├── board/
│   │   ├── KanbanColumn.css        ← UPDATE (Task G.1)
│   │   ├── KanbanColumn.test.tsx   ← UPDATE if exists / NEW
│   │   └── TaskBoard.css           ← NO CHANGE
│   └── dashboard/
│       ├── Dashboard.css           ← UPDATE (Task H.1) — depends on Story 4.1
│       └── DashboardStatsBar.css   ← UPDATE if exists (Task H.1)
├── test-utils/
│   └── matchMedia.ts               ← NEW (Task I.1)
└── test-setup.ts                   ← UPDATE (Task I.1)
```

**Tổng file mới: ~12. File update: ~9. Total touched: ~21.**

**Files KHÔNG đụng (regression guard):**
- `frontend/src/App.tsx` (routes wire — Story 1.4 dependency).
- `frontend/src/api/*` (KHÔNG thêm endpoint).
- `frontend/src/types/*` (KHÔNG thêm types).
- `frontend/src/features/project/*` (ProjectSwitcher ẩn qua CSS — KHÔNG đụng component).
- `frontend/src/components/StatusBadge.tsx`, `Button.tsx`, `TaskCard.tsx`, `AgentAvatar.tsx`, `SessionBadge.tsx`, `EmptyState.tsx`, `Toast.tsx`, `ConfirmationDialog.tsx`, `CreateTaskModal.tsx` (shared UI — KHÔNG sửa).
- `backend/*` (KHÔNG đụng).
- `frontend/src/routes/*` (KHÔNG đụng — routing logic Story 1.4).

### Library/Framework requirements

| Library | Version (locked) | Dùng trong 4.3 |
|---|---|---|
| `react` | 19.2.x (`frontend/package.json:13`) | `useState`, `useEffect`, `useCallback`, `useRef`, `useContext`, `createContext` |
| `react-router` | 7.15.x (`frontend/package.json:15`) | `NavLink` cho SidebarDrawer nav items |
| `@tanstack/react-query` | 5.100.11 | — (no API calls trong story 4.3) |
| `vitest` + `@testing-library/react` | matched `frontend/package.json` devDeps | Tests |
| `jsdom` | 29.x | Test environment — matchMedia mock cần thiết (jsdom KHÔNG implement matchMedia natively) |

**KHÔNG thêm dependency mới.** KHÔNG dùng `react-responsive`, `usehooks-ts`, `framer-motion`, `react-aria`, `radix-ui`, etc. — pure CSS media queries + native React.

### Breakpoint boundary discipline

**CRITICAL:** Boundary values are **inclusive on min, exclusive on max** trong matchMedia queries (CSS standard):
- `(min-width: 1440px)` matches when viewport ≥ 1440px.
- `(max-width: 1439px)` matches when viewport ≤ 1439px.
- 1439px → matches `(max-width: 1439px)`, KHÔNG match `(min-width: 1440px)` → breakpoint = `desktop-m` (đúng).
- 1440px → matches `(min-width: 1440px)` → breakpoint = `desktop-l` (đúng).

**Edge cases để test:**
- 1440 → desktop-l
- 1439 → desktop-m
- 1280 → desktop-m
- 1279 → desktop-s
- 1024 → desktop-s
- 1023 → tablet
- 768 → tablet
- 767 → mobile
- 100 → mobile (extreme low)
- 4000 → desktop-l (extreme high — 4K monitor)

### useMediaQuery SSR-safety

Vite SPA mode KHÔNG có SSR (entry `frontend/src/main.tsx` mounts `<App />` direct vào DOM). Nhưng `useMediaQuery` defensive code check `typeof window === "undefined"` cho:
1. Vitest jsdom environment: `window` defined → safe.
2. Future SSR migration (Next.js / Remix): initial state default `false` ở server, sau hydrate update.

**Don't:**
- KHÔNG dùng `window.matchMedia(...).matches` ở module top-level — chỉ trong `useEffect` hoặc lazy initial state callback.
- KHÔNG `throw` nếu `window` undefined — return safe default.

### CSS architecture

**Naming convention** theo BEM-like pattern hiện hữu:
- `.app-shell` (block) → `.app-shell__main` (element) → `.app-shell--detail-open` (modifier).
- `.app-sidebar-drawer` (block) → `.app-sidebar-drawer__item` (element) → `.app-sidebar-drawer__item--active` (modifier).
- KHÔNG dùng utility classes (Tailwind, etc.).
- KHÔNG inline styles (trừ dynamic values như `transform: translateX(${offset}px)` nếu cần).

**Media query strategy:**
- **Mobile-first** convention (`min-width` cascade) cho NEW CSS rules where reasonable.
- **Desktop-first** acceptable cho existing override patterns (e.g. `.app-sidebar` base 220px desktop → `@media (max-width: 1279px) { width: 48px }` override).
- KHÔNG dùng CSS variables trong media query conditions (browser support gap — `@media (min-width: var(--bp-desktop-l))` KHÔNG work). Hardcode breakpoint values in queries.

**Token compliance:**
- Bắt buộc dùng `--bg-card`, `--bg-app`, `--bg-hover`, `--border`, `--brand-primary`, `--brand-light`, `--text-primary`, `--text-secondary`, `--shadow-focus`, `--shadow-lg`, `--space-*`, `--radius-sm`, `--font-size-*`, `--line-height-*`, `--font-family-sans` từ `frontend/src/styles/tokens.css`.
- KHÔNG hardcode hex/rgba (exception: `rgba(0, 0, 0, 0.30)` cho backdrop — UX spec explicit value, KHÔNG có token tương ứng).
- Token `--shadow-focus` (line 95 tokens.css) cho mọi `:focus-visible { box-shadow: var(--shadow-focus); }`.

### Test infrastructure

**matchMedia mock pattern** (jsdom KHÔNG implement natively — kết quả: `window.matchMedia is not a function` error nếu KHÔNG mock):

```ts
// Per-test setup (in test-utils/matchMedia.ts)
import { afterEach } from "vitest";
import { mockViewport } from "../test-utils/matchMedia";

beforeEach(() => mockViewport(1440)); // default Desktop L
afterEach(() => mockViewport(1440));  // reset
```

```ts
// Specific test override
it("renders mobile fallback at viewport < 768px", () => {
  mockViewport(375);
  const { queryByTestId } = render(<App />);
  expect(queryByTestId("mobile-fallback")).toBeInTheDocument();
});
```

**Critical mock detail:** `mockViewport` chỉ làm `matchMedia` return correct matches per query — nó KHÔNG simulate window resize events. Để test resize behavior, fire event manually:
```ts
window.dispatchEvent(new Event("resize"));
```

**KHÔNG dùng `Object.defineProperty(window, "innerWidth", ...)` để mock viewport** — useMediaQuery KHÔNG read `innerWidth`, chỉ read `matchMedia`.

### Critical don't-miss rules

- ❌ **KHÔNG** mount matchMedia listener nhiều lần không cần — mỗi `useMediaQuery(query)` call mounts 1 listener. `useBreakpoint` calls 4 internally — acceptable, nhưng KHÔNG gọi `useBreakpoint` ở deeply nested components. Centralize ở `AppShell` + pass breakpoint qua context/prop nếu cần.
- ❌ **KHÔNG** quên cleanup matchMedia listener trong `useEffect` return — memory leak.
- ❌ **KHÔNG** dùng `window.innerWidth` trong code component — không reactive, không fire trên resize. Dùng `useMediaQuery` / `useBreakpoint`.
- ❌ **KHÔNG** assume jsdom support `matchMedia` — phải mock global (Task I.1).
- ❌ **KHÔNG** dùng `mql.addListener` / `mql.removeListener` (deprecated từ DOM Level 4) — dùng `addEventListener("change", ...)`.
- ❌ **KHÔNG** transition CSS responsive properties (`width`, `display`) — gây jank khi resize. CSS media queries snap instantly.
- ❌ **KHÔNG** mount `<Sidebar />` + `<SidebarDrawer />` simultaneously — chọn 1 (xem Task D.1.2 conditional).
- ❌ **KHÔNG** add focus trap manual vào SidebarDrawer — reuse `useFocusTrap` từ Story 4.2.
- ❌ **KHÔNG** wire keyboard shortcut (e.g. `⌘\` toggle sidebar) — Story 4.2 scope.
- ❌ **KHÔNG** persist drawer/sidebar state qua localStorage — defer.
- ❌ **KHÔNG** add Mobile responsive UI — chỉ render fallback message.
- ❌ **KHÔNG** đụng `frontend/src/features/project/*` để resize ProjectSwitcher — ẩn qua CSS.
- ❌ **KHÔNG** add custom tooltip component cho icon-only sidebar — dùng native `title` attribute (xem Out of scope).

### Critical implementation rules

**React (project-context §"Framework-Specific Rules"):**
- TypeScript strict mode — explicit types cho mọi hook return, prop, ref.
- KHÔNG dùng `any`. Cho DOM, dùng `HTMLElement` / `HTMLButtonElement` / `HTMLAnchorElement` cụ thể.
- State management: `useState` + `useContext` + `useRef`. KHÔNG dùng Redux/Zustand.
- `useCallback` cho callback truyền xuống hook deps.
- `useMemo` cho expensive computation (KHÔNG cần trong 4.3 — chỉ có conditional renders + CSS).

**CSS:**
- Bắt buộc dùng CSS variables (xem §"Token compliance" trên).
- KHÔNG hardcode hex/rgba (exception: `rgba(0, 0, 0, 0.30)` backdrop — UX spec explicit).
- `:focus-visible` (NOT `:focus`) cho focus indicator.
- `transition: box-shadow 0.15s` — match existing pattern (Button.css, TaskDetailPanel.css).
- KHÔNG transition `width` / `display` / `visibility` ở responsive media queries — snap instantly.

**Routing:**
- KHÔNG đụng routes / `App.tsx`. SidebarDrawer dùng `<NavLink>` (giống Sidebar pattern).

**Accessibility-specific:**
- Hamburger button: `aria-label="Open navigation menu"` + `aria-expanded={isOpen}`. Story 4.2 a11y AC-1 pattern.
- SidebarDrawer: `role="navigation"` + `aria-label="Primary"` (same pattern as Sidebar).
- MobileFallback: `role="alert"` để screen reader announce.
- Drawer close button: `aria-label="Close navigation menu"`.
- Touch target ≥ 44×44 cho drawer items (UX spec dòng 1844).
- Focus trap inside drawer khi open (reuse Story 4.2 `useFocusTrap`).
- Initial focus on first NavLink khi drawer open.
- Return focus to hamburger button khi drawer close (`triggerRef` in context).
- Escape key đóng drawer (Story 2.4 pattern).

### Previous story intelligence

**Từ Story 1.3 (done):**
- `frontend/src/styles/tokens.css` đã có toàn bộ design tokens. Story 4.3 reuse `--shadow-focus`, `--shadow-lg`, `--bg-card`, `--space-*`, `--radius-*`.

**Từ Story 1.4 (done):**
- `AppShell.tsx` đã có `<TaskDetailProvider>` wrap pattern (dòng 10). Story 4.3 mở rộng wrap thêm `<SidebarDrawerProvider>` ngoài cùng (Task D.1.2).
- `AppShell.css` đã có flexbox layout cho `.app-shell` + `.app-shell__body` + `.app-shell__main` + `.app-sidebar` + `.app-top-bar`. Story 4.3 append media queries (Task D.2.1).
- `<Outlet />` mount inside `<main role="main">` (dòng 15) — Story 4.3 KHÔNG đụng `<Outlet />` (sẽ NOT mount khi mobile fallback, qua AppShell-level conditional).

**Từ Story 2.0 (done):**
- `Button.tsx` reuse cho hamburger button trong TopBar — variant `ghost` + size `sm`. **Wait:** Hamburger button có specialized styling (40×40 square, no border, large icon), tốt hơn render qua `<button>` native với class `.app-top-bar__hamburger` thay vì reuse `<Button>`. Decision: native `<button>` cho hamburger. Drawer close button cũng native `<button>` (giống TaskDetailPanel close button pattern).
- `Button.css` `:focus-visible { box-shadow: var(--shadow-focus); }` (dòng 18–21) — Story 4.3 reuse pattern cho hamburger + drawer close + drawer NavLinks focus rings.

**Từ Story 2.3 (done):**
- `TaskBoard.tsx` + `KanbanColumn.tsx` đã wire scroll horizontal qua `TaskBoard.css:6–13` (`overflow-x: auto`). Story 4.3 KHÔNG đụng TSX, chỉ tweak CSS (Task G.1).
- KanbanColumn pattern: width fixed 280px (`KanbanColumn.css:2`). Story 4.3 thêm constraint `min-width: 240px` + Desktop S override `width: 240px`.

**Từ Story 2.4 (done):**
- `TaskDetailPanel.tsx` slide-in pattern với `useEffect` Escape handler + focus close button + backdrop click-to-close. Story 4.3 reuse Escape handler pattern cho `SidebarDrawer`.
- `TaskDetailPanel.css` `position: fixed; width: 420px` (dòng 14–19). Story 4.3 thêm media query Tablet: `width: 100%` (Task F.2.2).
- Backdrop element pattern (`.task-detail-panel__backdrop`) — Story 4.3 reuse cho `.app-sidebar-drawer__backdrop`.

**Từ Story 4.1 (ready-for-dev):**
- Sẽ tạo `frontend/src/features/dashboard/Dashboard.tsx` + `Dashboard.css` + sections. Story 4.3 UPDATE Dashboard.css (Task H.1) sau khi 4.1 done.
- Sẽ tạo `frontend/src/features/dashboard/DashboardStatsBar.tsx` + CSS. Story 4.3 UPDATE để dùng grid auto-fit (Task H.1.3).

**Từ Story 4.2 (ready-for-dev):**
- Sẽ tạo `frontend/src/hooks/useFocusTrap.ts`. Story 4.3 reuse cho `SidebarDrawer` focus trap (Task E.2.1).
- Sẽ UPDATE `AppShell.tsx` thêm `<SkipLink />` + `id="main-content"` + `<SearchOverlayProvider>` wrap. Story 4.3 MUST MERGE thay đổi với additions (Task D.1.5):
  - SidebarDrawerProvider wrap NGOÀI SearchOverlayProvider.
  - Giữ SkipLink + id="main-content" + tabIndex={-1}.
- Sẽ tạo `frontend/src/components/SkipLink.tsx`. Story 4.3 KHÔNG đụng SkipLink (giữ existing).

### Git intelligence

**Recent commits trên `main` (top 5 từ `git log --oneline -10`):**
- Story 4-1, 4-2 just merged (docs only — story creation).
- Epic 1, 2 stories implementation merged.
- Epic 3 stories created (docs) but not yet implemented.

**Patterns observed:**
- Story creation PRs chỉ chứa 2 files: story `.md` + `sprint-status.yaml` update. Story 4.3 PR cùng pattern (CHỈ 2 files).
- Implementation PRs (frontend-only) thường có 8–22 files (components + tests + CSS + hooks + types). Story 4.3 implementation PR (do dev agent tạo sau) sẽ có ~21 files theo tổng kê §"Architecture compliance".
- Test files co-located: `*.test.tsx` / `*.test.ts` cạnh component.

### Latest technical specifics

Không có technical area nào yêu cầu research version mới cho 4.3:
- `window.matchMedia` API — standard Web API, support Chrome 9+ / Firefox 6+ (architecture dòng 1859: "Chrome 120+ primary, Firefox/Edge secondary"). `addEventListener("change", ...)` stable từ DOM Level 4.
- CSS `@media (min-width:)` / `(max-width:)` — CSS3 Media Queries Level 3, universal browser support.
- CSS Grid `repeat(auto-fit, minmax(…, …))` — CSS Grid Level 1, Chrome 57+ / Firefox 52+ — well-supported.
- React 19 strict mode + `useEffect` cleanup — same pattern Story 1.4 + 2.4 đã verified working.
- jsdom 29 KHÔNG implement matchMedia — verified phải mock (xem Task I.1).

### Project Structure Notes

**Alignment với architecture.md (dòng 445–484):**
- `hooks/` directory pre-allocated (dòng 445–449) — architecture list `useTask.ts`, `useTaskList.ts`, etc. Story 4.3 thêm `useMediaQuery.ts` + `useBreakpoint.ts`. **Variance accepted** — generic utility hooks không list explicit.
- `contexts/` directory KHÔNG có trong architecture.md (architecture chỉ list `features/`, `hooks/`, `components/`, `routes/`, `types/`, `styles/`). Story 1.4 đã add `frontend/src/contexts/TaskDetailContext.tsx`. Story 4.3 follow same pattern thêm `SidebarDrawerContext.tsx`. **Variance accepted** — pattern established.
- `test-utils/` directory KHÔNG có trong architecture.md. Story 4.3 thêm `frontend/src/test-utils/matchMedia.ts`. **Detected variance:** Test utility module. Rationale: matchMedia mock reused across multiple test files (hooks, components, features) — centralize trong dedicated module thay vì duplicate import. KHÔNG conflict architecture intent.
- `components/MobileFallback.tsx` + `SidebarDrawer.tsx` — global components ở `components/` (theo pattern `Sidebar.tsx`, `TopBar.tsx`, `AppShell.tsx`).

**Detected variance:** Architecture KHÔNG có rule cụ thể về breakpoint detection / responsive hooks. Story 4.3 establish convention `useMediaQuery` + `useBreakpoint` ở `hooks/`. Future stories cần responsive logic → reuse hooks.

### References

- `_bmad-output/planning-artifacts/epics.md#Story 4.3: Responsive Layout` (dòng 854–894) — Source AC-1 đến AC-7.
- `_bmad-output/planning-artifacts/epics.md#Epic 4 framing` (dòng 192–196, 749–751) — narrative + FRs/NFRs/UX-DRs.
- `_bmad-output/planning-artifacts/epics.md#UX-DR20` (dòng 125, 171) — Responsive Breakpoints summary.
- `_bmad-output/planning-artifacts/epics.md#NFR-6` (dòng 58) — WCAG 2.1 AA (touch target 44×44 cho drawer items).
- `_bmad-output/planning-artifacts/ux-design-specification.md#Responsive Strategy` (dòng 1790–1812) — full breakpoint table.
- `_bmad-output/planning-artifacts/ux-design-specification.md#Layout Adaptation Rules` (dòng 1814–1818) — Kanban + Dashboard adaptation.
- `_bmad-output/planning-artifacts/ux-design-specification.md#Touch targets (Tablet)` (dòng 1844) — 44×44 minimum.
- `_bmad-output/planning-artifacts/ux-design-specification.md#Sidebar specs` (dòng 178–213) — Sidebar 220px, item 34px, icon-only mode 48px.
- `_bmad-output/planning-artifacts/ux-design-specification.md#Layout 3-panel` (dòng 162–176) — Detail Panel slide-in pattern.
- `_bmad-output/planning-artifacts/architecture.md#Project Directory Structure` (dòng 445–484).
- `_bmad-output/project-context.md#Critical Implementation Rules` — Language/Framework rules.
- `frontend/src/components/AppShell.tsx` — current AppShell composition (Story 1.4).
- `frontend/src/components/AppShell.css` — current layout CSS (Story 1.4).
- `frontend/src/components/Sidebar.tsx` (dòng 1) — TODO marker resolved by 4.3.
- `frontend/src/components/TopBar.tsx` — current TopBar (minimal — brand + New Task button).
- `frontend/src/features/detail/TaskDetailPanel.tsx` (dòng 140–147, 178–183) — Escape handler + slide-in pattern.
- `frontend/src/features/detail/TaskDetailPanel.css` (dòng 6–11, 14–29) — Backdrop + Panel positioning.
- `frontend/src/features/board/TaskBoard.css` (dòng 6–13) — overflow-x scroll pattern.
- `frontend/src/features/board/KanbanColumn.css` (dòng 1–10) — column 280px width.
- `frontend/src/styles/tokens.css` — design tokens reference.
- `frontend/src/contexts/TaskDetailContext.tsx` — context pattern reference (`createContext` + Provider + `use<Name>()` hook).
- `frontend/package.json` — pinned dependency versions.
- `frontend/src/test-setup.ts` — vitest setup (sẽ UPDATE matchMedia mock — Task I.1).

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
