import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  base: "/Dashboard-Tomadas/",
  server: {
    // 0.0.0.0 e não "::": o "::" só funciona onde há pilha IPv6, e falha com
    // EAFNOSUPPORT em ambientes sem ela (contêineres, algumas redes corporativas).
    // Nos dois casos o servidor continua visível na rede local — que é o motivo
    // de o host estar aqui (abrir o dash no celular, por exemplo).
    host: "0.0.0.0",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
