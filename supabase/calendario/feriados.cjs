// ═══════════════════════════════════════════════════════════════════════════
// Feriados nacionais da BrasilAPI → SQL para o calendário
//
//   node supabase/calendario/feriados.cjs 2026 2027 [saida.sql]
//
// Busca os feriados NACIONAIS de cada ano e escreve um arquivo SQL. Não se
// conecta ao banco: quem roda o SQL decide onde, como no extrator da
// importação.
//
// POR QUE ISTO EXISTE: sem feriado cadastrado, todo feriado vira um dia de
// produção zero e derruba o indicador do mês. Digitar 28 datas à mão é
// trabalho que uma API pública faz melhor e sem errar a data da Páscoa.
//
// O QUE ELE NÃO TRAZ, e ninguém deve supor que traz:
//   • feriados ESTADUAIS (Santa Catarina)
//   • feriados MUNICIPAIS (Itajaí)
//   • paradas da fábrica, férias coletivas e pontes
// A BrasilAPI só responde os nacionais. O resto entra à mão, com
// scope 'state', 'municipal' ou 'company'.
//
// É reproduzível e idempotente: o banco tem um índice único por data entre os
// eventos de origem brasil_api, então rodar o SQL duas vezes não duplica nada.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const anos = args.filter((a) => /^[0-9]{4}$/.test(a));
const saida = args.find((a) => a.endsWith('.sql')) || path.join(__dirname, 'feriados.sql');
if (!anos.length) {
  console.error('Uso: node supabase/calendario/feriados.cjs 2026 2027 [saida.sql]');
  process.exit(2);
}

const esc = (s) => `'${String(s).replace(/'/g, "''")}'`;
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
// Date com 'T12:00' para o fuso não empurrar o dia para trás.
const diaDaSemana = (iso) => DIAS[new Date(iso + 'T12:00:00').getDay()];

(async () => {
  const linhas = [];
  for (const ano of anos) {
    const url = `https://brasilapi.com.br/api/feriados/v1/${ano}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`BrasilAPI respondeu ${resp.status} para ${ano}.`);
    const lista = await resp.json();
    if (!Array.isArray(lista) || !lista.length) throw new Error(`BrasilAPI não devolveu feriados para ${ano}.`);
    for (const f of lista) {
      if (f.type !== 'national') continue;   // a API só manda nacionais, mas não custa conferir
      linhas.push({ data: f.date, nome: f.name, dia: diaDaSemana(f.date) });
    }
  }
  linhas.sort((a, b) => a.data.localeCompare(b.data));

  const partes = [
    `-- Feriados nacionais ${anos.join(', ')}, da BrasilAPI.`,
    `-- Gerado por supabase/calendario/feriados.cjs em ${new Date().toISOString().slice(0, 10)}.`,
    '--',
    '-- NÃO inclui feriados estaduais (SC), municipais (Itajaí), paradas da',
    '-- fábrica nem férias coletivas. Esses entram à mão.',
    '--',
    '-- Idempotente: o índice calendar_events_brasil_api_date_key impede duplicar.',
    '',
    'begin;',
    '',
    'insert into public.calendar_events (event_date, description, event_type, scope, source)',
    'values',
    linhas.map((l) => `  (${esc(l.data)}::date, ${esc(l.nome)}, 'holiday', 'national', 'brasil_api')`).join(',\n'),
    'on conflict do nothing;',
    '',
    '-- Confira antes de confirmar. Para desistir: rollback;',
    'commit;',
  ];
  fs.writeFileSync(saida, partes.join('\n') + '\n');

  console.log(`Arquivo gerado: ${saida}  (${linhas.length} feriados)`);
  const fds = linhas.filter((l) => l.dia === 'sábado' || l.dia === 'domingo');
  for (const l of linhas) console.log(`  ${l.data}  ${l.dia.padEnd(8)}  ${l.nome}`);
  if (fds.length) {
    console.log(`\n  ${fds.length} caem em fim de semana — o sábado importa (há hora extra aos sábados),`);
    console.log('  o domingo é inofensivo: não havia produção para contar mesmo.');
  }
  console.log('\n  FALTAM, e a API não tem: feriados de SC, de Itajaí, paradas e férias coletivas.');
})().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
