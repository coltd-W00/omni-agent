# Story 1.4: AppShell Layout & Routing

**Status:** ready-for-dev
**Epic:** 1 — Project Foundation & Infrastructure
**Story ID:** 1.4
**Story Key:** 1-4-appshell-layout-and-routing

---

## Story

As a developer,
I want một AppShell layout gồm sidebar, topbar, main area và client-side routing với React Router v7,
So that mọi view tương lai dùng chung một navigation structure nhất quán và `/dashboard`, `/board`, plus 404 page đã hoạt động end-to-end.

---

## Acceptance Criteria

**AC-1 (TopBar layout):** Given app load tại `http://localhost:5173` / When inspect layout / Then TopBar render với `height: 52px`, full width, sticky (`position: sticky; top: 0; z-index: 100`), `background: var(--bg-card)`, có `border-bottom: 1px solid var(--border)`.

**AC-2 (Sidebar layout):** Given app load / When inspect sidebar / Then Sidebar có `width: 220px`, fixed bên trái, `background: var(--bg-card)`, `border-right: 1px solid var(--border)`, full viewport height, scrollable khi nội dung dài.

**AC-3 (Main Work Area):** Given app load / When inspect main area / Then Main Work Area `flex-grow: 1`, `background: var(--bg-app)`, `padding: 24px` (`var(--space-6)`), scrollable independent với sidebar, `min-width: 0` (cho phép children co lại).

**AC-4 (Sidebar contents — MVP subset của UX-DR9):** Given sidebar đã render / When inspect contents / Then chứa các phần tử sau theo thứ tự từ trên xuống:
- **Header row** (52px height, align với TopBar): text `OmniAgent` dùng `color: var(--brand-primary)`, `font-weight: 600`.
- **Project Switcher placeholder** (1 row 34px, padding 8px 12px, border-radius 6px): hiển thị text `Default Project ⌄` không click được trong story này; có `data-testid="project-switcher-placeholder"`. Story 2.1 sẽ thay bằng functional dropdown.
- **Nav items** (mỗi item: `<a>` render qua `<NavLink>` của React Router, 34px height, padding 8px 12px, border-radius 6px):
  - `Dashboard` → `/dashboard`
  - `All Tasks` → `/board`
- **Bottom user avatar placeholder** (tách khỏi nav bằng `margin-top: auto`): avatar circle 32px với initial `L`, dùng `background: var(--brand-light)`, `color: var(--brand-primary)`; có `data-testid="user-avatar-placeholder"`. Story future sẽ thay bằng user menu.

KHÔNG implement: search box, Inbox / Review Queue badges, Notifications bell, Project Switcher dropdown, additional nav sections (TASKS / AGENTS / PROJECT) — các phần đó thuộc các story sau (2.0, 2.1, 4.x).

**AC-5 (Active nav state):** Given user đang ở route `/dashboard` (hoặc `/board`) / When inspect nav item tương ứng / Then nav item có `background: var(--brand-light)`, `color: var(--brand-primary)`, `font-weight: 500`. Inactive items mặc định: `color: var(--text-primary)`, hover state có `background: var(--bg-hover)`. Active state phải được apply qua `NavLink` `className` callback (dùng `isActive` flag) — KHÔNG hardcode active class bằng `useLocation` thủ công.

**AC-6 (React Router v7 setup):** Given `main.tsx` đã được cập nhật / When inspect runtime / Then `BrowserRouter` (React Router v7 / `react-router@7.x`) wrap toàn bộ `<App />`. Routes được khai báo trong `App.tsx` qua `<Routes>` + `<Route>` JSX (NOT data-router APIs `createBrowserRouter` ở story này — giữ minimal). Route table tối thiểu:
- `/` → redirect (`<Navigate to="/dashboard" replace />`) tới `/dashboard`
- `/dashboard` → `<DashboardRoute />` (placeholder page)
- `/board` → `<BoardRoute />` (placeholder page)
- `*` → `<NotFoundRoute />` (404 page)

**AC-7 (Route switching không full reload):** Given app đang ở `/dashboard` / When user click nav item `All Tasks` / Then URL bar đổi thành `/board`, Main Work Area render `<BoardRoute />` placeholder, **toàn bộ trang KHÔNG full-reload** (verify: TopBar / Sidebar instance giữ nguyên, không có flash trắng). Network tab chỉ thấy HMR/dev assets, không thấy navigation request HTML.

**AC-8 (Placeholder pages):** Given route render bên trong AppShell / When inspect page contents:
- `DashboardRoute`: `<h1>Dashboard</h1>` (`var(--font-size-heading-l)`) + `<p>Placeholder for morning dashboard (Story 4.1).</p>` (`var(--text-secondary)`). Có `data-testid="dashboard-route"`.
- `BoardRoute`: `<h1>Task Board</h1>` + `<p>Placeholder for kanban view (Story 2.3).</p>`. Có `data-testid="board-route"`.
- `NotFoundRoute`: `<h1>404 — Page not found</h1>` + `<p>Route không tồn tại. <Link to="/dashboard">Quay lại Dashboard</Link>.</p>`. Có `data-testid="not-found-route"`. Status code không cần custom (SPA — server vẫn trả 200 cho `index.html`, đây là client-side 404).

KHÔNG thêm dashboard sections, kanban columns, hay bất kỳ business UI nào — chỉ placeholder.

**AC-9 (Unknown route renders 404 inside AppShell):** Given app load / When user navigate tới `/random-unknown-route` (qua URL bar hoặc programmatic) / Then `<NotFoundRoute />` render bên trong Main Work Area **với Sidebar và TopBar vẫn visible** (không full-screen 404). Click `Quay lại Dashboard` link → URL đổi `/dashboard`, render `<DashboardRoute />`.

