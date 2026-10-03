# UI antiga aposentada — a virada vai com a interface nova

> Data: 03/10/2026 · Escrito pela sessão da **interface** · Para a sessão do **banco**
> Decisão do gestor, em 03/10: o projeto ainda não foi para produção, a UI antiga
> (telas de `src/`) não tem uso, e todo o esforço vai para a interface de
> `prototype/` e a integração dela com o banco.

## Em uma linha

As telas de `src/` saíram do repositório. A interface de `prototype/` passa a ser
publicada na **raiz** do GitHub Pages. A virada para o Supabase vai **com ela**, não
com as telas antigas como dizia o plano de 01/10.

## O que a interface já fez (PR #27)

| Saiu | Observação |
|---|---|
| `src/App.tsx`, `main.tsx`, `index.css`, `pages/`, `components/`, `contexts/`, `hooks/`, `utils/` | as telas antigas e o `AuthContext` |
| `src/lib/chart-options.ts`, `chart-params.ts`, `utils.ts` | só as telas antigas usavam |
| `src/test/login-recuperacao.test.tsx`, `example.test.ts` | testavam a `LoginPage` antiga / nada |
| `index.html`, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `components.json`, `preview.bat`, `tests/`, `playwright*.ts` | configuração do app antigo |
| 12 dependências | `react-router-dom`, `@tanstack/react-query`, `sonner`, `framer-motion`, `echarts-for-react`, `next-themes`, `react-day-picker`, `date-fns`, `class-variance-authority`, `tailwind-merge`, `tailwindcss-animate`, `@radix-ui/react-slot` |

**O que ficou intacto:** `src/lib/**` (fora os três arquivos acima) e `src/test/**`
(fora os dois acima). Os 73 testes de vocês passam.

**O que mudou na raiz:**
- `npm run dev`, `build`, `typecheck` e `test` agora são da interface. `test` roda os
  testes de vocês e os do adaptador. O teste de ponta a ponta virou uma fumaça da
  interface em `e2e/`.
- `ci.yml` novo: tipos, lint, testes e build em cada PR.
- `deploy.yml` publica `prototype/dist` na raiz. A variável do repositório agora se
  chama `DATA_SOURCE`, não `NOVA_DATA_SOURCE`. Com `supabase` e os dois segredos, o
  app fala com o banco. Sem ela, fica em demonstração.
- O `base` da interface passou a ser `/Dashboard-Tomadas/` no build. Com `"./"`, o
  link de recuperação que `supabase/auth.ts` monta (`origin + BASE_URL`) saía quebrado.

## O que pede ao banco

1. **Registrar a decisão** em `03-decisoes.md`: UI antiga aposentada e virada com a
   interface nova. Ela complementa a D44. Renomear `prototype/` continua para depois,
   numa PR combinada, porque mexe nos imports de `src/lib`.
2. **Revisar o plano de virada.**
   - O § 1 ("a virada vai com as telas ANTIGAS") deixa de valer.
   - O roteiro de abertura passa a ser a variável `DATA_SOURCE=supabase` no
     repositório, mais os segredos.
   - A data agora depende da interface gravar (ver abaixo), além do ensaio do extrator.
3. **Referências às telas antigas** em `docs/database/` (README, referência técnica e
   CHANGELOG citam `AuthContext`, "formato atual das telas", `adapters.ts` servindo
   as telas): ajustar quando for conveniente.
4. **Código da camada que só a UI antiga usava**, sem pressa, e vocês decidem:
   - `api.ts`: o cache de registros, metas e feriados (`loadCachedRecords` etc.).
     A interface não usa.
   - `completeOnboarding`: a interface não tem apresentação inicial.
   - `adminCreateUser`, `resetPassword`, `generateInviteCode`: são do Apps Script.
   - `gas.ts` e o caminho do Apps Script: saem quando o legado sair (`Main.gs` só com
     pedido explícito do gestor).
   - O contrato ainda fala o formato da planilha (`ProdRecord` com `producao`,
     `turno: "TURNO 1"`, `savedAt` em texto). A interface converte e funciona assim.
     Se quiserem simplificar, combinamos o tipo antes.
5. **Redirect URL do Auth:** `https://abnerlucena.github.io/Dashboard-Tomadas/`.
   O `/nova/` não existe mais.

## O que a interface faz a seguir (caminho crítico da virada)

A interface ainda só lê. Para abrir a fábrica, ela precisa gravar, nesta ordem:

| # | Tela | Contrato que vai usar |
|---|---|---|
| 1 | **Apontamento** | `saveEntries` com `operatorCount`, e `getMetasEm` para a meta do dia apontado |
| 2 | **Histórico**: corrigir, apagar, mover de dia, trocar turno, observação | `bulkDelete`, `bulkMove`, `bulkEditTurno`, `updateObs` |
| 3 | **Metas** | `saveMetas` com bases e vigência, e `getHistory` |
| 4 | **Calendário**: feriados e paradas (tela nova) | `getHolidays`, `addHoliday`, `removeHoliday` |
| 5 | **Máquinas**: cadastrar e desativar (tela nova) | `addMachine`, `toggleMachine` |

**Pergunta para vocês:** o Histórico da interface edita **um** apontamento (quantidade,
turno, retrabalho, observação). O contrato tem as operações em massa e `updateObs`,
mas não "corrigir a quantidade de um apontamento". Isso é `save_production_record`
(completar) ou falta uma operação? Se faltar, proponho o tipo em `types.ts` antes de
escrever a tela.
