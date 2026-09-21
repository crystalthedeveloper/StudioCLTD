import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { spawn } from "node:child_process";

export default defineConfig({
  plugins: [react(), {
    name: "refresh-screen-images",
    configureServer(server) {
      // Regenerate responsive URLs when source artwork changes during development.
      let pending = false;
      let running = false;
      const generate = () => {
        if (running) { pending = true; return; }
        running = true;
        const process = spawn("node", ["scripts/build-screen-assets.mjs"], { stdio: "inherit" });
        process.on("exit", () => {
          running = false;
          if (pending) { pending = false; generate(); }
        });
      };
      server.watcher.on("change", path => {
        if (path.includes("/public/images/optimized/") || path.endsWith("/systems/HubSections.tsx")) generate();
      });
    },
  }],
});
