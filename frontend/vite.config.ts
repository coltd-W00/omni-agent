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
        rewrite: (path) => path.replace(/^\/api(?=\/|$)/, "") || "/",
      },
    },
  },
});