**AC-10 (Routes định nghĩa qua AppShell layout):** Given route tree / When inspect cấu trúc / Then mọi route (Dashboard, Board, NotFound) được render bên trong một `<AppShell>` component duy nhất — bằng cách nest routes (`<Route element={<AppShell />}>` + `<Outlet />`) **hoặc** wrap `<AppShell>` ở root component trước `<Routes>`. Bất kỳ approach nào cũng OK miễn là sidebar/topbar KHÔNG re-mount khi đổi route (verify bằng React DevTools hoặc bằng key/effect probe).

**AC-11 (File structure — chỉ tạo những file story này yêu cầu):** Given inspect `frontend/src/` sau story này / Then có các file:
- `frontend/src/main.tsx` — wrap với `<BrowserRouter>` (cập nhật)
- `frontend/src/App.tsx` — define `<Routes>` (cập nhật, remove probe content)
- `frontend/src/components/AppShell.tsx` — layout component
- `frontend/src/components/AppShell.module.css` — layout styles (CSS Module hoặc plain `.css`; xem Dev Notes — chọn pattern và document)
- `frontend/src/components/Sidebar.tsx`
- `frontend/src/components/TopBar.tsx`
- `frontend/src/routes/DashboardRoute.tsx`
- `frontend/src/routes/BoardRoute.tsx`
- `frontend/src/routes/NotFoundRoute.tsx`

KHÔNG tạo: `frontend/src/api/`, `frontend/src/hooks/`, `frontend/src/features/`, `frontend/src/types/`, `frontend/src/components/StatusBadge.tsx`, etc. — các folder đó thuộc Story 2.0 / 2.x.

**AC-12 (TypeScript strict pass):** Given `cd frontend && npx tsc --noEmit` / When chạy / Then exit code 0, 0 errors. Build pass: `npm run build` thành công, tạo `frontend/dist/`.

**AC-13 (Responsive defer):** Given viewport ≤1280px / Then **không cần** collapse sidebar về icon-only trong story này. UX-DR9 / UX-DR20 quy định icon-only mode ≤1280px nhưng đó là scope của Story 4.3 (Responsive Layout). Story 1.4 cố định sidebar 220px ở mọi breakpoint. Comment `// TODO(Story 4.3): collapse sidebar to icon-only at ≤1280px` ở đầu `Sidebar.tsx`.

**AC-14 (Detail Panel defer):** Given UX-DR9 mô tả AppShell có Detail Panel slide-in 420px / Then Story 1.4 **KHÔNG** implement Detail Panel — chỉ TopBar + Sidebar + Main. Detail Panel render qua portal/conditional khi mở task detail (Story 2.4). Comment `// TODO(Story 2.4): mount Detail Panel slot here` trong `AppShell.tsx` ở vị trí phía sau `<Outlet />`.

---

## Tasks / Subtasks

- [ ] **Task 1: Cài React Router v7** (AC: 6, 11, 12)
  - [ ] 1.1 Verify Story 1.3 đã chạy: `frontend/package.json` tồn tại, có `react@^19`, `react-dom@^19`, `vite@^9`, `typescript@^5`, và `frontend/src/styles/tokens.css` đã import qua `global.css`. Nếu Story 1.3 chưa merge → **dừng và đặt câu hỏi** (xem Dependencies & Risks).
  - [ ] 1.2 Từ `frontend/`, chạy `npm install react-router@7.15.1` (architecture pin version 7.15.1; xem Dev Notes). Verify `package.json` ghi `"react-router": "^7.15.1"` hoặc `"7.15.1"` exact — chọn pattern khớp với cách cài đặt của các dep khác trong story 1.3.
  - [ ] 1.3 KHÔNG cài `react-router-dom` riêng — React Router v7 hợp nhất package `react-router` và `react-router-dom` (xem release notes 7.0). Import từ `"react-router"` (không phải `"react-router-dom"`).
  - [ ] 1.4 KHÔNG cài: `@tanstack/react-query` (Story 2.x), `vitest` / `@testing-library/*` (Story 2.0), `react-router-dom` legacy. Mỗi cái có story riêng.

- [ ] **Task 2: Tạo `AppShell` layout component** (AC: 1, 2, 3, 10, 11, 14)
  - [ ] 2.1 Tạo thư mục `frontend/src/components/`.
  - [ ] 2.2 Tạo `frontend/src/components/AppShell.tsx`:
    - Import `Outlet` từ `"react-router"`, import `TopBar` và `Sidebar`.
    - Layout root `<div>` dùng flexbox (column): TopBar trên (52px), bên dưới là row chứa Sidebar (220px) + Main (`<main role="main">` chứa `<Outlet />`).
    - Đảm bảo Main có `min-width: 0` để children không overflow ngang.
    - Thêm comment `// TODO(Story 2.4): mount Detail Panel slot here` ngay sau `<Outlet />` (vị trí dự kiến của Detail Panel).
  - [ ] 2.3 Tạo `frontend/src/components/AppShell.module.css` (hoặc `.css` thuần — chọn 1 pattern và áp dụng cho toàn bộ story, document trong Dev Notes). Recommended: plain `.css` file imported in component (`import "./AppShell.css"`) vì Vite hỗ trợ ra-of-the-box và project KHÔNG dùng CSS Modules. Class names dùng prefix `app-shell-*` (BEM-like) để tránh collision.
  - [ ] 2.4 Implement styles theo AC-1/2/3:
    ```css
    .app-shell {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    .app-shell__body {
      display: flex;
      flex: 1 1 auto;
      min-height: 0;
    }
    .app-shell__main {
      flex: 1 1 auto;
      min-width: 0;
      background: var(--bg-app);
      padding: var(--space-6);
      overflow: auto;
    }
    ```
  - [ ] 2.5 KHÔNG hardcode hex / px size ngoài design tokens — `--space-6` = 24px (đã định nghĩa trong tokens.css). Nếu không có token tương ứng (vd 52px, 220px), dùng số literal nhưng phải có comment giải thích đến từ UX-DR9.

