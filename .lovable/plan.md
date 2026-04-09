

## Plano: Design Mobile Moderno e Funcional

### Objetivo
Transformar a experiência mobile do dashboard e login em algo que pareça um **app nativo** — com navegação bottom bar, gestos visuais, cards otimizados para toque, e gráficos legíveis em telas pequenas.

---

### Mudanças na Login Page (mobile)

- **Layout fullscreen** sem card em telas < 640px — o formulário ocupa a tela inteira com fundo gradiente direto, inputs maiores (py-4), e botão de submit com altura 56px para facilitar o toque
- **Logo centralizada** com animação de entrada mais dramática (slide up + fade)
- **Inputs com ícones internos** (User, Lock) para melhor affordance em telas pequenas
- **Teclado-friendly**: inputs com `inputMode`, `autoComplete`, e scroll automático quando teclado aparece

### Mudanças no Dashboard (mobile) — 5 áreas principais

#### 1. Bottom Navigation Bar (substituir hamburger menu)
- Barra fixa no bottom com 3 abas (Visão Geral, Gráficos, Detalhes) + ícones
- Aba ativa com indicador animado (pill colorida)
- Header simplificado: só logo + avatar + logout
- `pb-20` no main para compensar a bottom bar

#### 2. KPI Cards Redesenhados
- Layout **horizontal scrollável** (flex row + overflow-x-auto + snap) em vez de grid 2x2
- Cada card mais compacto e visual: ícone grande colorido à esquerda, valor + label à direita
- Scroll indicators (dots) abaixo dos cards

#### 3. Machine Cards Mobile-First
- Cards mais altos com **barra de progresso circular** (ring) em vez de linear — mais visual e moderno
- Toque no card expande detalhes (mini accordion) com produção, meta e dias
- Grid 1 coluna com gap menor (gap-2)

#### 4. Gráficos Otimizados
- Altura reduzida (220px) com **botão "Expandir"** que abre fullscreen (dialog/sheet)
- No fullscreen: gráfico ocupa 100vh com botão fechar no topo
- Bar chart sempre vertical em mobile com nomes truncados
- Pie chart com labels inline (sem legenda separada ocupando espaço)
- Swipe horizontal entre gráficos (carousel com dots)

#### 5. Tabela de Detalhes → Cards
- Em mobile, substituir tabela por **lista de cards empilhados** (cada máquina = 1 card)
- Cada card mostra: nome, barra de progresso, produção/meta lado a lado, badge de %
- Manter tabela no desktop

---

### Detalhes Técnicos

**Arquivos a modificar:**
- `src/pages/LoginPage.tsx` — layout condicional mobile fullscreen
- `src/pages/DashboardPage.tsx` — bottom bar, KPI scroll, cards redesenhados, chart carousel, detail cards
- `src/index.css` — estilos para snap scroll, bottom bar safe area (`env(safe-area-inset-bottom)`)

**Arquivos a criar:**
- `src/components/BottomNav.tsx` — navegação mobile bottom bar
- `src/components/ChartFullscreen.tsx` — modal fullscreen para gráficos
- `src/components/MachineCardMobile.tsx` — card de máquina com progresso circular
- `src/components/MobileDetailCards.tsx` — cards substitutos da tabela em mobile

**Nenhuma funcionalidade será removida** — tudo continua funcionando no desktop exatamente como está. As mudanças são condicionais via `isMobile` e classes responsivas do Tailwind.

