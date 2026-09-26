# Dash de Produção — a interface do sistema

> **Esta pasta não é mais um protótipo.** Em 26/09/2026 ficou decidido que é
> **esta** a interface do Dash de Produção; a UI antiga em `src/` vai ser
> substituída por ela. O nome da pasta continua `prototype/` por enquanto só
> para não quebrar branches em andamento — ver a decisão **D44** em
> [`../docs/database/03-decisoes.md`](../docs/database/03-decisoes.md).
>
> O que ainda falta: ela roda com **dados fictícios**. A transição é ligá-la à
> camada de dados que já existe em `src/lib/repositories/`, que fala com o
> Supabase e com o Apps Script.

Interface de alta fidelidade do **Dash de Produção** (todas as páginas do menu),
construída sobre um sistema de tokens derivado do Atlassian Design System
(fundações → componentes → padrões), com a marca WEG. Hoje ainda roda isolada do
app: Vite, Tailwind e tokens próprios, reaproveitando os `node_modules` da raiz.

## Como rodar

```bash
npm run proto:dev        # http://localhost:8090
npm run proto:typecheck  # verificação de tipos
npm run proto:build      # build em prototype/dist
npm run proto:html       # HTML único (CSS + JS embutidos) em prototype/dist
node prototype/scripts/capture.mjs   # regera prototype/screenshots (servidor rodando)
```

## Estrutura

```
prototype/
├── src/styles/tokens.css     ← ÚNICA fonte de valores visuais (claro + escuro)
├── tailwind.config.ts        ← mapeamento Tailwind → tokens (substitui a escala padrão)
├── src/components/layout/    ← AppRoot, TopNav (+slots), SideNav (+Header/Body/Footer,
│                               item, seção, splitter, toggle, flyout), Main, Panel
├── src/components/data/      ← KpiStrip, DataTable, SegmentedBar, Sparkline, gráficos,
│                               BarList, MonthCalendar, HeatCell, StackedBar
├── src/components/ui/        ← Button, IconButton, Lozenge, Tag, FilterPill, Menu,
│                               Tooltip, Checkbox, Skeleton, EmptyState, ErrorMessage, Flag,
│                               TextField, TextArea, Modal, SegmentedControl
├── src/features/            ← páginas: machines (Dashboard, Linhas, Turnos), entry
│                               (Apontamento), history, metas, feedbacks, reports,
│                               analysis (Ranking, Retrabalho), tv, help
└── screenshots/              ← capturas dos estados (claro, escuro, flyout, mobile…)
```

## Dados do simulador de capacidade

O repositório é público: `capacityBaseline.ts` traz valores **fictícios** com a mesma estrutura
da planilha. Para gerar um build privado com os números reais, crie
`src/features/capacity/capacityBaseline.local.ts` (ignorado pelo Git) e rode o build com
`CAPACITY_DATA=real`.

## Tokens

- Nomes ADS: `--ds-[property]-[role]-[emphasis]-[state]`,
  por exemplo `--ds-background-brand-bold-hovered`.
  Tokens específicos do app usam `--dash-*` (layout, tamanhos, camadas).
- No Tailwind, as classes leem como o token: `bg-brand-bold`, `hover:bg-neutral-subtle-hovered`,
  `text-subtlest`, `border-focused`, `p-200`, `gap-075`, `rounded-medium`,
  `shadow-overlay`, `font-heading-large`, `font-metric-medium`.
- A paleta, os espaçamentos, os raios e as fontes padrão do Tailwind **não existem** aqui:
  `bg-blue-500` ou `p-4` não geram CSS. Todo valor novo entra primeiro no `tokens.css`.
- Tema: `data-color-mode="light|dark"` no `<html>`. Os componentes nunca mudam.
  O escuro deriva do azul-marinho WEG, e as superfícies mais altas são mais claras.

## Páginas

