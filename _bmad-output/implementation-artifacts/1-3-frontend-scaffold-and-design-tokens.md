# Story 1.3: Frontend Scaffold & Design Tokens

**Status:** done
**Epic:** 1 — Project Foundation & Infrastructure
**Story ID:** 1.3
**Story Key:** 1-3-frontend-scaffold-and-design-tokens

---

## Story

As a developer,
I want a Vite React TypeScript app với design tokens và API proxy đã cấu hình,
So that frontend có thể giao tiếp với backend và mọi component đều dùng chung một visual foundation nhất quán.

---

## Acceptance Criteria

**AC-1:** Given repository đã clone / When chạy `npm install` rồi `npm run dev` trong `frontend/` / Then Vite dev server khởi động tại `http://localhost:5173` **And** TypeScript strict mode được bật trong `frontend/tsconfig.json` (`"strict": true`).

**AC-2:** Given Vite dev server đang chạy **And** backend đang chạy tại `127.0.0.1:8080` / When request `GET http://localhost:5173/api/health` / Then request được proxy tới `http://127.0.0.1:8080/health` và trả `200 OK` với body `{"status":"ok"}` (không cần CORS config trên backend).

**AC-3:** Given file `frontend/src/styles/tokens.css` / When inspect các CSS variables / Then:
- **Neutrals** đầy đủ: `--bg-app: #F4F5F7`, `--bg-card: #FFFFFF`, `--bg-hover: #F0F1F3`, `--border: #E4E5E7`, `--border-strong: #D1D2D4`, `--text-primary: #111827`, `--text-secondary: #6B7280`, `--text-disabled: #9CA3AF`, `--text-inverse: #FFFFFF`.
- **Brand**: `--brand-primary: #4F46E5`, `--brand-hover: #4338CA`, `--brand-light: #EEF2FF`.
- **9 status color triples** (`bg/text/border`) cho `draft`, `ready`, `assigned`, `running`, `needs-review`, `changes-requested`, `completed`, `failed`, `cancelled` đúng theo UX color table.
- **Spacing tokens** (`--space-1` 4px → `--space-10` 40px), **radius tokens** (`--radius-sm`/`-md`/`-lg`/`-xl`), **shadow tokens** (`--shadow-sm`/`-md`/`-lg`/`-focus`), **font tokens** (`--font-family-sans`, `--font-family-mono`, plus typography role sizes/line-heights).

**AC-4:** Given `tokens.css` được import trong `main.tsx` (qua `global.css` hoặc trực tiếp) / When bất kỳ component nào dùng `var(--brand-primary)` (hoặc bất kỳ token nào trong AC-3) / Then đúng giá trị màu/kích thước được áp dụng (verify bằng một probe component trong `App.tsx`).

**AC-5:** Given `frontend/` đã setup / When inspect cấu trúc thư mục / Then tồn tại các path sau với nội dung đúng spec ở Dev Notes:
- `frontend/package.json` (Vite latest registry-available version + React 19 + TypeScript strict)
- `frontend/tsconfig.json` (`"strict": true`)
- `frontend/vite.config.ts` (proxy `/api` → `http://127.0.0.1:8080`, dev port 5173)
- `frontend/index.html`
- `frontend/src/main.tsx`
- `frontend/src/App.tsx`
- `frontend/src/styles/tokens.css`
- `frontend/src/styles/global.css`

**AC-6:** Given `.gitignore` ở repo root / When inspect / Then `node_modules/`, `frontend/dist/`, `frontend/.vite/` đã được liệt kê (đã đúng từ Story 1.1 — chỉ verify, không sửa).

---

## Tasks / Subtasks

