import * as Popover from "@radix-ui/react-popover";
import {
  Bell,
  ChevronsUpDown,
  CircleHelp,
  ClipboardList,
  Columns3,
  FileText,
  FlaskConical,
  History,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Monitor,
  Moon,
  MoreHorizontal,
  Package,
  RotateCcw,
  Rows3,
  Search,
  Settings,
  Sun,
  Target,
  Trophy,
  Tv,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppRoot, Banner, Main } from "@/components/layout/AppRoot";
import { useLayout } from "@/components/layout/LayoutContext";
import { SideNav, SideNavBody, SideNavFooter, SideNavItem, SideNavSection } from "@/components/layout/SideNav";
import {
  SideNavToggleButton,
  TopNav,
  TopNavContent,
  TopNavEnd,
  TopNavMiddle,
  TopNavStart,
} from "@/components/layout/TopNav";
import { Button, IconButton } from "@/components/ui/Button";
import { EmptyState, FlagStack, type FlagData } from "@/components/ui/Feedback";
import { Kbd } from "@/components/ui/Kbd";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/Menu";
import { Avatar, WegTile } from "@/components/ui/Misc";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { MachinesPage, type DemoState } from "@/features/machines/MachinesPage";
import { useColorMode, type ColorModePreference } from "@/lib/hooks";
import { cn, readToken, storageGet, storageSet } from "@/lib/utils";

/* ---------- Navegação ---------- */
type NavEntry = { id: string; label: string; icon?: LucideIcon; count?: number; dot?: string };

const NAV_MAIN: NavEntry[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "apontamento", label: "Apontamento", icon: ClipboardList },
  { id: "historico", label: "Histórico", icon: History },
  { id: "metas", label: "Metas", icon: Target },
  { id: "feedbacks", label: "Feedbacks", icon: MessageSquare, count: 12 },
  { id: "relatorios", label: "Relatórios", icon: FileText },
];
const NAV_SECTIONS: Array<{ title: string; items: NavEntry[] }> = [
  {
    title: "Linhas",
    items: [
      { id: "linha-horizontais", label: "Horizontais", icon: Rows3 },
      { id: "linha-verticais", label: "Verticais", icon: Columns3 },
      { id: "linha-granel", label: "Granel & Interruptores", icon: Package },
    ],
  },
  {
    title: "Análises",
    items: [
      { id: "ranking", label: "Ranking de máquinas", icon: Trophy },
      { id: "retrabalho", label: "Retrabalho", icon: RotateCcw },
    ],
  },
  {
    title: "Turnos",
    // Pontos com cores de destaque: decorativos, sem significado de status
    items: [
      { id: "turno-1", label: "Turno 1", dot: "bg-icon-accent-blue" },
      { id: "turno-2", label: "Turno 2", dot: "bg-icon-accent-teal" },
      { id: "turno-3", label: "Turno 3", dot: "bg-icon-accent-purple" },
    ],
  },
];
const ALL_NAV = [...NAV_MAIN, ...NAV_SECTIONS.flatMap((s) => s.items), { id: "tv", label: "Modo TV" }, { id: "ajuda", label: "Ajuda" }];

const PLANTS = [
  { id: "jaragua", label: "Jaraguá do Sul" },
  { id: "itajai", label: "Itajaí" },
  { id: "guaramirim", label: "Guaramirim" },
];

const USER = { name: "Rafael Souza", role: "Gestor" };

