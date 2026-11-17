import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
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
