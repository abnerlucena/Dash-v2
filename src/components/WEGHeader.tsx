import { LogOut, Users, Settings, Menu, Tv } from "lucide-react";
import WEGLogo from "./WEGLogo";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";

interface WEGHeaderProps {
  onAdminClick?: () => void;
  onMenuClick?: () => void;
}

const WEGHeader = ({ onAdminClick, onMenuClick }: WEGHeaderProps) => {
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const isAdmin = user?.role === "admin";
  const now = new Date();
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <header className="sticky top-0 z-50" style={{ background: 'linear-gradient(135deg, #003366, #004E8C)', height: 60 }}>
      <div className="max-w-[1400px] mx-auto px-4 h-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-md p-1.5 px-3" style={{ background: '#0066B3' }}>
            <WEGLogo height={22} color="#fff" />
          </div>
          <div className="hidden sm:block">
            <span className="text-sm font-bold tracking-tight text-white block leading-tight">Dashboard de Produção</span>
            <span className="text-[10px] text-white/50">{user?.nome} · Atualizado às {timeStr}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={onAdminClick}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 text-sm font-medium transition-all"
            >
              <Settings size={14} />
              {!isMobile && <span>Admin</span>}
            </button>
          )}

          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 text-sm font-medium transition-all border border-white/20">
            <Tv size={14} />
            {!isMobile && <span>TV</span>}
          </button>

          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-bold transition-all"
            style={{ background: '#EF4444' }}
          >
            <LogOut size={14} />
            Sair
          </button>
        </div>
      </div>
    </header>
  );
};

export default WEGHeader;
