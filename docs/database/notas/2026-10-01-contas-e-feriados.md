# Contas e feriados do projeto oficial

> Data: 01/10/2026 · Escrito pela sessão do **banco**
> Complementa o [plano de virada](2026-10-01-plano-de-virada.md), §§ 2 e 4.

O gestor passou os dados das duas primeiras pessoas e mandou pegar os feriados
de uma API pública. Esta nota diz o que já está feito, o que **não dá** para eu
fazer, e os passos exatos.

---

## 1. Feriados: 28 carregados, e o schema já esperava por isso

```bash
node supabase/calendario/feriados.cjs 2026 2027
```

Busca os feriados nacionais na BrasilAPI e escreve `feriados.sql`. **Não se
conecta ao banco** — quem roda o SQL decide onde, como o extrator da importação.

A tabela `calendar_events` já aceitava `source = 'brasil_api'` e
`scope in ('national','state','municipal','company')`, e já tinha o índice
`calendar_events_brasil_api_date_key` (único por data entre os de origem
brasil_api). Alguém desenhou exatamente para esta hora, antes de ela chegar.

**Idempotente, conferido:** primeira rodada insere 28, segunda insere 0.

### O que a API NÃO traz, e ninguém deve supor que traz

| Falta | Quem sabe |
|---|---|
| Feriados **estaduais** (Santa Catarina) | o gestor |
| Feriados **municipais** (Itajaí) | o gestor |
| Paradas da fábrica, férias coletivas, pontes | o gestor |

A BrasilAPI responde só os nacionais. O resto entra à mão, com `scope` `state`,
`municipal` ou `company`. **Enquanto não entrarem, cada um deles é um dia de
produção zero no indicador.**

### A fábrica trabalha em alguns feriados nacionais

Cruzando os 28 com o que já está no banco:

| Dia | Feriado | Apontamentos |
|---|---|---|
| **07/09/2026** | Independência | **31 — dia cheio** |
| 21/04/2026 | Tiradentes | 8 |
| 16 e 17/02/2026 | Carnaval | 5 e 4 |
| os demais até 30/09 | — | 0 |

**Isso não é problema hoje:** só `event_type = 'excluded_day'` mexe no cálculo
da `production_summary`. Um `holiday` é informativo, e os 31 apontamentos do
07/09 continuam contando normalmente.

**Mas é um aviso para quando a D36 for construída** (atingimento ×
disponibilidade): a regra **não** pode ser "é feriado ⇒ ignore o dia". Tem de
ser "é feriado **e** não houve produção ⇒ não é dia perdido". O dado acima prova
que a primeira regra apagaria produção real.

---

## 2. Contas: o que eu não posso fazer

**Não consigo criar conta de ninguém.** Criar usuário exige a `service_role
key`, que nunca entra no navegador nem no repositório (D19). Por isso o desenho
é: **a pessoa se cadastra, o gestor aprova** (D20).

Então os dois precisam se cadastrar pelo app. Não há atalho, e é de propósito.

### Os dados recebidos

| Nome | E-mail | Crachá | Perfil |
|---|---|---|---|
| Abner Lucena | `abnerlucena902@gmail.com` | **11145** | **Admin** |
| Guilherme Gonçalves | `guioliveiragui349@gmail.com` | **11824** | **Distribuidor** |

### Por que Admin e não Gestor

O gestor pediu "Adm". Os dois perfis têm acesso total, e a diferença é **uma
permissão só**:

| Perfil | Permissões | Diferença |
|---|---|---|
| Gestor | 19 | — |
| **Admin** | **20** | só ele tem **`import.manage`** |

`import.manage` é criar, carregar e reverter lotes de importação — exatamente o
que a virada precisa. Então Admin é a escolha certa, e não só porque foi a
pedida.

**Um detalhe que confunde:** o perfil Admin é descrito como *"conta
compartilhada com identificação por crachá"*, pensando num terminal de chão de
fábrica. Mas `account_type` e `role_id` são colunas **independentes**: a conta
do gestor é `personal` com perfil `admin`, e não pede crachá a cada sessão. A
conta compartilhada de verdade, se existir um dia, é outra.

---

## 3. O conflito do crachá 11145

No banco de testes havia **duas** contas do Abner, e o crachá estava na errada:

| E-mail | Crachá | Era |
|---|---|---|
| `abnerf@weg.net` | **11145** | Operador — sobra de teste |
| `abnerlucena902@gmail.com` | 11146 | Gestor |

`badge_number` é único, então a conta do gmail tinha nascido com 11146 por o
11145 já estar ocupado.

**Resolvido no banco de testes** (nenhuma das duas tinha apontamento, meta ou
evento): a conta antiga foi **bloqueada** e o crachá dela estacionado como
`11145-antigo`, e a do gmail ficou com `11145`, nome `Abner Lucena` e perfil
`Admin` com as 20 permissões.

Bloquear em vez de apagar: é reversível, e mexer em `auth.users` por SQL é
cirurgia no schema que o Supabase administra.

**No projeto oficial isso não vai acontecer**, porque ele nasce vazio.

---

## 4. Passo a passo, no projeto oficial

```
1. Abner se cadastra no app          → nasce 'pending'
      gmail · senha · crachá 11145

2. No SQL Editor do Supabase:
      select public.bootstrap_admin('abnerlucena902@gmail.com', 'admin');
                                                                ^^^^^^^
      sem o segundo argumento vira 'manager', que não tem import.manage

3. Guilherme se cadastra             → nasce 'pending'
      gmail · senha · crachá 11824

4. Abner aprova Guilherme como Distribuidor, PELA TELA
```

O passo 4 é de propósito pela tela, não por SQL: é o ensaio do fluxo que a
fábrica inteira vai usar depois.

**`bootstrap_admin` exige que a pessoa JÁ tenha se cadastrado** — ela procura o
e-mail em `auth.users` e levanta erro se não achar. Não dá para adiantar.

E ela só resolve o problema do ovo e da galinha: do segundo usuário em diante,
quem aprova é o Admin, pela tela.

---

## 5. O que ainda falta para a virada

- O **projeto oficial** não existe. Criar é pelo painel do Supabase, com a conta
  do gestor — eu não tenho esse acesso daqui.
- Feriados **estaduais, municipais e paradas** da fábrica (§ 1).
- **Backup/PITR** ligado, e um ensaio de restauração antes de abrir.
- **Lotação padrão de A Granél**, hoje cadastrada como 1 — segue sem confirmação.
- **SMTP próprio** só quando a fábrica inteira entrar; para duas pessoas o
  remetente embutido basta.
