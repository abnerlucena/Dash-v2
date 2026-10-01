# Direcionamento para a sessão de UI — 01/10/2026

> Continuação da nota de 27/09 ([ligar-a-ui-nova-ao-banco](2026-09-27-ligar-a-ui-nova-ao-banco.md)).
> Aquela continua valendo inteira; esta conta **o que mudou no banco desde então**
> e o que isso pede da interface.
>
> Resumo em uma linha: aquela nota terminava na **0.19.0, ainda não aplicada**.
> Hoje a **0.20.0 está aplicada**, com seis decisões novas por cima (D48 a D53).
> Três delas mudam o que a tela precisa mostrar.

---

## 1. O que mudou no banco desde 27/09

| Versão | O que entrou | Afeta a UI? |
|---|---|---|
| 0.19.1 | Zero operadores é "não informado" (D48) | sim |
| 0.19.2 | A importação grava a base da meta | não |
| 0.19.3 | **Teto na meta rateada** (D49) | **sim** |
| 0.19.4 | `_consolidado.sql` aposentado (D51); migration por id (D50) | não |
| 0.19.5 | **Nº de operadores em todas as máquinas, e dá para apagar** (D52) | **sim** |
| 0.20.0 | **A base da meta pode ser definida pelo app** (D53) | **sim** |

Tudo **aplicado** no projeto de testes. As migrations 0021 a 0027 já rodaram —
o item 1 da "ordem sugerida" da nota anterior está feito.

---

## 2. A conta da meta ganhou um teto (D49)

A tabela da seção 3 da nota anterior continua certa, com **uma correção** na
linha do meio:

| Base | Meta do turno |
|---|---|
| `per_shift` | o próprio número |
| `per_shift_prorated` | número × **menor(pessoas, lotação padrão)** ÷ lotação padrão |
| `per_operator` | número × pessoas |

**O que mudou:** gente **acima** da lotação padrão não aumenta mais a meta. Uma
horizontal com lotação 4 e 6 pessoas dá 10.000, não 15.000. Gente a **menos**
continua reduzindo proporcionalmente.

**Por quê:** quem limita a produção é a máquina. Pôr uma quinta pessoa numa
embaladora não a faz embalar mais rápido.

> **A regra vive em dois lugares e os dois têm de concordar (D48):** o `least`
> na view `production_summary` e o `Math.min` em **`src/lib/metas.ts`**.
>
> **A UI nova deve usar `src/lib/metas.ts`, não reescrever a conta.** Essa é a
> resposta à pergunta "reuso × duplicação" da seção 5 da nota anterior, pelo
> menos para a meta: se a tela calcular por conta própria, ela e o relatório vão
> divergir, e ninguém vai perceber até alguém comparar.

---

## 3. O nº de operadores agora aparece em todas as máquinas (D52)

Antes o campo só existia onde a meta dependia da lotação. Isso deixou de
coletar o indicador de presença do time (D12) nas outras vinte máquinas.

**Na UI nova:**

- o campo aparece em **todo** apontamento;
- onde a meta **não** depende da lotação, o texto de ajuda precisa dizer isso —
  senão alguém digita um número numa vertical esperando a meta mudar;
- **campo vazio manda `0`**, não "nada". É o que permite apagar: `nada` quer
  dizer "mantenha o que está lá", `0` quer dizer "apague".

| O que a tela manda | O que o banco faz |
|---|---|
| não manda o campo | mantém o valor anterior |
| `0` | apaga |
| um número | grava |

---

## 4. A base da meta tem onde ser editada (D53) — e a tela precisa dela

Esta é a novidade que **pede trabalho de UI**.