| Menu | O que faz |
| --- | --- |
| Dashboard | Tela Máquinas (abas abaixo) |
| Apontamento | Data + turno, máquinas por linha, várias OPs por máquina (sugere as OPs liberadas), retrabalho, observação, validação e Ctrl+S |
| OPs | Toda ordem que entra no sistema: Aguardando liberação → Em produção ⇄ Pausada (com motivo) → Concluída. "Pronta para concluir" quando atinge a quantidade; uma pessoa confirma. Nova OP, liberar, pausar, retomar e concluir |
| Histórico | Calendário do mês no tom do status; editar, mover, alterar turno e excluir (em lote), com Desfazer |
| Metas | Duas abas. **Metas vigentes**: meta por turno × turnos ativos × dias úteis, edição em lote com vigência futura e histórico. **Simulador de capacidade**: modelo da planilha Capacidade vs Pessoas (jornada, peças/min, eficiência, regime, pessoas), meta por turno recalculada ao vivo, gráfico de capacidade por processo (ECharts, com a marca do valor da planilha) e publicação no histórico |
| Feedbacks | Uma conversa por OP: observações dos operadores, respostas de líderes/gestor, respostas rápidas e avisos de etapa. Encerra quando a OP é concluída. Não lidas no contador do menu |
| Relatórios | Montador (tipo, período, máquinas, turnos, formato, seções) com pré-visualização; CSV real |
| Linhas / Turnos | A tela Máquinas com recorte fixo por linha (Montagem, Embalagem, Granel) ou por turno |
| Ranking | Posição por atingimento, produção, apontamento ou retrabalho, com movimento da semana |
| Retrabalho | Taxa por máquina (limite de 10%), motivos e lista de OPs |
| Modo TV | Telão de chão de fábrica por área (`#/tv/montagem`…): placar dos turnos, ranking das máquinas, máquina a máquina, ritmo (OPs concluídas por dia, peças/min) e destaques. Compara turnos e máquinas, nunca pessoas; o Turno 3 (hora extra) fica fora da disputa |
| Ajuda | Perguntas frequentes com busca, atalhos, legenda de status e suporte |

## Abas da tela Máquinas

| Aba | O que mostra |
| --- | --- |
| Visão geral | KPIs e tabela por máquina: atingimento, tendência de 14 dias úteis e último apontamento |
| Detalhado | Grade máquina × dia útil no tom do status do dia; `–` marca dia sem apontamento. Alterna entre quantidade e % da meta diária |
| Turnos | Produção por turno (KPIs), tabela com a participação de cada turno e barra de distribuição |
| Gráficos | Acumulado vs meta (linha), produção diária (colunas) e atingimento por máquina (barras, clique abre o painel). Todos têm visão em tabela |

Decisões que valem para todas as abas:

- **Filtros acima de tudo.** A linha de filtros fica fora das abas e define o recorte de KPIs, tabelas e gráficos.
  Com um turno filtrado, cada máquina é recortada para aquele turno, contra a meta do turno; máquinas que não rodam no turno saem do recorte.
  A aba Turnos é a exceção: ela compara os três turnos e só destaca o turno escolhido.
- **Uma fonte de dados.** A sparkline, a grade diária, o painel e os gráficos leem as mesmas ordens
  de produção (22 dias úteis em março/2026, referência 27/03), então os números sempre concordam.
- **Centros reais, números fictícios.** As 22 máquinas são os centros de trabalho da planilha
  (Montagem, Embalagem, Granel), com metas e produção inventadas. Os 10 centros por demanda (sem meta)
  aparecem no Apontamento, OPs e Feedbacks, mas não entram no atingimento.
- **Cor de turno fixa.** Azul, teal e magenta (`--ds-chart-categorical-1..3`) aparecem na navegação,
  nos KPIs, nas barras e nas legendas. A paleta foi validada nos dois temas (daltonismo, visão
  normal e contraste). A cor segue o turno, nunca a posição.
- **Recarregar mantém o quadro.** Numa troca de período, os gráficos continuam na tela esmaecidos.
  O skeleton aparece só no carregamento inicial.

## Comportamentos do layout

| Largura | Navegação lateral | Painel |
| --- | --- | --- |
| ≥ 1024px | Inline, redimensionável (240px até 50% da tela). Duplo clique no divisor recolhe. Recolhida, abre em flyout ao passar o mouse no botão. | Inline, 365px, redimensionável até 50% do conteúdo |
| 768–1023px | Recolhida; o botão abre em overlay | Sobrepõe o conteúdo |
| < 768px | Overlay com véu, largura `min(320px, 90vw)` | Sobrepõe o conteúdo |

Atalhos: `Ctrl+[` alterna a navegação, `/` foca a busca e `Esc` fecha flyout, overlay e painel.
Na tabela, `↑`/`↓` navegam pelas linhas e `Enter` abre o painel.

O ícone de frasco na barra superior ("Estados do protótipo") alterna os dados entre
Normal, Carregando, Vazio e Erro.

Os dados são fictícios (março de 2026). Produção e meta vêm do briefing; dias,
tendência e ordens são gerados de forma determinística.
