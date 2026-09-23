// vite.config.ts
import { defineConfig } from "file:///C:/Users/youin/OneDrive/%EB%B0%94%ED%83%95%20%ED%99%94%EB%A9%B4/%EC%98%A4%EB%8B%B5%EB%85%B8%ED%8A%B8/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/youin/OneDrive/%EB%B0%94%ED%83%95%20%ED%99%94%EB%A9%B4/%EC%98%A4%EB%8B%B5%EB%85%B8%ED%8A%B8/node_modules/@vitejs/plugin-react/dist/index.js";
import tailwindcss from "file:///C:/Users/youin/OneDrive/%EB%B0%94%ED%83%95%20%ED%99%94%EB%A9%B4/%EC%98%A4%EB%8B%B5%EB%85%B8%ED%8A%B8/node_modules/@tailwindcss/vite/dist/index.mjs";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  base: "./",
  // Electron 호환을 위한 상대 경로
  server: {
    port: 5177,
    strictPort: true,
    watch: {
      ignored: ["**/data/**", "**/\uBB38\uC81C\uC9D1\uC774\uBBF8\uC9C0/**", "**/*.json"]
    }
  },
  build: {
    minify: "esbuild"
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFx5b3VpblxcXFxPbmVEcml2ZVxcXFxcdUJDMTRcdUQwRDUgXHVENjU0XHVCQTc0XFxcXFx1QzYyNFx1QjJGNVx1QjE3OFx1RDJCOFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxceW91aW5cXFxcT25lRHJpdmVcXFxcXHVCQzE0XHVEMEQ1IFx1RDY1NFx1QkE3NFxcXFxcdUM2MjRcdUIyRjVcdUIxNzhcdUQyQjhcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL3lvdWluL09uZURyaXZlLyVFQiVCMCU5NCVFRCU4MyU5NSUyMCVFRCU5OSU5NCVFQiVBOSVCNC8lRUMlOTglQTQlRUIlOEIlQjUlRUIlODUlQjglRUQlOEElQjgvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0JztcclxuaW1wb3J0IHRhaWx3aW5kY3NzIGZyb20gJ0B0YWlsd2luZGNzcy92aXRlJztcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgcGx1Z2luczogW1xyXG4gICAgcmVhY3QoKSxcclxuICAgIHRhaWx3aW5kY3NzKCksXHJcbiAgXSxcclxuICBiYXNlOiAnLi8nLCAvLyBFbGVjdHJvbiBcdUQ2MzhcdUQ2NThcdUM3NDQgXHVDNzA0XHVENTVDIFx1QzBDMVx1QjMwMCBcdUFDQkRcdUI4NUNcclxuICBzZXJ2ZXI6IHtcclxuICAgIHBvcnQ6IDUxNzcsXHJcbiAgICBzdHJpY3RQb3J0OiB0cnVlLFxyXG4gICAgd2F0Y2g6IHtcclxuICAgICAgaWdub3JlZDogWycqKi9kYXRhLyoqJywgJyoqL1x1QkIzOFx1QzgxQ1x1QzlEMVx1Qzc3NFx1QkJGOFx1QzlDMC8qKicsICcqKi8qLmpzb24nXVxyXG4gICAgfVxyXG4gIH0sXHJcbiAgYnVpbGQ6IHtcclxuICAgIG1pbmlmeTogJ2VzYnVpbGQnXHJcbiAgfVxyXG59KTtcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFzVyxTQUFTLG9CQUFvQjtBQUNuWSxPQUFPLFdBQVc7QUFDbEIsT0FBTyxpQkFBaUI7QUFFeEIsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sWUFBWTtBQUFBLEVBQ2Q7QUFBQSxFQUNBLE1BQU07QUFBQTtBQUFBLEVBQ04sUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sWUFBWTtBQUFBLElBQ1osT0FBTztBQUFBLE1BQ0wsU0FBUyxDQUFDLGNBQWMsOENBQWdCLFdBQVc7QUFBQSxJQUNyRDtBQUFBLEVBQ0Y7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxFQUNWO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
