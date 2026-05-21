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
diff --git a/_bmad-output/implementation-artifacts/1-3-frontend-scaffold-and-design-tokens.md b/_bmad-output/implementation-artifacts/1-3-frontend-scaffold-and-design-tokens.md
index b425d55..bb7d5df 100644
--- a/_bmad-output/implementation-artifacts/1-3-frontend-scaffold-and-design-tokens.md
+++ b/_bmad-output/implementation-artifacts/1-3-frontend-scaffold-and-design-tokens.md
@@ -1,6 +1,6 @@
 # Story 1.3: Frontend Scaffold & Design Tokens
 
-**Status:** implemented
+**Status:** in-progress
 **Epic:** 1 — Project Foundation & Infrastructure
 **Story ID:** 1.3
 **Story Key:** 1-3-frontend-scaffold-and-design-tokens
@@ -98,6 +98,16 @@ So that frontend có thể giao tiếp với backend và mọi component đều
   - [x] 8.5 Backend chạy nền (`cd backend && cargo run` ở terminal khác) → `curl -i http://localhost:5173/api/health` → `HTTP/1.1 200 OK` với body `{"status":"ok"}` (AC-2).
   - [x] 8.6 `git status` — chỉ thấy file mới/sửa trong `frontend/`, `_bmad-output/implementation-artifacts/`, `docs/`. KHÔNG thấy `node_modules/`, `dist/`, `.vite/`.
 
+### Review Findings
+
+- [x] [Review][Patch] Regex pattern for API prefix in proxy config is loose [frontend/vite.config.ts:16] — fixed by anchoring rewrite to `/api` followed by `/` or end-of-path.
+- [x] [Review][Patch] Bullet symbol (●) missing in the probe component's status badge [frontend/src/App.tsx] — fixed.
+- [x] [Review][Patch] Non-null assertion on root DOM element in main.tsx [frontend/src/main.tsx:6] — fixed with explicit root guard before `createRoot`.
+- [x] [Review][Patch] Unused React Import in main.tsx [frontend/src/main.tsx] — fixed by importing `StrictMode` and `createRoot` directly.
+- [x] [Review][Patch] SEO description meta tag is missing in index.html [frontend/index.html] — fixed.
+- [x] [Review][Defer] No Dark Mode support in CSS design tokens [frontend/src/styles/tokens.css] — deferred, pre-existing
+- [x] [Review][Defer] Missing Error Boundary at root in main.tsx [frontend/src/main.tsx] — deferred, pre-existing
+
 ---
 
 ## Dev Notes
diff --git a/_bmad-output/implementation-artifacts/sprint-status.yaml b/_bmad-output/implementation-artifacts/sprint-status.yaml
index 9172bad..0256815 100644
--- a/_bmad-output/implementation-artifacts/sprint-status.yaml
+++ b/_bmad-output/implementation-artifacts/sprint-status.yaml
@@ -35,7 +35,7 @@
 # - Dev moves story to 'review', then runs code-review (fresh context, different LLM recommended)
 
 generated: "2026-05-21T00:35:18+07:00"
-last_updated: "2026-05-21T12:52:00+07:00"
+last_updated: "2026-05-21T15:35:34+07:00"
 project: omni-agent
 project_key: NOKEY
 tracking_system: file-system
@@ -46,7 +46,7 @@ development_status:
   epic-1: in-progress
   1-1-monorepo-setup-and-backend-scaffold: done
   1-2-database-schema-and-migrations: review
-  1-3-frontend-scaffold-and-design-tokens: ready-for-dev
+  1-3-frontend-scaffold-and-design-tokens: in-progress
   1-4-appshell-layout-and-routing: ready-for-dev
   epic-1-retrospective: optional
 
diff --git a/frontend/index.html b/frontend/index.html
index e2a2fba..fa34fad 100644
--- a/frontend/index.html
+++ b/frontend/index.html
@@ -3,6 +3,10 @@
   <head>
     <meta charset="UTF-8" />
     <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta
