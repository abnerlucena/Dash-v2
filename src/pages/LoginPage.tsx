import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import WEGLogo from "@/components/WEGLogo";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const isMobile = useIsMobile();
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

  const inputCls = "w-full px-4 py-3 rounded-md border text-sm font-medium focus:outline-none focus:ring-2 transition-all";
  const inputLight = `${inputCls} border-border bg-white placeholder:text-muted-foreground/50 focus:ring-primary/30 focus:border-primary`;
  const inputDark = `${inputCls} border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:ring-white/30 focus:border-white/50 backdrop-blur-sm`;

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4"
      style={{ background: 'linear-gradient(160deg, #001D3D 0%, #003366 40%, #004E8C 100%)' }}>

      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: `linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)`, backgroundSize: '60px 60px' }} />

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="bg-white rounded-xl p-8 sm:p-10 shadow-2xl" style={{ borderRadius: 14 }}>
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center rounded-md p-3 px-5 mb-4" style={{ background: '#003366', borderRadius: 4 }}>
              <WEGLogo height={36} color="#fff" />
            </div>
            <h1 className="text-lg font-extrabold tracking-tight" style={{ color: '#003366' }}>Dashboard de Produção</h1>
            <p className="text-sm text-muted-foreground mt-1">{isLogin ? "Faça login para continuar" : "Crie sua conta de acesso"}</p>
          </div>

          {/* Mode toggle */}
          <div className="flex rounded-md p-1 mb-6 gap-1" style={{ background: '#F0F2F5', borderRadius: 4 }}>
            {(["login", "register"] as const).map(m => (
              <button key={m} onClick={() => switchMode(m)}
                className={`flex-1 py-2.5 text-sm font-bold rounded-sm transition-all duration-200 ${mode === m ? "bg-white shadow-sm" : "hover:text-foreground"}`}
                style={{ color: mode === m ? '#003366' : '#94A3B8', borderRadius: 3 }}>
                {m === "login" ? "Entrar" : "Criar Conta"}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold mb-1.5 block tracking-wide uppercase" style={{ color: '#1E293B' }}>Nome de usuário</label>
              <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" autoFocus className={inputLight} style={{ borderRadius: 6 }} />
            </div>
            <div>
              <label className="text-xs font-bold mb-1.5 block tracking-wide uppercase" style={{ color: '#1E293B' }}>Senha</label>
              <div className="relative">
                <input type={showPw ? "text" : "password"} value={senha} onChange={e => setSenha(e.target.value)} placeholder="Mínimo 4 caracteres"
                  className={`${inputLight} pr-16`} style={{ borderRadius: 6 }} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-0 top-0 bottom-0 px-3 flex items-center text-muted-foreground hover:text-foreground transition-colors border-l border-border">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold mb-1.5 block tracking-wide uppercase" style={{ color: '#1E293B' }}>Confirmar senha</label>
                  <input type={showPw ? "text" : "password"} value={senha2} onChange={e => setSenha2(e.target.value)} placeholder="Repita a senha"
                    className={inputLight} style={{ borderRadius: 6 }} />
                </div>
                <div>
                  <label className="text-xs font-bold mb-1.5 block tracking-wide uppercase" style={{ color: '#1E293B' }}>Código de acesso</label>
                  <input value={codigoAcesso} onChange={e => setCodigoAcesso(e.target.value)} placeholder="Informe o código fornecido" autoComplete="off"
                    className={inputLight} style={{ borderRadius: 6 }} />
                  <p className="text-[11px] text-muted-foreground mt-1">Solicite o código de acesso ao administrador.</p>
                </div>
              </div>
            )}

            {alert.msg && (
              <div className={`rounded-md p-3 text-sm font-medium ${alert.type === "error" ? "bg-red-50 text-red-700 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"}`}
                style={{ borderRadius: 6 }}>
                {alert.msg}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3.5 text-white font-bold text-sm shadow-lg hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #003366, #0066B3)', borderRadius: 8 }}>
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? "Aguarde..." : (isLogin ? "Entrar" : "Criar Conta")}
            </button>
          </form>

          {isLogin && (
            <p className="text-center text-xs text-muted-foreground mt-5">
              Esqueceu a senha? Fale com o <strong className="text-foreground">administrador</strong>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
