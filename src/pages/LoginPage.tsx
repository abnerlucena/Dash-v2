import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import WEGLogo from "@/components/WEGLogo";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [nome, setNome] = useState("");
  const [codigoAcesso, setCodigoAcesso] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: string; msg: string }>({ type: "", msg: "" });

  const isLogin = mode === "login";

  function switchMode(m: "login" | "register") {
    setMode(m); setAlert({ type: "", msg: "" }); setSenha(""); setSenha2(""); setCodigoAcesso("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome || !senha) { setAlert({ type: "error", msg: "Preencha todos os campos." }); return; }
    if (!isLogin) {
      if (nome.length < 3) { setAlert({ type: "error", msg: "Nome muito curto (mín. 3 caracteres)." }); return; }
      if (senha.length < 4) { setAlert({ type: "error", msg: "Senha muito curta (mín. 4 caracteres)." }); return; }
      if (senha !== senha2) { setAlert({ type: "error", msg: "As senhas não coincidem." }); return; }
      if (!codigoAcesso.trim()) { setAlert({ type: "error", msg: "Informe o código de acesso." }); return; }
    }
    setLoading(true); setAlert({ type: "", msg: "" });
    try {
      if (isLogin) {
        await login(nome, senha);
      } else {
        await register(nome, senha, codigoAcesso);
      }
      setAlert({ type: "success", msg: isLogin ? "Bem-vindo!" : "Conta criada com sucesso!" });
      setTimeout(() => navigate("/dashboard"), 600);
    } catch (e: any) {
      setAlert({ type: "error", msg: e.message || "Erro de conexão" });
    }
    setLoading(false);
  }

  const inputCls =
    "h-11 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors duration-fast focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring";
  const labelCls = "mb-1.5 block text-sm text-foreground";

  return (
    // Fundo navy WEG sólido (assinatura da marca), sem grade nem degradê
    <div className="relative flex min-h-screen items-center justify-center bg-weg-900 px-4 dark:bg-weg-950">
      <ThemeToggle onBrand className="absolute right-4 top-4" />

      <main className="w-full max-w-[400px]">
        <div className="rounded-xl border bg-card p-6 shadow-modal sm:p-8">
          {/* Logo */}
          <div className="mb-6 text-center">
            <div className="mb-4 inline-flex items-center justify-center rounded-sm bg-weg-600 px-4 py-2.5">
              <WEGLogo height={32} className="text-white" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">Dashboard de Produção</h1>
            <p className="mt-1 text-sm text-muted-foreground">{isLogin ? "Faça login para continuar" : "Crie sua conta de acesso"}</p>
          </div>

          {/* Mode toggle */}
          <div role="tablist" aria-label="Modo de acesso" className="mb-6 flex gap-1 rounded-md bg-muted p-1">
            {(["login", "register"] as const).map(m => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={cn(
                  "h-9 flex-1 rounded-sm text-sm transition-colors duration-fast",
                  mode === m ? "bg-card font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "login" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="login-nome" className={labelCls}>Nome de usuário</label>
              <input id="login-nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" autoFocus autoComplete="username" className={inputCls} />
            </div>
            <div>
              <label htmlFor="login-senha" className={labelCls}>Senha</label>
              <div className="relative">
                <input id="login-senha" type={showPw ? "text" : "password"} value={senha} onChange={e => setSenha(e.target.value)} placeholder="Mínimo 4 caracteres"
                  autoComplete={isLogin ? "current-password" : "new-password"} className={`${inputCls} pr-12`} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition-colors duration-fast hover:text-foreground">
                  {showPw ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="login-senha2" className={labelCls}>Confirmar senha</label>
                  <input id="login-senha2" type={showPw ? "text" : "password"} value={senha2} onChange={e => setSenha2(e.target.value)} placeholder="Repita a senha"
                    autoComplete="new-password" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="login-codigo" className={labelCls}>Código de acesso</label>
                  <input id="login-codigo" value={codigoAcesso} onChange={e => setCodigoAcesso(e.target.value)} placeholder="Informe o código fornecido" autoComplete="off"
                    aria-describedby="login-codigo-hint" className={inputCls} />
                  <p id="login-codigo-hint" className="mt-1 text-xs text-muted-foreground">Solicite o código de acesso ao administrador.</p>
                </div>
              </div>
            )}

            {alert.msg && (
              <div
                role={alert.type === "error" ? "alert" : "status"}
                className={cn(
                  "rounded-md border p-3 text-sm",
                  alert.type === "error" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-success/30 bg-success/10 text-success",
                )}
              >
                {alert.msg}
              </div>
            )}

            <Button type="submit" size="lg" disabled={loading} className="w-full">
              {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
              {loading ? "Aguarde…" : (isLogin ? "Entrar" : "Criar conta")}
            </Button>
          </form>

          {isLogin && (
            <p className="mt-5 text-center text-xs text-muted-foreground">
              Esqueceu a senha? Fale com o <span className="font-medium text-foreground">administrador</span>.
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