+      name="description"
+      content="Local task board for AI CLI agents."
+    />
     <title>omni-agent</title>
   </head>
   <body>
diff --git a/frontend/src/App.tsx b/frontend/src/App.tsx
index 535beda..a70e152 100644
--- a/frontend/src/App.tsx
+++ b/frontend/src/App.tsx
@@ -19,7 +19,7 @@ export default function App() {
           fontSize: "var(--font-size-caption)",
         }}
       >
-        Running (token probe)
+        ● Running (token probe)
       </span>
     </main>
   );
diff --git a/frontend/src/main.tsx b/frontend/src/main.tsx
index fda7223..3bdc071 100644
--- a/frontend/src/main.tsx
+++ b/frontend/src/main.tsx
@@ -1,10 +1,16 @@
-import React from "react";
-import ReactDOM from "react-dom/client";
+import { StrictMode } from "react";
+import { createRoot } from "react-dom/client";
 import App from "./App";
 import "./styles/global.css";
 
-ReactDOM.createRoot(document.getElementById("root")!).render(
-  <React.StrictMode>
+const roo
+const rootElement = document.getElementById("root");
+
+if (!rootElement) {
+  throw new Error("Root element #root not found");
+}
+
+createRoot(rootElement).render(
+  <StrictMode>
     <App />
-  </React.StrictMode>,
+  </StrictMode>,
 );
diff --git a/frontend/vite.config.ts b/frontend/vite.config.ts
index ccdbf0e..74b5ed5 100644
--- a/frontend/vite.config.ts
+++ b/frontend/vite.config.ts
@@ -13,7 +13,7 @@ export default defineConfig({
         // Backend hiện CHƯA prefix /api (Story 1.1 chỉ có GET /health).
         // Rewrite tạm để verify AC-2 mà không sửa backend.
         // TODO(Story 2.1): xóa rewrite khi backend mount handlers dưới /api/*.
-        rewrite: (path) => path.replace(/^\/api/, ""),
+        rewrite: (path) => path.replace(/^\/api(?=\/|$)/, ""),
       },
     },
   },
```

---

## 2. Spec File (1-3-frontend-scaffold-and-design-tokens.md):
```markdown
# Story 1.3: Frontend Scaffold & Design Tokens

**Epic:** 1 — Project Foundation & Infrastructure
**Story ID:** 1.3
**Story Key:** 1-3-frontend-scaffold-and-design-tokens

### Acceptance Criteria
- AC-1: Given repository đã clone / When chạy `npm install` rồi `npm run dev` trong `frontend/` / Then Vite dev server khởi động tại `http://localhost:5173` And TypeScript strict mode được bật trong `frontend/tsconfig.json` (`"strict": true`).
- AC-2: Given Vite dev server đang chạy And backend đang chạy tại `127.0.0.1:8080` / When request `GET http://localhost:5173/api/health` / Then request được proxy tới `http://127.0.0.1:8080/health` và trả `200 OK` với body `{"status":"ok"}`.
- AC-3: Given file `frontend/src/styles/tokens.css` / When inspect các CSS variables / Then Neutrals, Brand, 9 status color triples đầy đủ, spacing, radius, shadow, font tokens đầy đủ.
- AC-4: Given `tokens.css` được import trong `main.tsx` / When bất kỳ component nào dùng `var(--brand-primary)` / Then đúng giá trị màu được áp dụng (verify bằng probe component trong `App.tsx`).
- AC-5: Thư mục frontend/ chứa: package.json (React 19 + TypeScript strict), tsconfig.json, vite.config.ts (proxy /api -> 8080), index.html, src/main.tsx, src/App.tsx, src/styles/tokens.css, src/styles/global.css.
```

---

## 3. Project Context:
- **TypeScript/React (Frontend):** TypeScript strict mode bắt buộc.
- **Naming:** React components: PascalCase cho tên file và component (`TaskCard.tsx`). CSS variables: kebab-case.
- **Design System (CSS variables):** Font stack: Inter, Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif. Bắt buộc dùng CSS variables đã định nghĩa, không hardcode hex.
