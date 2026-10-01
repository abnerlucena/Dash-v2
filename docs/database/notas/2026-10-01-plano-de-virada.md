# Plano de virada — do Apps Script para o Supabase

> Rascunho de 01/10/2026, escrito pelo lado do **banco**, a pedido do gestor.
> A ideia original: congelar na sexta, carregar no fim de semana, abrir na
> segunda. A ideia está certa. As datas e dois pontos de atenção abaixo.
>
> **Nada aqui está decidido.** É proposta para o gestor aprovar.

---

## 1. A virada vai com as telas ANTIGAS, não com a UI nova

A UI nova (`prototype/`) ainda não fala com o banco — a nota de
[direcionamento](2026-10-01-direcionamento-para-a-ui.md) lista o que falta.

As telas antigas (`src/`), em modo Supabase, **já falam**. Conferido hoje, o
adaptador não tem lacuna funcional:

| O que | Apps Script | `src/` em modo Supabase |
|---|---|---|
| Apontamento, ordens, retrabalho | sim | **sim** |
| Dashboard, histórico, relatórios | sim | **sim** |
| Metas com vigência | não (meta plana) | **sim, melhor** |
| Calendário de paradas | sim | **sim** |
| Feedbacks | sim | **sim** |
| Usuários e aprovação | sim | **sim** |
| Alertas por e-mail | **não existe** | não existe |

Ou seja: a virada não perde função nenhuma, e ganha o histórico de metas, a
auditoria e o nº de operadores. A UI nova entra depois, sem segunda virada —
troca de tela, não troca de banco.

**Consequência:** a sessão de UI **não é caminho crítico** da virada. Ela pode
trabalhar em paralelo sem pressa de data.

---

## 2. O risco que não é técnico: ninguém tem conta

Este é o ponto que pode perder um turno inteiro.

No Apps Script o gestor **cria a conta** da pessoa e **define a senha**. No
Supabase, por decisão de segurança (D19, D20), isso mudou:

```
   hoje:  gestor cria a conta e entrega a senha
  depois: a pessoa se cadastra  →  o gestor aprova  →  a pessoa entra
```

A mudança existe porque criar conta pelo painel exigiria a `service_role key`
no navegador, o que entregaria o banco inteiro a quem abrisse o console. Não há
como voltar atrás sem abrir esse buraco.

**O que isso significa na segunda-feira:** se a equipe do T1 chegar às 04:55 sem
conta aprovada, ninguém aponta. E o cadastro depende de **e-mail funcionando** —
é o e-mail que confirma a conta e que recupera senha.

### O que precisa acontecer ANTES do fim de semana

1. **SMTP da WEG configurado.** Sem isso o cadastro e a recuperação não
   funcionam. O remetente embutido do Supabase é limitado a poucos e-mails por
   hora — não aguenta a fábrica se cadastrando na mesma manhã. **Isso é um
   pedido à TI, com prazo que não controlamos: é o caminho crítico.**
2. **Levantar quem precisa de conta**, por turno, com e-mail. Operador que não
   tem e-mail corporativo é um caso a resolver antes, não no dia.
3. **Cadastrar e aprovar todo mundo na semana anterior**, e pedir que cada um
   **entre uma vez** para confirmar. Conta que nunca foi testada não conta.

---

## 3. A data: proposta é 13/10, não 05/10

Este fim de semana (03–04/10) daria **um dia** de preparo. O SMTP sozinho não
cabe nisso.

Uma semana depois cai muito melhor, e por sorte do calendário:

| Dia | O quê |
|---|---|
| **sex 09/10**, fim do T3 | **Congelamento.** O Apps Script vira somente-leitura |
| sáb 10/10 | Carga do histórico e conferência |
| dom 11/10 | Conferência, sobra de folga |
| **seg 12/10** | **Feriado** (N. Sra. Aparecida) — produção quase nula, folga de verdade |
| **ter 13/10**, T1 04:55 | **Abertura** |

Três dias de janela em vez de dois, e o feriado ainda **testa o calendário**: se
o dia 12 aparecer como meta zero em vez de dia perdido, o cadastro de feriados
está certo.