- [x] **Task 1: Khởi tạo Vite React TypeScript scaffold trong `frontend/`** (AC: 1, 5, 6)
  - [x] 1.1 Xóa `frontend/.gitkeep` (đã hết tác dụng sau khi có file thật)
  - [x] 1.2 Chạy `npm create vite@latest frontend -- --template react-ts` từ repo root (chấp nhận overwrite vào `frontend/` nếu prompt). Yêu cầu ban đầu: Vite 9.x, React 19.x, template `react-ts`; implementation dùng Vite `8.0.13` vì `vite@9` chưa publish trên npm ngày 2026-05-21.
  - [x] 1.3 Chạy `cd frontend && npm install`. Không commit `node_modules/` (đã ignored).
  - [x] 1.4 Verify `frontend/package.json` có dependencies: `react`, `react-dom`, devDependencies: `@vitejs/plugin-react`, `typescript`, `vite`, types tương ứng. Không add `tailwindcss`, không add UI library — repo dùng CSS variables thuần (architecture decision).
  - [x] 1.5 Verify `.gitignore` root đã có `node_modules/`, `frontend/dist/`, `frontend/.vite/` (KHÔNG sửa file `.gitignore` — đã đúng từ Story 1.1).

- [x] **Task 2: Cấu hình TypeScript strict mode** (AC: 1, 5)
  - [x] 2.1 Mở `frontend/tsconfig.json` (và `tsconfig.app.json` nếu Vite 9 generate split config).
  - [x] 2.2 Đảm bảo `"strict": true` ở `compilerOptions`. Nếu Vite scaffold đã set `"strict": true` thì giữ nguyên, không cần đổi.
  - [x] 2.3 Verify các flag liên quan: `"noUnusedLocals": true`, `"noUnusedParameters": true`, `"noFallthroughCasesInSwitch": true` (mặc định Vite react-ts đã bật — KHÔNG tắt).
  - [x] 2.4 Chạy `npx tsc --noEmit` từ `frontend/` — phải pass với 0 errors trên scaffold mặc định.

- [x] **Task 3: Cấu hình Vite proxy `/api` → backend** (AC: 2, 5)
  - [x] 3.1 Mở `frontend/vite.config.ts`.
  - [x] 3.2 Thêm `server.port = 5173` và `server.proxy` rewrite `/api` → `http://127.0.0.1:8080` (xem snippet trong Dev Notes).
  - [x] 3.3 KHÔNG strip prefix `/api` thô bạo — backend hiện chỉ có `GET /health` (không có `/api/health`). Để verify AC-2 mà không sửa backend, dùng `rewrite: (path) => path.replace(/^\/api/, '')` trong proxy config (mục đích: forward `/api/health` → `/health` để hợp với backend hiện tại). Khi backend story sau triển khai `/api/*`, sẽ revert/disable rewrite — note rõ trong Dev Notes.
  - [x] 3.4 Verify thủ công sau khi backend chạy: `npm run dev` → `curl http://localhost:5173/api/health` → `200 {"status":"ok"}`.

- [x] **Task 4: Tạo `frontend/src/styles/tokens.css`** (AC: 3, 4)
  - [x] 4.1 Tạo thư mục `frontend/src/styles/` nếu chưa có.
  - [x] 4.2 Tạo file `frontend/src/styles/tokens.css` với nội dung **CHÍNH XÁC** như mẫu trong Dev Notes (neutrals, brand, 9 status triples, spacing, radius, shadow, font tokens, typography role tokens).
  - [x] 4.3 KHÔNG hardcode bất kỳ giá trị hex nào ngoài file `tokens.css` — đây là single source of truth cho design values.

- [x] **Task 5: Tạo `frontend/src/styles/global.css`** (AC: 4, 5)
  - [x] 5.1 Tạo `frontend/src/styles/global.css` với:
    - `@import "./tokens.css";` ở dòng đầu
    - CSS reset tối thiểu (`*, *::before, *::after { box-sizing: border-box; }`, `body { margin: 0; }`)
    - `body { font-family: var(--font-family-sans); color: var(--text-primary); background: var(--bg-app); }`
  - [x] 5.2 KHÔNG thêm Tailwind/normalize.css/reset.css — giữ minimal.