- [ ] **Task 3: Tạo `TopBar` component** (AC: 1, 4, 11)
  - [ ] 3.1 Tạo `frontend/src/components/TopBar.tsx`:
    - Root: `<header role="banner">` với class `app-top-bar`.
    - Nội dung tối thiểu: text `omni-agent` (`var(--text-primary)`, `font-weight: 600`, `font-size: var(--font-size-heading-m)`). KHÔNG có search, breadcrumb, notification bell, avatar — các phần đó thuộc story sau.
    - Comment `// TODO(Story 2.x): add Breadcrumb, Search, New Task button, Notification bell, User avatar (UX-DR9 / UX section 2.3)` ở đầu component.
  - [ ] 3.2 Styles trong cùng CSS file:
    ```css
    .app-top-bar {
      height: 52px;
      position: sticky;
      top: 0;
      z-index: 100;
      background: var(--bg-card);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      padding: 0 var(--space-6);
    }
    ```

- [ ] **Task 4: Tạo `Sidebar` component với NavLinks** (AC: 2, 4, 5, 7, 11, 13)
  - [ ] 4.1 Tạo `frontend/src/components/Sidebar.tsx`:
    - Import `NavLink` từ `"react-router"`.
    - Root: `<aside role="navigation" aria-label="Primary">` với class `app-sidebar`.
    - Header row (52px): text `OmniAgent` (`color: var(--brand-primary)`, `font-weight: 600`).
    - Project Switcher placeholder: `<button data-testid="project-switcher-placeholder" disabled>Default Project ⌄</button>` (visually styled như dropdown, nhưng disabled — tooltip "Coming in Story 2.1").
    - Nav list `<nav><ul>`:
      - `<li><NavLink to="/dashboard" className={({isActive}) => isActive ? "app-sidebar__item app-sidebar__item--active" : "app-sidebar__item"}>Dashboard</NavLink></li>`
      - `<li><NavLink to="/board" className={...same pattern...}>All Tasks</NavLink></li>`
    - Bottom: `<div data-testid="user-avatar-placeholder" className="app-sidebar__avatar"><span>L</span></div>` (margin-top: auto).
    - Comment `// TODO(Story 4.3): collapse sidebar to icon-only at ≤1280px (UX-DR20)` ở đầu file.
    - Comment `// TODO(Story 2.x): add Inbox, Review Queue, AGENTS section, Settings (UX section 2.2)` cũng ở đầu file.
  - [ ] 4.2 Styles:
    ```css
    .app-sidebar {
      width: 220px;
      flex-shrink: 0;
      background: var(--bg-card);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      overflow: auto;
    }
    .app-sidebar__header { height: 52px; display: flex; align-items: center; padding: 0 var(--space-4); }
    .app-sidebar__nav { padding: var(--space-2) var(--space-3); }
    .app-sidebar__nav ul { list-style: none; padding: 0; margin: 0; }
    .app-sidebar__item {
      display: block;
      height: 34px;
      line-height: 34px;
      padding: 0 var(--space-3);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      text-decoration: none;
      font-size: var(--font-size-body);
    }
    .app-sidebar__item:hover { background: var(--bg-hover); }
    .app-sidebar__item--active {
      background: var(--brand-light);
      color: var(--brand-primary);
      font-weight: 500;
    }
    .app-sidebar__avatar {
      margin-top: auto;
      padding: var(--space-4);
      display: flex;
      align-items: center;
    }
    ```
  - [ ] 4.3 Verify token names đúng với `frontend/src/styles/tokens.css` của Story 1.3 — đặc biệt `--radius-sm`, `--space-2`, `--space-3`, `--space-4`, `--space-6`. Nếu mapping khác (Story 1.3 dùng tên hơi khác), cập nhật class CSS để khớp; KHÔNG sửa `tokens.css`.

- [ ] **Task 5: Tạo placeholder route components** (AC: 8, 9, 11)
  - [ ] 5.1 Tạo thư mục `frontend/src/routes/`.
  - [ ] 5.2 Tạo `frontend/src/routes/DashboardRoute.tsx`:
    ```tsx
    export default function DashboardRoute() {
      return (
        <section data-testid="dashboard-route">
          <h1 style={{ fontSize: "var(--font-size-heading-l)", margin: 0 }}>Dashboard</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "var(--space-2)" }}>
            Placeholder for morning dashboard (Story 4.1).
          </p>
        </section>
      );
    }
    ```
  - [ ] 5.3 Tạo `frontend/src/routes/BoardRoute.tsx` (tương tự, text "Task Board" / "Placeholder for kanban view (Story 2.3).", `data-testid="board-route"`).
  - [ ] 5.4 Tạo `frontend/src/routes/NotFoundRoute.tsx`:
    ```tsx
    import { Link } from "react-router";

    export default function NotFoundRoute() {
      return (
        <section data-testid="not-found-route">
          <h1 style={{ fontSize: "var(--font-size-heading-l)", margin: 0 }}>404 — Page not found</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "var(--space-2)" }}>
            Route không tồn tại.{" "}
            <Link to="/dashboard" style={{ color: "var(--brand-primary)" }}>
              Quay lại Dashboard
            </Link>.
          </p>
        </section>
      );
    }
    ```
  - [ ] 5.5 KHÔNG implement business logic, fetch, hay state — chỉ JSX tĩnh.

