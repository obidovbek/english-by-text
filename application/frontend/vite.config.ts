import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // Detect if we're running in Docker
  const isDocker =
    process.env.VITE_DEV_SERVER_HOST === "0.0.0.0" ||
    env.VITE_DEV_SERVER_HOST === "0.0.0.0";

  // Use different proxy targets based on environment
  let proxyTarget;
  if (env.VITE_API_PROXY_TARGET) {
    proxyTarget = env.VITE_API_PROXY_TARGET;
  } else if (isDocker) {
    // In Docker, use the backend container
    proxyTarget = "http://backend:4000";
  } else if (mode === "production") {
    proxyTarget = "https://linguatext.birgayur.uz";
  } else {
    // Local development, use ngrok
    proxyTarget = "https://wombat-accepted-whale.ngrok-free.app";
  }

  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: 5173,
      watch: { usePolling: true, interval: 100 },
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
      allowedHosts: [
        "wombat-accepted-whale.ngrok-free.app",
        "linguatext.birgayur.uz",
      ],
    },
  };
});
