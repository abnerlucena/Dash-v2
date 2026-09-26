import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

// Protótipo isolado do app de produção: config, Tailwind e tokens próprios.
export default defineConfig({
  root: __dirname,
  base: "./",
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss({ config: path.resolve(__dirname, "tailwind.config.ts") }), autoprefixer()],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: { port: 8090, strictPort: true },
  build: { outDir: path.resolve(__dirname, "dist"), emptyOutDir: true },
});