- [ ] **Task 6: Wire router trong `main.tsx` và `App.tsx`** (AC: 6, 7, 9, 10, 11, 12)
  - [ ] 6.1 Mở `frontend/src/main.tsx` (đã được cập nhật ở Story 1.3 để import `./styles/global.css`).
  - [ ] 6.2 Wrap `<App />` bằng `<BrowserRouter>`:
    ```tsx
    import React from "react";
    import ReactDOM from "react-dom/client";
    import { BrowserRouter } from "react-router";
    import App from "./App";
    import "./styles/global.css";

    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </React.StrictMode>,
    );
    ```
  - [ ] 6.3 Mở `frontend/src/App.tsx` — XÓA toàn bộ probe content (heading + token probe badge) đã được tạo ở Story 1.3. Comment `// TODO(Story 1.4): replace probe with AppShell` đã được Story 1.3 ghi nhận; thay bằng routes thật:
    ```tsx
    import { Routes, Route, Navigate } from "react-router";
    import AppShell from "./components/AppShell";
    import DashboardRoute from "./routes/DashboardRoute";
    import BoardRoute from "./routes/BoardRoute";
    import NotFoundRoute from "./routes/NotFoundRoute";

    export default function App() {
      return (
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardRoute />} />
            <Route path="/board" element={<BoardRoute />} />
            <Route path="*" element={<NotFoundRoute />} />
          </Route>
        </Routes>
      );
    }
    ```
  - [ ] 6.4 Verify `Outlet` được render đúng vị trí trong `AppShell.tsx` — nested route pattern cần `<Outlet />`, không dùng children prop.

- [ ] **Task 7: Verify build, typecheck và acceptance criteria** (AC: 1–14)
  - [ ] 7.1 `cd frontend && npm install` — pass.
  - [ ] 7.2 `npx tsc --noEmit` — 0 errors. Nếu có lỗi liên quan tới `Outlet` type hoặc `NavLink` className callback, đọc kỹ React Router 7 types (xem Dev Notes).
  - [ ] 7.3 `npm run build` — pass, tạo `frontend/dist/`.
  - [ ] 7.4 `npm run dev` chạy nền → mở `http://localhost:5173/`:
    - URL tự redirect sang `/dashboard` (AC-6 root index route).
    - TopBar 52px sticky trên cùng với text "omni-agent".
    - Sidebar 220px bên trái với "OmniAgent" header, project switcher placeholder (disabled), Dashboard và All Tasks nav, avatar "L" ở đáy.
    - Main area hiện "Dashboard" heading + placeholder text.
  - [ ] 7.5 Click nav "All Tasks": URL đổi `/board`, main area đổi sang "Task Board" placeholder, **không có flash full reload** (TopBar/Sidebar giữ nguyên DOM identity).
  - [ ] 7.6 Inspect nav item: `/dashboard` active → background `--brand-light`; `/board` active → background `--brand-light`.
  - [ ] 7.7 Manual navigate tới `http://localhost:5173/something-not-exists` → NotFound page hiện trong Main, Sidebar/TopBar vẫn visible.
  - [ ] 7.8 Click "Quay lại Dashboard" trên 404 page → URL `/dashboard`, render đúng.
  - [ ] 7.9 (Optional manual) DevTools React: confirm `AppShell` component không bị unmount khi đổi route — chỉ `Outlet` con đổi.
  - [ ] 7.10 `git status` — chỉ thấy file mới/sửa trong `frontend/src/`, `frontend/package.json`, `frontend/package-lock.json`, `_bmad-output/implementation-artifacts/`, `docs/`. KHÔNG thấy `node_modules/`, `frontend/dist/`, `frontend/.vite/`.

- [ ] **Task 8: Cập nhật docs và harness artifacts** (Done Definition theo AGENTS.md)
  - [ ] 8.1 Cập nhật `docs/TEST_MATRIX.md` row 1.4: chuyển `Status` từ `planned` sang `implemented`. Evidence: link tới story file + screenshot/manual verification note + ghi nhận `npx tsc --noEmit` + `npm run build` pass. Mục `Unit/Integration/E2E/Platform` để `manual` (không có test framework cho frontend đến Story 2.0).
  - [ ] 8.2 Cập nhật `docs/stories/backlog.md`: Story 1.4 row → status `done` (sau khi merge) — story creation phase chỉ chuyển `backlog` → `ready-for-dev` và update `Artifact` column tới `_bmad-output/implementation-artifacts/1-4-appshell-layout-and-routing.md`.
  - [ ] 8.3 Cập nhật `_bmad-output/implementation-artifacts/sprint-status.yaml`: `1-4-appshell-layout-and-routing: backlog` → `ready-for-dev`. Update `last_updated` field.
  - [ ] 8.4 KHÔNG tạo `docs/decisions/` mới trừ khi developer phát hiện vấn đề mới phải decide (vd: chọn CSS Modules vs plain CSS có lý do mới ngoài Dev Notes section bên dưới).

---

## Dev Notes

### ⚠️ Dependencies & Risks

**HARD PREREQUISITE — Story 1.3 phải đã được dev agent execute trước:**
- Tại thời điểm tạo story này, sprint-status.yaml ghi `1-3-frontend-scaffold-and-design-tokens: ready-for-dev` (chưa `done`). Story 1.4 **không thể bắt đầu** nếu `frontend/package.json`, `frontend/src/main.tsx`, `frontend/src/styles/tokens.css`, `frontend/vite.config.ts` chưa tồn tại.
- Khi dev agent bắt đầu Story 1.4: **Trước tiên verify Story 1.3 đã merge** (check `frontend/package.json` tồn tại và có React 19 + Vite 9). Nếu chưa, **dừng và yêu cầu** human chạy Story 1.3 trước. KHÔNG re-scaffold frontend trong story này.

