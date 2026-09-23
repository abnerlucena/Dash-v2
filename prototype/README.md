# Dash de Produção — protótipo de interface

Protótipo de alta fidelidade da tela **Máquinas**, construído sobre um sistema de
tokens derivado do Atlassian Design System (fundações → componentes → padrões),
com a marca WEG. Fica isolado do app em produção: Vite, Tailwind e tokens próprios,
reaproveitando os `node_modules` da raiz.

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
├── src/components/data/      ← KpiStrip, DataTable, SegmentedBar, Sparkline
├── src/components/ui/        ← Button, IconButton, Lozenge, Tag, FilterPill, Menu,
│                               Tooltip, Checkbox, Skeleton, EmptyState, ErrorMessage, Flag
├── src/features/machines/    ← página Máquinas, colunas da tabela, painel de ordens
└── screenshots/              ← capturas dos estados (claro, escuro, flyout, mobile…)
```

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