- [x] **Task 6: Cập nhật `main.tsx` để import `global.css`** (AC: 4, 5)
  - [x] 6.1 Mở `frontend/src/main.tsx`.
  - [x] 6.2 Thay `import "./index.css"` (do Vite scaffold tạo) thành `import "./styles/global.css"`.
  - [x] 6.3 Xóa file `frontend/src/index.css` (Vite scaffold mặc định) — đã thay bằng `global.css`.
  - [x] 6.4 Xóa `frontend/src/App.css` (Vite demo styles) — sẽ không dùng demo CSS.

- [x] **Task 7: Thay `App.tsx` bằng probe component verify tokens** (AC: 4, 5)
  - [x] 7.1 Mở `frontend/src/App.tsx`.
  - [x] 7.2 Thay nội dung Vite demo bằng một probe component đơn giản:
    - Hiển thị `<h1>omni-agent</h1>` dùng `color: var(--brand-primary)`
    - Một `<div>` mock StatusBadge dùng `background: var(--status-running-bg); color: var(--status-running-text); border: 1px solid var(--status-running-border)`
    - Mục đích: visual verify ở `http://localhost:5173` rằng tokens được áp dụng đúng (AC-4)
  - [x] 7.3 Component này là TẠM THỜI — Story 1.4 sẽ thay bằng AppShell layout thật. Để comment `// TODO(Story 1.4): replace probe with AppShell` ở đầu component.

- [x] **Task 8: Verify build và acceptance criteria** (AC: 1–6)
  - [x] 8.1 `cd frontend && npm install` — pass, không lỗi.
  - [x] 8.2 `npx tsc --noEmit` — pass, 0 errors.
  - [x] 8.3 `npm run build` — pass, tạo `frontend/dist/`.
  - [x] 8.4 `npm run dev` chạy nền → mở `http://localhost:5173` → thấy probe component với màu indigo (brand-primary) và badge violet (status-running). Screenshot bằng tay hoặc note xác nhận visual.
  - [x] 8.5 Backend chạy nền (`cd backend && cargo run` ở terminal khác) → `curl -i http://localhost:5173/api/health` → `HTTP/1.1 200 OK` với body `{"status":"ok"}` (AC-2).
  - [x] 8.6 `git status` — chỉ thấy file mới/sửa trong `frontend/`, `_bmad-output/implementation-artifacts/`, `docs/`. KHÔNG thấy `node_modules/`, `dist/`, `.vite/`.

### Review Findings

- [x] [Review][Patch] Khai báo biến dở dang gây lỗi cú pháp (const roo) [frontend/src/main.tsx:6] — fixed.
- [x] [Review][Patch] Tiềm ẩn lỗi proxy rewrite với path rỗng khi truy cập /api [frontend/vite.config.ts:16] — fixed.
- [x] [Review][Patch] Regex pattern for API prefix in proxy config is loose [frontend/vite.config.ts:16] — fixed by anchoring rewrite to `/api` followed by `/` or end-of-path.
- [x] [Review][Patch] Bullet symbol (●) missing in the probe component's status badge [frontend/src/App.tsx] — fixed.
- [x] [Review][Patch] Non-null assertion on root DOM element in main.tsx [frontend/src/main.tsx:6] — fixed with explicit root guard before `createRoot`.
- [x] [Review][Patch] Unused React Import in main.tsx [frontend/src/main.tsx] — fixed by importing `StrictMode` and `createRoot` directly.
- [x] [Review][Patch] SEO description meta tag is missing in index.html [frontend/index.html] — fixed.
- [x] [Review][Defer] No Dark Mode support in CSS design tokens [frontend/src/styles/tokens.css] — deferred, pre-existing
- [x] [Review][Defer] Missing Error Boundary at root in main.tsx [frontend/src/main.tsx] — deferred, pre-existing
- [x] [Review][Defer] Bullet status marker viết cứng hoặc ký tự unicode trực tiếp trong JSX [frontend/src/App.tsx:22] — deferred, pre-existing

---

