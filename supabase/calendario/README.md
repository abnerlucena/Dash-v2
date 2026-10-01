# Calendário — feriados

Sem feriado cadastrado, **todo feriado vira um dia de produção zero** e derruba
o indicador do mês.

## Feriados nacionais, da BrasilAPI

```bash
node supabase/calendario/feriados.cjs 2026 2027
```

Gera `feriados.sql`. **Não se conecta ao banco** — quem roda o SQL decide onde,
como o extrator da importação. Rodar o SQL duas vezes não duplica: o índice
`calendar_events_brasil_api_date_key` é único por data entre os eventos de
origem `brasil_api`.

O arquivo gerado fica versionado junto, para quem for carregar não precisar de
internet.

## O que a API não traz

| Falta | `scope` para usar |
|---|---|
| Feriados de Santa Catarina | `state` |
| Feriados de Itajaí | `municipal` |
| Paradas da fábrica, férias coletivas, pontes | `company` |

A BrasilAPI responde só os nacionais. O resto entra à mão.

## Feriado não é dia excluído

Só `event_type = 'excluded_day'` mexe no cálculo da `production_summary`. Um
`holiday` é informativo — e **a fábrica trabalha em alguns feriados nacionais**
(07/09/2026 teve 31 apontamentos, um dia cheio).

Quando a D36 for construída, a regra tem de ser "é feriado **e** não houve
produção ⇒ não é dia perdido". A regra ingênua apagaria produção real.
