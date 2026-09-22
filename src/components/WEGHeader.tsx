import { useState, useEffect } from "react";
import { LogOut, Settings, Tv, BookOpen } from "lucide-react";
import WEGLogo from "./WEGLogo";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface WEGHeaderProps {
  onAdminClick?: () => void;
  onMenuClick?: () => void;
  onTVClick?: () => void;
  onTourClick?: () => void;
}

/** Botão do header sobre o navy WEG: ghost claro, alvo de 44px no mobile e 36px no desktop. */
function HeaderButton({ icon: Icon, label, onClick, showLabel, outlined, title }: {
  icon: typeof Settings;
  label: string;
  onClick?: () => void;
  showLabel: boolean;
  outlined?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      aria-label={showLabel ? undefined : label}
      className={cn(
        "press inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm text-white/80 transition-colors duration-fast hover:bg-white/10 hover:text-white sm:h-9 sm:min-w-9",
        outlined && "border border-white/20",
      )}
    >
      <Icon size={16} aria-hidden="true" />
      {showLabel && <span>{label}</span>}
    </button>
  );
}

const WEGHeader = ({ onAdminClick, onTVClick, onTourClick }: WEGHeaderProps) => {
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const isAdmin = user?.role === "admin";
  const [timeStr, setTimeStr] = useState(() =>
    new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );

  useEffect(() => {
    const id = setInterval(() => {
      setTimeStr(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    // Header sempre em navy WEG (assinatura da marca), nos dois temas.
    <header className="sticky top-0 z-50 h-14 border-b border-white/10 bg-weg-900 text-white dark:bg-weg-950">
      <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="rounded-sm bg-weg-600 px-2.5 py-1.5">
            <WEGLogo height={20} className="text-white" />
          </div>
          <div className="hidden sm:block">
            <span className="block text-sm font-medium leading-tight">Dashboard de Produção</span>
            <span className="text-xs text-white/60">{user?.nome} · atualizado às {timeStr}</span>
          </div>
        </div>

        <nav className="flex items-center gap-1" aria-label="Ações">
          {isAdmin && <HeaderButton icon={Settings} label="Admin" onClick={onAdminClick} showLabel={!isMobile} />}
          {onTourClick && <HeaderButton icon={BookOpen} label="Tour" title="Ver tour do produto" onClick={onTourClick} showLabel={!isMobile} />}
          <HeaderButton icon={Tv} label="TV" title="Abrir modo apresentação (TV)" onClick={onTVClick} showLabel={!isMobile} outlined />
          <ThemeToggle onBrand className="h-11 w-11 sm:h-9 sm:w-9" />
          <HeaderButton icon={LogOut} label="Sair" onClick={logout} showLabel={!isMobile} />
        </nav>
      </div>
    </header>
  );
};

export default WEGHeader;