**Soft dependency:**
- Story 1.1 (Monorepo Setup & Backend Scaffold) — `done`. Backend route `GET /health` không cần thiết cho Story 1.4 vì story này 100% frontend.
- Story 1.2 (Database Schema & Migrations) — `review`. Không phụ thuộc.

### Stack & Phiên bản

| Package | Version | Lý do |
|---|---|---|
| react-router | 7.15.1 | Pin version theo `_bmad-output/planning-artifacts/architecture.md` line 235 ("React Router v7 ... 7.15.1"). React Router v7 hợp nhất `react-router` và `react-router-dom` — import từ `"react-router"`. |
| react / react-dom | ^19 (đã cài từ Story 1.3) | Không upgrade trong story này. |
| typescript | ^5 (đã cài từ Story 1.3) | Strict mode bắt buộc. |
| vite | ^9 (đã cài từ Story 1.3) | Dev server + build. |

**KHÔNG cài thêm trong story này:**
- `react-router-dom` — đã merge vào `react-router` v7 (xem [React Router v7 migration guide](https://reactrouter.com/upgrading/v6)). Cài `react-router-dom` sẽ tạo duplicate types và conflict.
- `@tanstack/react-query` — Story 2.x.
- `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` — Story 2.0 (Shared UI Components) là story đầu tiên cần testing.
- `react-router-dom-v5-compat`, `history` — không cần cho v7 fresh install.

### React Router v7 — Patterns phải tuân thủ

**Import path:** Mọi import (BrowserRouter, Routes, Route, NavLink, Link, Outlet, Navigate) đều từ `"react-router"` (KHÔNG `"react-router-dom"`).

**Declarative routes (JSX), không data router:** Story 1.4 dùng `<BrowserRouter>` + `<Routes>` + `<Route>` (declarative). KHÔNG dùng `createBrowserRouter` / `RouterProvider` / loaders / actions / data router features. Lý do:
- Story chỉ cần navigation cơ bản; loaders sẽ được Story 2.x evaluate khi cần data-fetching trong route boundaries.
- Tránh forward-commit cho TanStack Query integration pattern chưa có quyết định kiến trúc.

**Nested layout route pattern:**
```tsx
<Routes>
  <Route element={<AppShell />}>
    <Route index element={<Navigate to="/dashboard" replace />} />
    <Route path="/dashboard" element={<DashboardRoute />} />
    <Route path="/board" element={<BoardRoute />} />
    <Route path="*" element={<NotFoundRoute />} />
  </Route>
</Routes>
```
- Route cha không có `path` — chỉ wrap `element={<AppShell />}`. AppShell render `<Outlet />` ở vị trí Main Work Area.
- `index` route bên trong layout = match parent path (`/`) chính xác → redirect tới `/dashboard`.
- `*` catch-all PHẢI nằm bên trong layout route (không ngoài) để 404 page render trong AppShell (AC-9).

**NavLink active state:**
```tsx
<NavLink
  to="/dashboard"
  className={({ isActive }) =>
    isActive ? "app-sidebar__item app-sidebar__item--active" : "app-sidebar__item"
  }
>
  Dashboard
</NavLink>
```
- Dùng `className` callback `({ isActive }) => string`. KHÔNG dùng `useLocation` rồi compare path thủ công.
- KHÔNG dùng `style` callback (tránh inline style — story này dùng CSS class).
- `end` prop: không cần cho `/dashboard` vì path không có nested sub-routes. Nếu sau này thêm `/dashboard/something`, cân nhắc `end` flag.

**Type compatibility:** React Router 7 ship TypeScript types built-in. KHÔNG cần cài `@types/react-router` (deprecated). Nếu `npx tsc --noEmit` báo missing types, double check `import` path đúng `"react-router"` và package version `7.15.x`.

### CSS Strategy quyết định cho story này

Project hiện không dùng CSS Modules (Story 1.3 chỉ có `tokens.css` + `global.css` thuần). Story 1.4 sẽ:
- Tạo `frontend/src/components/AppShell.css` (plain CSS), import trực tiếp trong `AppShell.tsx` qua `import "./AppShell.css"` — Vite hỗ trợ side-effect CSS import out-of-the-box.
- Class names dùng prefix `app-shell-*`, `app-top-bar`, `app-sidebar`, `app-sidebar__item` (BEM-like) để tránh collision với future components.
- **KHÔNG** dùng inline `style` ngoài các trường hợp 1-off (placeholder route headings/paragraphs nhỏ — chấp nhận được).
- **KHÔNG** thêm CSS Modules (`*.module.css`) hay CSS-in-JS — sẽ tăng surface area cho Story 2.0 mà không có decision support.

Tất cả color/spacing/radius/shadow value dùng CSS variables từ `tokens.css` — KHÔNG hardcode hex (architecture enforcement, xem `_bmad-output/planning-artifacts/architecture.md` "Enforcement Guidelines").

### File phải tạo mới (NEW)

```
frontend/src/
├── main.tsx                            ← SỬA: thêm BrowserRouter wrapper
├── App.tsx                             ← SỬA: thay probe content bằng <Routes>
├── components/                         ← TẠO MỚI thư mục
│   ├── AppShell.tsx                    ← TẠO MỚI
│   ├── AppShell.css                    ← TẠO MỚI (chứa style cho AppShell, TopBar, Sidebar)
│   ├── TopBar.tsx                      ← TẠO MỚI
│   └── Sidebar.tsx                     ← TẠO MỚI
└── routes/                             ← TẠO MỚI thư mục
    ├── DashboardRoute.tsx              ← TẠO MỚI
    ├── BoardRoute.tsx                  ← TẠO MỚI
    └── NotFoundRoute.tsx               ← TẠO MỚI
```

**KHÔNG tạo:**
- `frontend/src/api/`, `frontend/src/hooks/`, `frontend/src/types/`, `frontend/src/features/` — thuộc Story 2.x. AGENTS.md hard rule: "Không scaffold thêm application source folders ... trừ khi một selected story rõ ràng yêu cầu".
- `frontend/src/components/StatusBadge.tsx`, `Toast.tsx`, `ConfirmationDialog.tsx`, etc. — thuộc Story 2.0.
- `frontend/src/components/Sidebar.test.tsx`, etc. — không có test framework cho frontend đến Story 2.0.

### File phải sửa (UPDATE)

**`frontend/src/main.tsx`** — wrap `<App />` bằng `<BrowserRouter>` (nội dung đầy đủ trong Task 6.2). Preserve `import "./styles/global.css"` và `React.StrictMode`.

**`frontend/src/App.tsx`** — REMOVE probe content (heading + token badge từ Story 1.3). REPLACE bằng `<Routes>` declaration (nội dung đầy đủ trong Task 6.3). XÓA comment `// TODO(Story 1.4): replace probe with AppShell` đã được Story 1.3 đặt (đã hoàn thành ở story này).

**`frontend/package.json`** — `npm install react-router@7.15.1` sẽ tự thêm `"react-router": "^7.15.1"` hoặc `"7.15.1"` vào dependencies. KHÔNG sửa thủ công.

**`frontend/package-lock.json`** — auto-update bởi npm install. Commit cùng `package.json`.

### Nội dung `frontend/src/main.tsx` (sau Story 1.4)

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
```

### Nội dung `frontend/src/App.tsx` (sau Story 1.4)

```tsx
import { Routes, Route, Navigate } from "react-router";
import AppShell from "./components/AppShell";
import DashboardRoute from "./routes/DashboardRoute";
import BoardRoute from "./routes/BoardRoute";
import NotFoundRoute from "./routes/NotFoundRoute";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardRoute />} />
        <Route path="/board" element={<BoardRoute />} />
        <Route path="*" element={<NotFoundRoute />} />
      </Route>
    </Routes>
  );
}
```

### Nội dung `frontend/src/components/AppShell.tsx`

```tsx
// TODO(Story 2.4): mount Detail Panel slot here (UX-DR9: 420px slide-in từ phải).
import { Outlet } from "react-router";
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";
import "./AppShell.css";