A aba **Metas vigentes** já edita o valor e já respeita a vigência ("vale a
partir de"). Falta **uma coluna ao lado da meta**, com três opções:

| Opção na tela | Valor | O que quer dizer |
|---|---|---|
| Por turno | `per_shift` | a lotação não muda nada |
| Conforme a lotação | `per_shift_prorated` | rateia pela gente que veio, com teto |
| Por pessoa | `per_operator` | multiplica pela gente que veio |

**Como salvar:** a mesma chamada de sempre, com um parâmetro a mais.

```ts
await data.targets.saveMetas(metas, vigenciaInicio, session, bases);
//                                                            ^^^^^
//  { "1": "per_shift_prorated", "7": "per_operator" }   máquina → base
```

Três regras que a tela precisa respeitar, e que o banco já garante:

1. **Máquina que não aparecer em `bases` mantém a base que tinha.** Não mandar é
   diferente de mandar `per_shift`. Mandar `per_shift` sem querer faria A Granél
   deixar de ser por pessoa — foi exatamente o bug que a 0022 tapou.
2. **Mudar a base cria um degrau novo**, com a data de vigência. O passado não é
   reescrito: apontamentos antigos guardam a base do dia deles.
3. **Salvar valor idêntico não cria degrau.** A função devolve quantos degraus
   gravou; zero significa "nada mudou", não "falhou".

**Quem pode:** gestor e administrador (`targets.manage`). Operador recebe erro.

---

## 5. Um aviso sobre o "Publicar metas" do simulador

O **Simulador de capacidade** calcula
`meta por turno = peças/min × tempo útil × eficiência`. Esse número é o **teto
de capacidade**, não a meta acordada (**D40**).

Comparando o que o simulador calcula com o que o gestor confirmou:

| Centro | Simulador | Meta acordada |
|---|---|---|
| Máquina de tomadas Composé | 9.188 | **12.500** |
| Máquina de plugue Slin | 4.675 | **6.500** |
| Bancadas nº 1 a 5 | 1.400 a 3.200 | **sem meta** (por demanda) |

**Se o botão "Publicar metas" gravar os valores calculados, ele sobrescreve as
metas que o gestor confirmou** e dá meta a centros que são por demanda.

As metas acordadas ficam entre **62% e 86%** da capacidade técnica, sem fator
único — não há fórmula que as reproduza. A capacidade serve de **alarme** ("essa
meta é fisicamente impossível"), não de fonte.

**Sugestão:** o simulador propor, e a tela de metas confirmar — com o número
calculado ao lado do acordado, para o gestor comparar e decidir. Nunca publicar
direto.

---

## 6. Um bug que já estava na UI antiga, e que a nova não deve repetir

`LoginPage` decidia o formato do login por `isSupabase`. No **modo de
demonstração** isso é falso, então a tela pedia "nome de usuário" e senha de 4
caracteres (do Apps Script) enquanto as contas fictícias são e-mails com senha
de 6. Não dava para entrar no modo mock.

**A pergunta certa é `usaAcessoPorEmail`** (`isSupabase || isMock`), que já
existia. Corrigido em `src/` em 30/09; a UI nova deve nascer com a pergunta
certa.

---

## 7. Duas coisas que o banco agora oferece e a UI pode aproveitar

**`data.targets.getMetasEm(data, session)`** — a meta e a base que valiam **numa
data**, não hoje. A tela de apontamento usa isso para que um turno lançado
atrasado grave a meta daquele dia. Qualquer tela que mostre meta de uma data
passada precisa do mesmo.

**`effective_target` em `production_summary`** — a meta já resolvida (base
aplicada, teto aplicado, lotação considerada). Some essa coluna filtrando
`counts_toward_target`; não multiplique nada.

---

## 8. Ordem sugerida, atualizada

Os itens 1 e 4 da nota anterior saíram (migrations aplicadas, tipos
regenerados). Fica:

1. **Fechar o contrato do retrabalho** (lacuna 6 da nota anterior) — continua
   aberto e continua sendo o que mais muda número na tela.
2. **Adaptador de leitura** usando `effective_target` e `src/lib/metas.ts`:
   Dashboard, Histórico, Relatórios.
3. **A coluna de base na aba Metas** (seção 4 desta nota) — o banco está pronto.
4. **Apontamento**, com o nº de operadores em todas as máquinas e o `0` que
   apaga.
5. Migrations das lacunas 1 e 2 (material e motivo de retrabalho) — **peça para
   a sessão do banco**, não escreva migration pela UI.
6. Tabela de OP e mensagens (lacuna 3).
7. Área de acesso na UI nova.

---

## 9. Contrato entre as duas sessões

- **`src/lib/repositories/`, `src/lib/metas.ts`, `AuthContext` e
  `database.types.ts` são do banco.** A UI consome; mudanças ali passam pela
  sessão do banco.
- **`prototype/` é da UI.** A sessão do banco não mexe.
- **Migration nenhuma sai da sessão de UI.** Precisou de coluna? Peça.
- **A regra de negócio mora no banco**, e o espelho em TypeScript existe só para
  a tela mostrar antes de salvar. Se divergirem, o banco está certo.