Se o gestor preferir 05/10 mesmo, é possível — **desde que o SMTP já esteja
pronto amanhã**. Caso contrário a abertura trava no login, e isso é pior do que
esperar uma semana.

---

## 4. Roteiro

### Semana de 02 a 08/10 — preparo (nada de produção é tocado)

| # | O quê | Quem |
|---|---|---|
| 1 | Criar o projeto Supabase **oficial** | banco |
| 2 | Rodar as 27 migrations na ordem, do zero | banco |
| 3 | `select public.bootstrap_admin('<e-mail do gestor>');` | banco |
| 4 | Ligar **backup/PITR** e **ensaiar uma restauração** | banco |
| 5 | **SMTP da WEG** + URLs de redirect | gestor + TI |
| 6 | Carregar os 22 centros e as metas acordadas | banco |
| 7 | Cadastrar feriados e paradas de 2026/2027, por turno | gestor |
| 8 | Confirmar a **lotação padrão de A Granél** (hoje está 1) | gestor |
| 9 | Cadastrar, aprovar e **testar o login** de cada pessoa | gestor |
| 10 | **Ensaiar o extrator** contra uma exportação nova da planilha | banco |

O item 10 merece destaque: o extrator foi escrito contra a planilha até
21/09/2026. A planilha de hoje tem linhas novas. Descobrir uma coluna mudada de
lugar **na sexta à noite** é o jeito ruim de descobrir.

### Sexta 09/10, fim do T3 — congelamento

- Último apontamento entra no Apps Script.
- A planilha vira **somente-leitura** para todos (não apagar: é a prova).
- Exportar o `.xlsx` e guardar uma cópia com data no nome.

### Sábado 10/10 — carga

Os quatro passos da importação, já construídos e reversíveis:

| Passo | O quê |
|---|---|
| 1 | Área de preparo (migration, já no banco) |
| 2 | `extrair.cjs` lê a planilha e escreve na preparo — **nada oficial ainda** |
| 3 | Carga da preparo para a produção |
| 4 | Conferência mês a mês |

Cada linha da preparo guarda **de qual célula da planilha veio**, com o conteúdo
original ao lado da interpretação. Divergência se rastreia até a origem, e o
**lote inteiro se desfaz** sem tocar no que a equipe já digitou.

### Domingo 11/10 — conferência do gestor

O gestor compara mês a mês: total de peças, total de retrabalho, dias com
produção. **Se um mês não fechar, desfaz o lote e a virada não acontece** — o
Apps Script volta a escrever e tentamos no fim de semana seguinte. Essa saída
precisa estar combinada antes, não improvisada no domingo à noite.

### Terça 13/10 — abertura

- `VITE_DATA_SOURCE=supabase` no ambiente publicado.
- Alguém do banco acompanhando o **primeiro T1 inteiro**, de 04:55 às 14:18.
- O Apps Script fica de pé, **somente-leitura**, por pelo menos um mês.

---

## 5. Sem digitação dupla, e por quê

O gestor não quer digitação dupla, e está certo: dois lugares para o mesmo
número produzem duas verdades, e ninguém sabe qual vale. O corte é limpo.

O que substitui a rede de proteção:

- a planilha **continua legível** por um mês (consulta, não escrita);
- o lote da importação **se desfaz inteiro** até o domingo;
- o `.xlsx` congelado na sexta é a prova do que existia na virada.

---

## 6. O que fica para depois da virada, de propósito

Nada disso impede abrir — mas vale estar dito, para ninguém descobrir sozinho:

| Item | Efeito de não ter |
|---|---|
| Material e motivo de retrabalho (lacunas 1 e 2) | o retrabalho entra como hoje: só a quantidade |
| D34 — painel de metas | o gestor edita metas na tela antiga |
| D36 — atingimento × disponibilidade | o indicador não desconta parada |
| Degraus históricos de meta | meses antigos usam a meta atual puxada para trás |
| UI nova | entra depois, sem segunda virada |

---

## 7. As três perguntas para o gestor

1. **13/10 ou 05/10?** Se 05/10, o SMTP precisa estar pronto amanhã.
2. **Quem precisa de conta**, por turno, com e-mail — e quem não tem e-mail
   corporativo?
3. **Quem confere a carga no domingo**, e com que critério um mês "fecha"?