function useHashRoute() {
  const read = () => window.location.hash.replace(/^#\/?/, "") || "dashboard";
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onHash = () => setRoute(read());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
}

export default function App() {
  const route = useHashRoute();
  const colorMode = useColorMode();
  const [search, setSearch] = useState("");
  const [demoState, setDemoState] = useState<DemoState>("live");
  const [plant, setPlant] = useState("jaragua");
  const [flags, setFlags] = useState<FlagData[]>([]);
  const [bannerOpen, setBannerOpen] = useState(() => !storageGet("dash-proto.banner.dismissed", false));
  const flagId = useRef(0);

  const notify = useCallback((title: string, description?: string) => {
    setFlags((f) => [...f.slice(-2), { id: ++flagId.current, title, description }]);
  }, []);
  const dismissFlag = useCallback((id: number) => setFlags((f) => f.filter((x) => x.id !== id)), []);

  // "Tentar novamente" / estado de carregamento de demonstração volta sozinho
  useEffect(() => {
    if (demoState !== "loading") return;
    const t = window.setTimeout(() => setDemoState("live"), readToken("--ds-motion-duration-skeleton"));
    return () => window.clearTimeout(t);
  }, [demoState]);

  const plantLabel = PLANTS.find((p) => p.id === plant)?.label ?? "";
  const current = ALL_NAV.find((n) => n.id === route);

  return (
    <TooltipProvider>
      <AppRoot
        banner={
          bannerOpen && (
            <Banner
              onDismiss={() => {
                setBannerOpen(false);
                storageSet("dash-proto.banner.dismissed", true);
              }}
            >
              Protótipo de interface · dados de demonstração de março de 2026
            </Banner>
          )
        }
        topNav={
          <TopNav>
            <TopNavStartArea plantLabel={plantLabel} plant={plant} onPlantChange={setPlant} />
            <TopNavContent>
              <TopNavMiddle>
                <SearchField value={search} onChange={setSearch} />
              </TopNavMiddle>
              <TopNavEnd>
                <Notifications />
                <IconButton icon={CircleHelp} label="Ajuda" onClick={() => (window.location.hash = "/ajuda")} />
                <ThemeMenu preference={colorMode.preference} resolved={colorMode.resolved} onChange={colorMode.setPreference} />
                <DemoMenu value={demoState} onChange={setDemoState} />
                <UserMenu />
              </TopNavEnd>
            </TopNavContent>
          </TopNav>
        }
        sideNav={
          <SideNav header={<PlantSwitcher plant={plant} plantLabel={plantLabel} onChange={setPlant} />}>
            <SideNavBody>
              <SideNavSection>
                {NAV_MAIN.map((n) => (
                  <SideNavItem key={n.id} href={`#/${n.id}`} label={n.label} icon={n.icon} count={n.count} isCurrent={route === n.id} />
                ))}
              </SideNavSection>
              {NAV_SECTIONS.map((section) => (
                <SideNavSection key={section.title} title={section.title}>
                  {section.items.map((n) => (
                    <SideNavItem
                      key={n.id}
                      href={`#/${n.id}`}
                      label={n.label}
                      icon={n.icon}
                      isCurrent={route === n.id}
                      elemBefore={n.dot && <span className={cn("size-dot rounded-full", n.dot)} />}
                    />
                  ))}
                </SideNavSection>
              ))}
            </SideNavBody>
            <SideNavFooter>
              <SideNavItem href="#/tv" label="Modo TV" icon={Tv} isCurrent={route === "tv"} />
              <SideNavItem href="#/ajuda" label="Ajuda" icon={CircleHelp} isCurrent={route === "ajuda"} />
              <SideNavUser />
            </SideNavFooter>
          </SideNav>
        }
      >
        <Main>
          {route === "dashboard" ? (
            <MachinesPage
              search={search}
              onClearSearch={() => setSearch("")}
              demoState={demoState}
              onDemoStateChange={setDemoState}
              notify={notify}
            />
          ) : (
            <div className="px-200 pt-300 m:px-400">
              <h1 className="font-heading-large text-default">{current?.label ?? "Página não encontrada"}</h1>
              <EmptyState
                icon={current?.icon ?? LayoutDashboard}
                title="Fora do escopo do protótipo"
                hint="Este protótipo detalha apenas o Dashboard de máquinas. A navegação, os estados de seleção e o layout já funcionam em todas as páginas."
                action={{ label: "Ir para o Dashboard", icon: LayoutDashboard, onClick: () => (window.location.hash = "/dashboard") }}
              />
            </div>
          )}
        </Main>
      </AppRoot>
      <FlagStack flags={flags} onDismiss={dismissFlag} />
    </TooltipProvider>
  );
}

/* ---------- Top nav: início ---------- */
function TopNavStartArea({
  plant,
  plantLabel,
  onPlantChange,
}: {
  plant: string;
  plantLabel: string;
  onPlantChange: (p: string) => void;
}) {
  const { isSideNavInline, isMedium } = useLayout();
  return (
    <TopNavStart>
      {isSideNavInline ? (
        // Expandida: o cabeçalho da side nav sobe para cá → barra lateral de altura total
        <>
          <div className="min-w-0 flex-1">
            <PlantSwitcher plant={plant} plantLabel={plantLabel} onChange={onPlantChange} />
          </div>
          <SideNavToggleButton />
        </>
      ) : (
        <>
          <SideNavToggleButton />
          <a href="#/dashboard" className="flex items-center gap-100 rounded-medium pr-050" aria-label="Dash de Produção, início">
            <WegTile />
            {isMedium && <span className="font-heading-xsmall text-default">Dash de Produção</span>}
          </a>
        </>
      )}
    </TopNavStart>
  );
}

function PlantSwitcher({ plant, plantLabel, onChange }: { plant: string; plantLabel: string; onChange: (p: string) => void }) {
  const L = useLayout();
  return (
    <Menu onOpenChange={L.setSideNavMenuOpen}>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={`Dash de Produção, fábrica ${plantLabel}. Trocar unidade`}
          className="ds-pressable flex w-full min-w-0 items-center gap-100 rounded-medium p-050 text-left hover:bg-neutral-subtle-hovered active:bg-neutral-subtle-pressed data-[state=open]:bg-neutral-subtle-pressed"
        >
          <WegTile />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-heading-xsmall text-default">Dash de Produção</span>
            <span className="truncate font-body-small text-subtle">Fábrica · {plantLabel}</span>
          </span>
          <ChevronsUpDown aria-hidden className="size-icon-small shrink-0 text-icon-subtle" />
        </button>
      </MenuTrigger>
      <MenuContent className="min-w-sidenav-flyout max-w-popover">
        <MenuLabel>Unidades</MenuLabel>
        <MenuRadioGroup value={plant} onValueChange={onChange}>
          {PLANTS.map((p) => (
            <MenuRadioItem key={p.id} value={p.id}>
              Fábrica · {p.label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

/* ---------- Top nav: busca ---------- */
function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const { isMedium } = useLayout();
  // < 768px: a busca vira um botão; aberta, ocupa a top nav inteira
  const [expanded, setExpanded] = useState(false);
  const compact = !isMedium;

  useEffect(() => {
    if (expanded) ref.current?.focus();
  }, [expanded]);
  useEffect(() => {
    if (isMedium) setExpanded(false);
  }, [isMedium]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !/input|textarea|select/i.test(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        if (compact) setExpanded(true);
        else ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compact]);

  if (compact && !expanded) {
    return (
      <div className="flex w-full justify-end">
        <IconButton icon={Search} label={value ? `Buscar: ${value}` : "Buscar"} isSelected={!!value} onClick={() => setExpanded(true)} />
      </div>
    );
  }

  const field = (
    <label className="group relative flex w-full max-w-search-width items-center">
      <span className="sr-only">Buscar máquinas e linhas</span>
      <Search aria-hidden className="pointer-events-none absolute left-100 size-icon-small text-icon-subtle" />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          onChange("");
          if (compact) setExpanded(false);
          else e.currentTarget.blur();
        }}
        placeholder="Buscar máquinas e linhas"
        className="h-control w-full min-w-0 rounded-medium border border-input bg-input pl-400 pr-400 font-body text-default transition-colors duration-hover ease-out placeholder:text-subtlest hover:bg-input-hovered focus:border-focused"
      />
      <span className="pointer-events-none absolute right-100 hidden s:flex group-focus-within:hidden">
        <Kbd>/</Kbd>
      </span>
    </label>
  );

  if (!compact) return field;
  return (
    <div className="absolute inset-0 z-sticky flex items-center gap-100 border-b bg-surface px-150">
      {field}
      <Button appearance="subtle" onClick={() => setExpanded(false)}>
        Cancelar
      </Button>
    </div>
  );
}

/* ---------- Top nav: fim ---------- */
const NOTIFICATIONS = [
  { id: 1, dot: "bg-icon-danger", status: "Crítico", title: "Meta de março em risco", body: "Atingimento geral em 49% a 9 dias úteis do fim do mês.", time: "há 12 min" },
  { id: 2, dot: "bg-icon-brand", status: "Novo", title: "12 novos feedbacks", body: "Operadores do Turno 2 comentaram a linha Horizontais.", time: "há 1 h" },
  { id: 3, dot: "bg-icon-warning", status: "Atenção", title: "Turno 3 sem apontamento", body: "VERTICAL PLACAS / SUP. 2 não registrou produção em 20/03.", time: "ontem" },
];

function Notifications() {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <IconButton icon={Bell} label={`Notificações, ${NOTIFICATIONS.length} não lidas`} className="data-[state=open]:bg-neutral-subtle-pressed">
          <span aria-hidden className="absolute right-075 top-075 size-status-dot rounded-full border-thick border-surface bg-icon-danger" />
        </IconButton>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={8}
          className="z-menu w-popover max-w-full origin-popover rounded-large bg-surface-overlay text-default shadow-overlay data-[state=closed]:animate-menu-out data-[state=open]:animate-menu-in"
        >
          <div className="flex items-center justify-between border-b px-200 py-150">
            <h2 className="font-heading-small">Notificações</h2>
            <span className="font-body-small text-subtlest">{NOTIFICATIONS.length} não lidas</span>
          </div>
          <ul className="py-050">
            {NOTIFICATIONS.map((n) => (
              <li key={n.id} className="flex gap-150 px-200 py-150 transition-colors duration-hover ease-out hover:bg-neutral-subtle-hovered">
                <span aria-hidden className={cn("mt-075 size-dot shrink-0 rounded-full", n.dot)} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    <span className="sr-only">{n.status}: </span>
                    {n.title}
                  </p>
                  <p className="mt-025 text-subtle">{n.body}</p>
                  <p className="mt-050 font-body-small text-subtlest">{n.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function ThemeMenu({
  preference,
  resolved,
  onChange,
}: {
  preference: ColorModePreference;
  resolved: "light" | "dark";
  onChange: (p: ColorModePreference) => void;
}) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <IconButton icon={resolved === "dark" ? Moon : Sun} label="Tema" className="data-[state=open]:bg-neutral-subtle-pressed" />
      </MenuTrigger>
      <MenuContent align="end">
        <MenuLabel>Tema</MenuLabel>
        <MenuRadioGroup value={preference} onValueChange={(v) => onChange(v as ColorModePreference)}>
          <MenuRadioItem value="light">
            <Sun aria-hidden className="size-icon-small text-icon-subtle" /> Claro
          </MenuRadioItem>
          <MenuRadioItem value="dark">
            <Moon aria-hidden className="size-icon-small text-icon-subtle" /> Escuro
          </MenuRadioItem>
          <MenuRadioItem value="auto">
            <Monitor aria-hidden className="size-icon-small text-icon-subtle" /> Igual ao sistema
          </MenuRadioItem>
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

function DemoMenu({ value, onChange }: { value: DemoState; onChange: (s: DemoState) => void }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <IconButton
          icon={FlaskConical}
          label="Estados do protótipo"
          isSelected={value !== "live"}
          className="data-[state=open]:bg-neutral-subtle-pressed"
        />
      </MenuTrigger>
      <MenuContent align="end">
        <MenuLabel>Estado dos dados</MenuLabel>
        <MenuRadioGroup value={value} onValueChange={(v) => onChange(v as DemoState)}>
          <MenuRadioItem value="live">Normal</MenuRadioItem>
          <MenuRadioItem value="loading">Carregando</MenuRadioItem>
          <MenuRadioItem value="empty">Vazio</MenuRadioItem>
          <MenuRadioItem value="error">Erro</MenuRadioItem>
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

function UserMenuItems() {
  return (
    <>
      <MenuLabel>{USER.name}</MenuLabel>
      <MenuItem icon={UserRound}>Perfil</MenuItem>
      <MenuItem icon={Settings}>Preferências</MenuItem>
      <MenuSeparator />
      <MenuItem icon={LogOut}>Sair</MenuItem>
    </>
  );
}

function UserMenu() {
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={`Conta de ${USER.name}`}
          className="ds-pressable ml-050 flex size-control items-center justify-center rounded-full hover:bg-neutral-subtle-hovered"
        >
          <Avatar name={USER.name} />
        </button>
      </MenuTrigger>
      <MenuContent align="end">
        <UserMenuItems />
      </MenuContent>
    </Menu>
  );
}

function SideNavUser() {
  const L = useLayout();
  return (
    <div className="mt-100 flex items-center gap-100 rounded-medium px-050 py-050">
      <Avatar name={USER.name} size="medium" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium text-default">{USER.name}</span>
        <span className="truncate font-body-small text-subtlest">{USER.role}</span>
      </span>
      <Menu onOpenChange={L.setSideNavMenuOpen}>
        <MenuTrigger asChild>
          <IconButton icon={MoreHorizontal} label="Opções da conta" className="data-[state=open]:bg-neutral-subtle-pressed" />
        </MenuTrigger>
        <MenuContent align="end" side="top">
          <UserMenuItems />
        </MenuContent>
      </Menu>
    </div>
  );
}