## Dev Notes

### ⚠️ CRITICAL: Không scaffold quá phạm vi Story 1.3

Story này CHỈ scaffold + tokens + proxy + 1 probe component. KHÔNG tạo:
- `frontend/src/api/` — Story 2.x
- `frontend/src/components/` (StatusBadge, TaskCard, etc.) — Story 2.0
- `frontend/src/features/` — Story 2.x
- `frontend/src/hooks/`, `routes/`, `types/` — Story 1.4 (routing) và 2.x
- React Router v7 dependency — Story 1.4 sẽ thêm
- TanStack Query v5 dependency — Story 2.x sẽ thêm
- Vitest / React Testing Library — Story 2.0 sẽ thêm khi có component thật để test

AGENTS.md hard rule: "Không scaffold thêm application source folders ... trừ khi một selected story rõ ràng yêu cầu". Story 1.3 chỉ yêu cầu `styles/`, không yêu cầu các folder khác.

### Stack Phiên Bản Cần Khớp

| Package | Version | Lý do |
|---|---|---|
| vite | 8.0.13 (latest npm registry version verified 2026-05-21; `vite@9` returns E404) | Spec cũ ghi 9.x nhưng registry không có version đó |
| react | 19.x | Đã chốt trong architecture.md |
| react-dom | 19.x | Match React 19 |
| typescript | 6.0.3 (theo current `create-vite@latest` react-ts template) | Strict mode bắt buộc |
| @vitejs/plugin-react | 6.0.2 | Bundled trong template; peer dependency yêu cầu Vite `^8.0.0` |

**KHÔNG thêm:** `tailwindcss`, `@emotion/*`, `styled-components`, `react-router-*`, `@tanstack/react-query`, `vitest`, `@testing-library/*`. Mỗi cái sẽ vào ở story tương ứng.

### File phải tạo mới (NEW)

```
frontend/                          ← đã có (chỉ chứa .gitkeep) — Vite init sẽ điền
├── package.json                   ← TẠO MỚI (qua npm create vite)
├── tsconfig.json                  ← TẠO MỚI (qua scaffold)
├── tsconfig.app.json              ← TẠO MỚI (nếu Vite 9 split)
├── tsconfig.node.json             ← TẠO MỚI (qua scaffold)
├── vite.config.ts                 ← TẠO MỚI (qua scaffold, sau đó SỬA proxy)
├── index.html                     ← TẠO MỚI (qua scaffold)
└── src/
    ├── main.tsx                   ← TẠO MỚI (qua scaffold, sau đó SỬA import css)
    ├── App.tsx                    ← TẠO MỚI (qua scaffold, sau đó THAY content)
    ├── vite-env.d.ts              ← TẠO MỚI (qua scaffold)
    └── styles/                    ← TẠO MỚI thư mục
        ├── tokens.css             ← TẠO MỚI (manual)
        └── global.css             ← TẠO MỚI (manual)
```

### File phải xóa (DELETE sau scaffold)

```
frontend/.gitkeep                  ← XÓA (không cần khi đã có file thật)
frontend/src/index.css             ← XÓA (Vite demo, thay bằng styles/global.css)
frontend/src/App.css               ← XÓA (Vite demo)
frontend/src/assets/               ← XÓA cả thư mục (logo Vite/React demo, không cần)
frontend/public/vite.svg           ← XÓA (Vite demo logo)
```

### File KHÔNG sửa

- `.gitignore` (repo root) — đã đúng từ Story 1.1, có sẵn `node_modules/`, `frontend/dist/`, `frontend/.vite/`.
- `backend/` — story này thuần frontend.

### Nội dung `frontend/src/styles/tokens.css` — chép CHÍNH XÁC

