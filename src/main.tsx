import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { prepararRecuperacaoDeSenha } from "@/lib/recovery";

// Quem chega pelo link de recuperação de senha traz o token no endereço, e ele
// precisa ser lido e retirado dali ANTES de a tela montar — o motivo está em
// src/lib/recovery.ts. Numa visita comum isto termina de imediato.
const montar = () => createRoot(document.getElementById("root")!).render(<App />);
void prepararRecuperacaoDeSenha().then(montar, montar);
