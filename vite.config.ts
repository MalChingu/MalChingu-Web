import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { version } from "./package.json";

export default defineConfig({
  plugins: [react()],
  // Shown in Profile → About.
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        // Keep the libraries and the word list in their own cached files.
        manualChunks: { react: ["react", "react-dom"], supabase: ["@supabase/supabase-js"] },
      },
    },
  },
});