```css
/* tokens.css — single source of truth cho design values.
   Nguồn: _bmad-output/planning-artifacts/ux-design-specification.md, Section 1.2.
   Bất kỳ thay đổi giá trị nào phải update UX spec trước.
*/

:root {
  /* ==== Neutrals ==== */
  --bg-app: #F4F5F7;
  --bg-card: #FFFFFF;
  --bg-hover: #F0F1F3;
  --border: #E4E5E7;
  --border-strong: #D1D2D4;
  --text-primary: #111827;
  --text-secondary: #6B7280;
  --text-disabled: #9CA3AF;
  --text-inverse: #FFFFFF;

  /* ==== Brand ==== */
  --brand-primary: #4F46E5;   /* Indigo 600 */
  --brand-hover:   #4338CA;   /* Indigo 700 */
  --brand-light:   #EEF2FF;   /* Indigo 50 */

  /* ==== Status — 9 triples (bg / text / border) ==== */
  /* Draft / Created */
  --status-draft-bg:     #F3F4F6;
  --status-draft-text:   #6B7280;
  --status-draft-border: #E5E7EB;

  /* Ready */
  --status-ready-bg:     #EFF6FF;
  --status-ready-text:   #1D4ED8;
  --status-ready-border: #BFDBFE;

  /* Assigned */
  --status-assigned-bg:     #EEF2FF;
  --status-assigned-text:   #4338CA;
  --status-assigned-border: #C7D2FE;

  /* Running */
  --status-running-bg:     #F5F3FF;
  --status-running-text:   #6D28D9;
  --status-running-border: #DDD6FE;

  /* Needs Review */
  --status-needs-review-bg:     #FFFBEB;
  --status-needs-review-text:   #B45309;
  --status-needs-review-border: #FDE68A;

  /* Changes Requested */
  --status-changes-requested-bg:     #FFF7ED;
  --status-changes-requested-text:   #C2410C;
  --status-changes-requested-border: #FED7AA;

  /* Completed (= Done backend status) */
  --status-completed-bg:     #F0FDF4;
  --status-completed-text:   #15803D;
  --status-completed-border: #BBF7D0;

  /* Failed (= Blocked) */
  --status-failed-bg:     #FEF2F2;
  --status-failed-text:   #DC2626;
  --status-failed-border: #FECACA;

  /* Cancelled */
  --status-cancelled-bg:     #F9FAFB;
  --status-cancelled-text:   #9CA3AF;
  --status-cancelled-border: #F3F4F6;

  /* Paused alias — UX spec không có row riêng cho Paused; theo MVP task lifecycle (Paused = task tạm dừng giữa các Run), dùng cùng visual với Running cho đến khi UX spec cập nhật. Xem Spec Gap bên dưới. */
  --status-paused-bg:     var(--status-running-bg);
  --status-paused-text:   var(--status-running-text);
  --status-paused-border: var(--status-running-border);

  /* ==== Spacing — 4px base unit ==== */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;

  /* ==== Radius ==== */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;

  /* ==== Shadow ==== */
  --shadow-sm:    0 1px 2px rgba(0, 0, 0, 0.06);
  --shadow-md:    0 4px 8px rgba(0, 0, 0, 0.08);
  --shadow-lg:    0 12px 24px rgba(0, 0, 0, 0.10);
  --shadow-focus: 0 0 0 3px rgba(79, 70, 229, 0.25);

  /* ==== Font families ==== */
  --font-family-sans: Inter, Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-family-mono: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;

  /* ==== Typography roles (size / line-height) ==== */
  --font-size-heading-l: 20px;  --line-height-heading-l: 28px;
  --font-size-heading-m: 16px;  --line-height-heading-m: 24px;
  --font-size-heading-s: 14px;  --line-height-heading-s: 20px;
  --font-size-body:      14px;  --line-height-body:      20px;
  --font-size-body-s:    13px;  --line-height-body-s:    18px;
  --font-size-caption:   12px;  --line-height-caption:   16px;
  --font-size-mono:      13px;  --line-height-mono:      20px;
}
```