export default function AppShell() {
  return (
    <div className="app-shell">
      <TopBar />
      <div className="app-shell__body">
        <Sidebar />
        <main className="app-shell__main" role="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

### Nội dung `frontend/src/components/AppShell.css`

```css
/* AppShell layout — UX section 2.1, UX-DR9 */
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-shell__body {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
}

.app-shell__main {
  flex: 1 1 auto;
  min-width: 0;
  background: var(--bg-app);
  padding: var(--space-6);
  overflow: auto;
}

/* TopBar — UX section 2.3 (subset: chỉ logo, các nút khác Story 2.x) */
.app-top-bar {
  height: 52px; /* UX-DR9 */
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 var(--space-6);
}

.app-top-bar__brand {
  color: var(--text-primary);
  font-weight: 600;
  font-size: var(--font-size-heading-m);
}

/* Sidebar — UX section 2.2 (subset cho Story 1.4) */
.app-sidebar {
  width: 220px; /* UX-DR9 */
  flex-shrink: 0;
  background: var(--bg-card);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: auto;
}

.app-sidebar__header {
  height: 52px;
  display: flex;
  align-items: center;
  padding: 0 var(--space-4);
  color: var(--brand-primary);
  font-weight: 600;
  font-size: var(--font-size-heading-m);
}

.app-sidebar__project-switcher {
  margin: var(--space-2) var(--space-3);
  height: 34px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-secondary);
  text-align: left;
  cursor: not-allowed;
  font-size: var(--font-size-body);
}

.app-sidebar__nav {
  padding: var(--space-2) var(--space-3);
}

.app-sidebar__nav ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.app-sidebar__item {
  display: block;
  height: 34px;
  line-height: 34px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  text-decoration: none;
  font-size: var(--font-size-body);
}

.app-sidebar__item:hover {
  background: var(--bg-hover);
}

.app-sidebar__item--active {
  background: var(--brand-light);
  color: var(--brand-primary);
  font-weight: 500;
}

.app-sidebar__avatar {
  margin-top: auto;
  padding: var(--space-4);
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.app-sidebar__avatar-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--brand-light);
  color: var(--brand-primary);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

**Lưu ý:** Nếu `tokens.css` của Story 1.3 dùng tên khác (vd `--space-sm` thay vì `--space-2`), developer phải sửa CSS class trên cho khớp — KHÔNG sửa `tokens.css`. Verify tên tokens trong `frontend/src/styles/tokens.css` trước khi viết CSS.

### Nội dung `frontend/src/components/TopBar.tsx`

```tsx
// TODO(Story 2.x): add Breadcrumb, Search box, New Task button, Notification bell, User avatar (UX-DR9 / UX section 2.3).
export default function TopBar() {
  return (
    <header className="app-top-bar" role="banner">
      <span className="app-top-bar__brand">omni-agent</span>
    </header>
  );
}
```

### Nội dung `frontend/src/components/Sidebar.tsx`

```tsx
// TODO(Story 4.3): collapse sidebar to icon-only at ≤1280px (UX-DR20).
// TODO(Story 2.x): add Inbox, Review Queue badges, AGENTS section, Settings link (UX section 2.2).
import { NavLink } from "react-router";

const itemClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "app-sidebar__item app-sidebar__item--active" : "app-sidebar__item";

export default function Sidebar() {
  return (
    <aside className="app-sidebar" role="navigation" aria-label="Primary">
      <div className="app-sidebar__header">OmniAgent</div>
      <button
        type="button"
        className="app-sidebar__project-switcher"
        data-testid="project-switcher-placeholder"
        disabled
        title="Coming in Story 2.1"
      >
        Default Project ⌄
      </button>
      <nav className="app-sidebar__nav">
        <ul>
          <li>
            <NavLink to="/dashboard" className={itemClass}>
              Dashboard
            </NavLink>
          </li>
          <li>
            <NavLink to="/board" className={itemClass}>
              All Tasks
            </NavLink>
          </li>
        </ul>
      </nav>
      <div className="app-sidebar__avatar" data-testid="user-avatar-placeholder">
        <span className="app-sidebar__avatar-circle" aria-label="User avatar (Loc)">
          L
        </span>
      </div>
    </aside>
  );
}
```

### Cross-story dependencies

Story 1.4 là **prerequisite** cho:
- **Story 2.0 (Shared UI Components):** Cần AppShell để render components trong context layout. `Depends on: Story 1.3 (Design Tokens), Story 1.4 (AppShell Layout)` — xem `_bmad-output/planning-artifacts/epics.md` line 328.
- **Story 2.1 (Project Management):** Project Switcher sẽ thay placeholder ở Sidebar header.
- **Story 2.3 (Task Board Kanban View):** BoardRoute placeholder sẽ được thay bằng kanban board thật.
- **Story 4.1 (Morning Dashboard):** DashboardRoute placeholder sẽ thay bằng dashboard sections thật.
- **Story 4.3 (Responsive Layout):** Sidebar collapse logic, breakpoint media queries.

KHÔNG có story nào ngoài Story 2.x/4.x được phép sửa AppShell layout sau khi story này merge — nếu phải thay đổi layout structure, mở decision mới trong `docs/decisions/`.

### Learnings từ Story 1.3 (planned, chưa execute tại lúc tạo story này)

| Learning | Tác động đến Story 1.4 |
|---|---|
| `tokens.css` chứa neutrals, brand, status, spacing, radius, shadow, font tokens | Story 1.4 chỉ DÙNG token names, KHÔNG hardcode hex / px ngoài 52px / 220px / 34px / 32px (đến từ UX spec, không thuộc token scale) |
| `global.css` import `tokens.css` qua `@import "./tokens.css"` | Story 1.4 KHÔNG cần re-import tokens — đã global |
| Probe `App.tsx` là tạm — Story 1.4 thay | Task 6.3 chính thức replace probe |
| Vite proxy `/api` → backend với `rewrite: path => path.replace(/^\/api/, "")` | Story 1.4 KHÔNG cần fetch — không tương tác proxy. KHÔNG sửa `vite.config.ts` |
| TypeScript strict + `noUnusedLocals` + `noUnusedParameters` | Sidebar/TopBar callbacks dùng `({ isActive }: { isActive: boolean })` — destructure đầy đủ; nếu để `(_props: any) => ...` sẽ fail |
| `frontend/.gitignore` cover `node_modules/`, `frontend/dist/`, `frontend/.vite/` | Story 1.4 KHÔNG sửa .gitignore |

### Kiểm tra thủ công sau khi implement

```bash
# Verify Story 1.3 đã merge trước (prerequisite)
test -f frontend/package.json && grep -q '"react"' frontend/package.json || \
  { echo "Story 1.3 chưa execute — dừng"; exit 1; }

# Install React Router v7
cd frontend
npm install react-router@7.15.1

# Typecheck
npx tsc --noEmit
# Expect: exit 0, no errors

# Production build
npm run build
# Expect: frontend/dist/ tạo, exit 0

# Dev server (terminal khác nếu cần manual visual check)
npm run dev
# Expect: "Local: http://localhost:5173/"

# Manual browser checks (http://localhost:5173):
# 1. URL tự redirect / → /dashboard
# 2. TopBar 52px sticky, text "omni-agent" trong nó
# 3. Sidebar 220px bên trái: "OmniAgent" header (indigo), project switcher disabled,
#    "Dashboard" và "All Tasks" nav, avatar "L" ở đáy
# 4. Main area: "Dashboard" heading + placeholder text
# 5. Click "All Tasks" → URL /board, main đổi sang "Task Board" placeholder,
#    TopBar/Sidebar KHÔNG flash hoặc reload
# 6. Nav item active có background indigo nhạt + text indigo đậm
# 7. Manual URL /random-something → NotFound page trong main, sidebar/topbar visible
# 8. Click "Quay lại Dashboard" trên 404 → /dashboard

# Visual evidence (optional): screenshot 3 routes (Dashboard, Board, NotFound)
```

### Project Structure Notes

- **Boundary:** AppShell và Sidebar/TopBar nằm ở `frontend/src/components/` (architecture đặt presentational components ở đây — xem `_bmad-output/planning-artifacts/architecture.md` line 450). Routes ở `frontend/src/routes/` (architecture đặt route components ở đây — line 478-481).
- **Architecture line 478-481** liệt kê `DashboardRoute.tsx`, `BoardRoute.tsx`, `TaskRoute.tsx`. Story 1.4 tạo 2 file đầu + `NotFoundRoute.tsx` (không có trong architecture list nhưng cần cho AC-9 — document như extension hợp lý, không phải decision mới).
- **CSS file location:** `AppShell.css` đặt cạnh `AppShell.tsx` (component-local convention). Không tạo `frontend/src/styles/components/` riêng — sẽ phình to khi có nhiều component. Pattern này phù hợp với hướng dẫn "feature-scoped colocation" của architecture line 450-484.
- **`Outlet` ownership:** Chỉ `AppShell.tsx` được phép render `<Outlet />`. Không component nào khác trong `frontend/src/` được phép import `Outlet` ở story này. Khi Story 2.4 thêm Task Detail Panel, nó render qua portal/conditional bên cạnh `<Outlet />`, không tạo nested router.
- **Detail Panel scope split (cảnh báo cho dev agent):** UX-DR9 mô tả AppShell bao gồm Detail Panel 420px. Story 1.4 KHÔNG implement Detail Panel — chỉ TopBar + Sidebar + Main. Detail Panel phụ thuộc Task Detail (Story 2.4) và có animation `translateX(100%)` → `translateX(0)` cần state management. Document split này rõ trong Task 2.2 comment.

### Spec Gap đã phát hiện (ghi nhận để decision sau)

| Gap | Nguồn | Quyết định tạm | Story xử lý |
|---|---|---|---|
| Architecture line 478-481 không liệt kê `NotFoundRoute.tsx` | `_bmad-output/planning-artifacts/architecture.md` line 478-481 vs epics.md line 312-314 (AC yêu cầu 404 page) | Tạo `NotFoundRoute.tsx` trong `frontend/src/routes/` — document như natural extension của route folder, KHÔNG mở decision mới | Nếu sau này có nhiều error page (403, 500), cân nhắc `frontend/src/routes/_errors/` |
| UX-DR9 mô tả AppShell có Detail Panel 420px, nhưng AppShell được tạo ở Story 1.4 còn Detail Panel ở Story 2.4 | `_bmad-output/planning-artifacts/epics.md` line 103 vs Story 2.4 scope | Story 1.4 chỉ implement TopBar + Sidebar + Main; Detail Panel slot là `// TODO(Story 2.4)` comment trong `AppShell.tsx` | Story 2.4 (Task Detail Panel) sẽ wire Detail Panel vào AppShell |
| UX section 2.2 liệt kê 7+ nav items (Dashboard, Inbox, All Tasks, My Tasks, Review Queue, Agents, Sessions, Settings); epics.md AC chỉ yêu cầu 2 (Dashboard, All Tasks) | `_bmad-output/planning-artifacts/ux-design-specification.md` line 187-205 vs `epics.md` line 300 | Story 1.4 chỉ implement 2 nav items (Dashboard, All Tasks) theo epics AC; các items khác là `// TODO(Story 2.x)` | Story 4.1/4.2 hoặc dedicated UX story sẽ thêm nav items còn lại |
| UX-DR20 yêu cầu sidebar collapse icon-only ≤1280px | `_bmad-output/planning-artifacts/epics.md` line 125, UX spec section 19 line 1798, 1808 | Story 1.4 fix sidebar 220px ở mọi breakpoint; collapse logic là `// TODO(Story 4.3)` | Story 4.3 (Responsive Layout) — AC line 872-876 |

KHÔNG fix các gap này trong story 1.4 — chỉ document và defer đúng story.

### References

- **Epics:** `_bmad-output/planning-artifacts/epics.md` line 284-314 — Story 1.4 Acceptance Criteria
- **Epics — UX-DR9:** `_bmad-output/planning-artifacts/epics.md` line 103 — AppShell Layout token
- **Epics — UX-DR20:** `_bmad-output/planning-artifacts/epics.md` line 125 — Responsive Breakpoints (defer Story 4.3)
- **Epics — FR Coverage Map:** `_bmad-output/planning-artifacts/epics.md` line 160, 178 — UX-DR9 maps Epic 1
- **UX Spec — AppShell:** `_bmad-output/planning-artifacts/ux-design-specification.md` line 157-244 — Section 2 (Layout Tổng Thể)
- **UX Spec — Responsive table:** `_bmad-output/planning-artifacts/ux-design-specification.md` line 1797-1810 — breakpoint behavior
- **Architecture — Frontend:** `_bmad-output/planning-artifacts/architecture.md` line 234-236 — TanStack + React Router v7 / 7.15.1
- **Architecture — Project tree:** `_bmad-output/planning-artifacts/architecture.md` line 425-484 — `frontend/src/` structure incl. `routes/`
- **Architecture — Implementation sequence:** `_bmad-output/planning-artifacts/architecture.md` line 268 — "Frontend: Vite scaffold + React Router v7 routes"
- **Readiness Report:** `_bmad-output/planning-artifacts/implementation-readiness-report-2026-05-21.md` line 166, 202 — Story 1.4 ACs đánh giá "User-facing output. ACs rõ ràng"
- **Previous Story:** `_bmad-output/implementation-artifacts/1-3-frontend-scaffold-and-design-tokens.md` — tokens, `main.tsx`, `App.tsx` probe (sẽ replace)
- **Previous Story:** `_bmad-output/implementation-artifacts/1-1-monorepo-setup-and-backend-scaffold.md` — `.gitignore`, monorepo layout
- **Product Contract:** `docs/product/technical-contract.md` line 1-8 — React + TypeScript + Vite strict mode
- **Harness:** `AGENTS.md` — hard rule "Không scaffold thêm application source folders ... trừ khi một selected story rõ ràng yêu cầu"
- **Harness:** `docs/HARNESS.md` — human-agent operating model
- **Harness:** `docs/FEATURE_INTAKE.md` — lane classification (story này là `normal` lane — UI scaffold theo accepted epic, low risk)
- **React Router 7 docs:** https://reactrouter.com/start/declarative/installation — declarative mode reference
- **React Router 7 migration:** https://reactrouter.com/upgrading/v6 — v6 → v7 package consolidation

---

## Dev Agent Record

### Agent Model Used

_TBD — điền sau khi dev agent execute_

### Debug Log References

_TBD_

### Completion Notes List

_TBD_

### File List

_TBD — dev agent phải liệt kê tất cả file tạo mới / sửa / xóa_
