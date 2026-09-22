import { ClipboardEdit, LayoutDashboard, History, Target, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabId = "entry" | "dashboard" | "history" | "metas" | "feedbacks";

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs = [
  { id: "entry" as const, label: "Apontar", icon: ClipboardEdit },
  { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { id: "history" as const, label: "Histórico", icon: History },
  { id: "metas" as const, label: "Metas", icon: Target },
  { id: "feedbacks" as const, label: "Feedbacks", icon: MessageSquare },
];

const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed left-0 right-0 z-50 border-t bg-card/95 backdrop-blur-md"
      // bottom: 0 explícito pra evitar quirk do Safari iOS que reposiciona elementos
      // fixed durante o scroll. paddingBottom usa max() pra garantir folga mínima
      // mesmo quando a safe-area do dispositivo retorna 0.
      style={{
        bottom: 0,
        paddingBottom: "max(env(safe-area-inset-bottom), 8px)",
      }}
    >
      <div className="flex h-16 items-stretch">
        {tabs.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1 transition-colors duration-fast",
                isActive ? "text-brand-text" : "text-muted-foreground",
              )}
            >
              {isActive && (
                <span className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-b-sm bg-brand-text" aria-hidden="true" />
              )}
              <t.icon size={20} strokeWidth={isActive ? 2 : 1.5} aria-hidden="true" />
              <span className="text-caption font-medium">{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
