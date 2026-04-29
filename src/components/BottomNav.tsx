import { ClipboardEdit, LayoutDashboard, History, Target, MessageSquare } from "lucide-react";

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
      className="fixed left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
      // bottom: 0 explícito pra evitar quirk do Safari iOS que reposiciona elementos
      // fixed durante o scroll. paddingBottom usa max() pra garantir folga mínima
      // mesmo quando a safe-area do dispositivo retorna 0.
      style={{
        bottom: 0,
        paddingBottom: "max(env(safe-area-inset-bottom), 8px)",
      }}
    >
      <div className="flex items-stretch h-16">
        {tabs.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors"
            >
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-[3px] rounded-b-full bg-primary" />
              )}
              <t.icon
                size={20}
                className={`transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}
              />
              <span
                className={`text-[10px] font-bold transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}
              >
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