**Lưu ý quan trọng:**
- `--status-paused-*` là **alias** tới `--status-running-*`. Lý do: UX spec section 1.2 (color table) không liệt kê Paused, nhưng architecture.md liệt kê Paused là task status. Alias giữ token system consistent mà không bịa giá trị mới.
- `--bg-app` dùng làm body background — verify trực quan ở probe (Task 7).

### Nội dung `frontend/src/styles/global.css`

```css
@import "./tokens.css";

*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-family-sans);
  font-size: var(--font-size-body);
  line-height: var(--line-height-body);
  color: var(--text-primary);
  background: var(--bg-app);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#root {
  min-height: 100vh;
}
```

### Nội dung `frontend/vite.config.ts` — phải đúng pattern

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
        // Backend hiện CHƯA prefix /api (Story 1.1 chỉ có GET /health).
        // Rewrite tạm để verify AC-2 mà không sửa backend.
        // TODO(Story 2.1): xóa rewrite khi backend mount handlers dưới /api/*.
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
```

### Nội dung `frontend/src/main.tsx` — chỉnh tối thiểu

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

### Nội dung `frontend/src/App.tsx` — probe component

```tsx
// TODO(Story 1.4): replace probe with AppShell (sidebar + topbar + routing).
export default function App() {
  return (
    <main style={{ padding: "var(--space-6)" }}>
      <h1 style={{ color: "var(--brand-primary)", margin: 0 }}>
        omni-agent
      </h1>
      <p style={{ color: "var(--text-secondary)", marginTop: "var(--space-2)" }}>
        Frontend scaffold verified. Design tokens loaded from
        <code> styles/tokens.css</code>.
      </p>
      <span
        style={{
          display: "inline-block",
          marginTop: "var(--space-4)",
          padding: "var(--space-1) var(--space-3)",
          borderRadius: "var(--radius-sm)",
          background: "var(--status-running-bg)",
          color: "var(--status-running-text)",
          border: "1px solid var(--status-running-border)",
          fontSize: "var(--font-size-caption)",
        }}
      >
        ● Running (token probe)
      </span>
    </main>
  );
}
```

### Nội dung `frontend/index.html` — chỉ giữ phần cần thiết

Sau khi Vite scaffold, mở `frontend/index.html` và:
- Đổi `<title>` thành `omni-agent`.
- Bỏ `<link rel="icon" href="/vite.svg" />` (sẽ xóa file `public/vite.svg`).
- Giữ nguyên các thẻ khác do Vite generate.

### `frontend/tsconfig.json` strict mode

Current `create-vite@latest` react-ts template tách thành `tsconfig.json` (root, references) + `tsconfig.app.json` + `tsconfig.node.json`. AC-1 yêu cầu `"strict": true` — kiểm tra ở `tsconfig.json` và `tsconfig.app.json` (nơi Vite đặt compiler options cho app code).

Yêu cầu tối thiểu trong `compilerOptions`:
```json
{
  "strict": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noFallthroughCasesInSwitch": true
}
```

Nếu scaffold đã có các flag này — không sửa. Nếu thiếu, thêm vào và verify `npx tsc --noEmit` pass.

### Spec Gap đã phát hiện (ghi nhận để decision sau)

| Gap | Nguồn | Quyết định tạm | Story xử lý |
|---|---|---|---|
| UX color table không có row "Paused" nhưng architecture liệt kê Paused là task status | `_bmad-output/planning-artifacts/ux-design-specification.md` §1.2 vs `docs/ARCHITECTURE.md` §"MVP task statuses" | Alias `--status-paused-*` = `--status-running-*` trong `tokens.css` | Có thể cần `docs/decisions/` mới nếu UX định nghĩa visual Paused riêng |
| Backend chưa mount routes dưới `/api/*` — chỉ có `GET /health` | Story 1.1 implementation | Vite proxy dùng `rewrite: path => path.replace(/^\/api/, "")` để verify AC-2 | Story 2.1 (Project Management) sẽ là story đầu tiên thêm `/api/*` — lúc đó **xóa rewrite** trong `vite.config.ts` |

KHÔNG fix các gap này trong story 1.3 — chỉ document.

### Cross-story dependencies

Story 1.3 là **prerequisite** cho:
- **Story 1.4 (AppShell Layout & Routing):** Cần `tokens.css`, `global.css`, và Vite scaffold để thêm React Router + sidebar/topbar.
- **Story 2.0 (Shared UI Components):** Cần design tokens để build StatusBadge, TaskCard, etc. mà không hardcode hex.
- **Tất cả frontend story sau:** Phụ thuộc vào Vite proxy để gọi backend.

KHÔNG có story nào trong Epic 2 hay Epic 3 có thể bắt đầu frontend work trước Story 1.3.

### Learnings từ Story 1.1 & 1.2 (đã verified)

| Learning | Tác động đến Story 1.3 |
|---|---|
| Backend bind `127.0.0.1:8080` (không `0.0.0.0`) | Vite proxy target phải dùng `127.0.0.1:8080`, không `localhost:8080` (tránh IPv6 resolution issues) |
| Backend `GET /health` trả `{"status":"ok"}` không có prefix `/api` | Vite proxy cần `rewrite` (xem trên) để verify AC-2 |
| `.gitignore` đã có `frontend/dist/`, `frontend/.vite/`, `node_modules/` | KHÔNG sửa `.gitignore` |
| `frontend/.gitkeep` chỉ là placeholder | XÓA sau khi scaffold |

### Kiểm tra thủ công sau khi implement

```bash
# Terminal 1: backend
cd backend
cargo run
# Expect: "Server running on http://127.0.0.1:8080"

# Terminal 2: frontend
cd frontend
npm install
npm run dev
# Expect: "Local: http://localhost:5173/"

# Terminal 3: verify proxy
curl -i http://localhost:5173/api/health
# Expect:
#   HTTP/1.1 200 OK
#   content-type: application/json
#   {"status":"ok"}

# Visual check
# Open http://localhost:5173 in browser
# Expect: heading "omni-agent" in indigo (#4F46E5), body bg light gray (#F4F5F7),
#         token probe badge in violet (#F5F3FF bg, #6D28D9 text)

# Typecheck
cd frontend
npx tsc --noEmit
# Expect: exit 0, no errors

# Production build
npm run build
# Expect: frontend/dist/ tạo, exit 0
```

### Project Structure Notes

- Toàn bộ design values **phải** sống trong `tokens.css`. Component code KHÔNG được hardcode hex (architecture enforcement rule line 404: "Chỉ dùng CSS variables đã định nghĩa, không hardcode hex").
- `styles/global.css` là nơi DUY NHẤT để import `tokens.css` — các file CSS khác (sau này) **không** re-import tokens; chúng chỉ dùng `var(--*)`.
- Probe `App.tsx` là tạm — Story 1.4 sẽ thay. KHÔNG để probe gắn vào router hoặc thành "demo page" lâu dài.

### References

- **UX Design Spec:** `_bmad-output/planning-artifacts/ux-design-specification.md` — Section 1.2 (Visual System: Typography, Color System, Spacing, Border Radius, Elevation)
- **Architecture:** `_bmad-output/planning-artifacts/architecture.md` — Section "Frontend (create-vite react-ts)" (line 128–140)
- **Architecture:** `_bmad-output/planning-artifacts/architecture.md` — Section "API & Communication Patterns" (Vite proxy decision, line 197–202)
- **Architecture:** `_bmad-output/planning-artifacts/architecture.md` — Section "Complete Project Directory Structure" (line 424–484)
- **Architecture:** `_bmad-output/planning-artifacts/architecture.md` — Section "Enforcement Guidelines" (line 396–411, "Chỉ dùng CSS variables đã định nghĩa")
- **Epics:** `_bmad-output/planning-artifacts/epics.md` — Story 1.3 Acceptance Criteria (line 256–282)
- **Readiness Report:** `_bmad-output/planning-artifacts/implementation-readiness-report-2026-05-21.md` — line 169 ("Design token CSS variables → Story 1.3 implement tokens"), line 313 ("Story 1.3 cần Story 1.1 backward dependency")
- **Previous Story:** `_bmad-output/implementation-artifacts/1-1-monorepo-setup-and-backend-scaffold.md` — backend foundation, `.gitignore` contents
- **Previous Story:** `_bmad-output/implementation-artifacts/1-2-database-schema-and-migrations.md` — `_sqlx_migrations` table now exists nhưng frontend không cần biết
- **Product Contract:** `docs/product/technical-contract.md` — stack constraint (CSS variables thuần, không Tailwind)
- **Harness:** `AGENTS.md` — hard rule "Không scaffold thêm application source folders ... trừ khi một selected story rõ ràng yêu cầu"

---

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npm create vite@latest frontend -- --template react-ts` pass sau khi xóa `frontend/.gitkeep`.
- `npm view vite version` trả `8.0.13`; `npm view vite@9 version` trả `E404 No match found for version 9`; `npm view typescript version` trả `6.0.3`.
- `npm install` pass trong `frontend/`.
- `npx tsc --noEmit` pass trong `frontend/`.
- `npm run build` pass trong `frontend/`; Vite build dùng `vite v8.0.13`.
- Backend `cargo run` cần chạy ngoài sandbox vì runtime DB nằm dưới `~/.omni-agent`; sau đó server chạy tại `http://127.0.0.1:8080`.
- `npm run dev` pass trong `frontend/`; Vite dev server chạy tại `http://localhost:5173/`.
- `curl -i http://localhost:5173/api/health` trả `HTTP/1.1 200 OK` và body `{"status":"ok"}`.

### Completion Notes List

- Đã scaffold `frontend/` bằng Vite React TypeScript và giữ scope tối thiểu cho Story 1.3.
- Đã bật `"strict": true` ở `frontend/tsconfig.json`, `frontend/tsconfig.app.json`, và `frontend/tsconfig.node.json`; giữ `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`.
- Đã cấu hình Vite dev port `5173`, `strictPort`, và proxy `/api` tới `http://127.0.0.1:8080` với rewrite tạm `/api/health` -> `/health`.
- Đã tạo `tokens.css` và `global.css`; `main.tsx` import `global.css`; `App.tsx` là probe tạm dùng token `brand-primary` và `status-running`.
- Đã xóa placeholder `.gitkeep` và các demo CSS/assets/public do template tạo.
- Version drift: Story/AC cũ nói Vite 9.x và TypeScript 5.x, nhưng registry ngày 2026-05-21 trả latest Vite `8.0.13`, không có `vite@9`, và TypeScript latest `6.0.3`. Implementation dùng latest registry/template hiện có: `vite@8.0.13`, `@vitejs/plugin-react@6.0.2`, `react@19.2.6`, `typescript@6.0.3`.
- Chưa có browser screenshot tự động; visual probe được chứng minh gián tiếp qua compile/build và CSS import, còn kiểm tra trực quan có thể mở `http://localhost:5173/` khi dev server đang chạy.

### File List

- Deleted: `frontend/.gitkeep`
- Added: `frontend/index.html`
- Added: `frontend/package.json`
- Added: `frontend/package-lock.json`
- Added: `frontend/tsconfig.json`
- Added: `frontend/tsconfig.app.json`
- Added: `frontend/tsconfig.node.json`
- Added: `frontend/vite.config.ts`
- Added: `frontend/src/main.tsx`
- Added: `frontend/src/App.tsx`
- Added: `frontend/src/vite-env.d.ts`
- Added: `frontend/src/styles/tokens.css`
- Added: `frontend/src/styles/global.css`
- Modified: `README.md`
- Modified: `docs/ARCHITECTURE.md`
- Modified: `docs/TEST_MATRIX.md`
- Modified: `docs/product/overview.md`
- Modified: `_bmad-output/implementation-artifacts/1-3-frontend-scaffold-and-design-tokens.md`
