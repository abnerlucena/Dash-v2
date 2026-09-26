// ═══════════════════════════════════════════════════════════════════════════
// Extrator do histórico da planilha → área de preparo
//
//   node supabase/import/extrair.cjs <planilha.xlsx> [saida.sql]
//
// PASSO 2 de 4 da importação (D35). Lê a planilha e escreve um arquivo SQL
// que enche a área de preparo. NÃO se conecta ao banco: o repositório é
// público e não guarda credencial nenhuma. Quem roda o SQL decide onde.
//
// É reproduzível: rodar de novo na mesma planilha dá exatamente o mesmo
// arquivo, com o mesmo id de lote. Carregar duas vezes é impossível — o id do
// lote é fixo e a chave (lote, aba, célula) recusa a segunda.
//
// O que ele NÃO faz: não decide nada. Toda decisão está em mapa.cjs, que é a
// tradução do relatório revisado pelo gestor.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { CENTROS, TURNOS, ABAS_HORA_EXTRA, CASOS, RETRABALHO, ZERO } = require('./mapa.cjs');

let ExcelJS;
try {
  ExcelJS = require('exceljs');
} catch {
  console.error('Falta a biblioteca exceljs. Rode:  npm install --no-save exceljs');
  process.exit(2);
}

const arquivo = process.argv[2];
const saida = process.argv[3] || path.join(__dirname, 'preparo.sql');
if (!arquivo) {
  console.error('Uso: node supabase/import/extrair.cjs <planilha.xlsx> [saida.sql]');
  process.exit(2);
}

// ─── Leitura crua de uma célula ─────────────────────────────────────────────
// Devolve o valor guardado. "undefined" significa fórmula sem resultado salvo
// — a planilha precisaria ser aberta no Excel para calcular, e o extrator não
// inventa número: ele avisa.
const cru = (c) => {
  const x = c.value;
  if (x == null) return null;
  if (typeof x === 'object' && !(x instanceof Date)) {
    if ('result' in x) return x.result ?? null;
    if (x.richText) return x.richText.map((t) => t.text).join('');
    if ('formula' in x || 'sharedFormula' in x) return undefined;
    if (x.error) return '#' + x.error;
    return null;
  }
  return x;
};
const texto = (c) => {
  const v = cru(c);
  return v == null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
};
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();

// Os cabeçalhos da planilha não batem com os nomes usados no mapa; esta
// tabela faz a ponte. Cada linha veio de conferir a coluna na planilha.
const CABECALHOS = [
  [/^1 HORIZONTAL$/, 'HORIZONTAL 1'],
  [/^2 HORIZONTAL$/, 'HORIZONTAL 2'],
  [/^1 VERTICAL PLACAS ?\/ ?SUP\.?$/, 'VERTICAL PLACAS / SUP. 1'],
  [/^2 VERTICAL PLACAS ?\/ ?SUP\.?$/, 'VERTICAL PLACAS / SUP. 2'],
  [/^1 VERTICAL MODULOS$/, 'VERTICAL MÓDULOS 1'],
  [/^2 VERTICAL MODULOS$/, 'VERTICAL MÓDULOS 2'],
  [/^A GRANEL$/, 'A GRANEL'],
  [/^(MAQUINA DE INTERRUPTOR|INTERRUPTOR MAQUINA)$/, 'MÁQUINA INTERRUPTOR'],
  [/^TESTE INTERRUPTORES$/, 'TESTE INTERRUPTORES'],
  [/^INTERRUPTOR MANUAL( NOVO)?$/, 'MANUAL INTERRUPTOR'],
  [/^MONTAGEM DIVERSOS$/, 'MONTAGEM DIVERSOS'],
  [/^MONTAGEM PLACA REFINATTO$/, 'MONTAGEM PLACA REFINATTO'],
  [/^KIT 1 PARAFUSO$/, 'KIT 1 PARAFUSO'],
  [/^KIT 2 PARAFUSO$/, 'KIT 2 PARAFUSO'],
  [/^MONTAGEM TOMADAS MANUAL$/, 'MONTAGEM TOMADAS MANUAL'],
  [/^MAQUINA DE TOMADAS AUTOMATICA$/, 'MÁQUINA DE TOMADAS AUTOMÁTICA'],
  [/^INSERCAO DOS CONTATOS INTERRUPTOR$/, 'INSERÇÃO DOS CONTATOS INTERRUPTOR'],
  [/^FECHAMENTO TECLA INTERRUPTORES$/, 'FECHAMENTO TECLA INTERRUPTORES'],
  [/^2 CONJUNTOS$/, '2 CONJUNTOS'],
  [/^1 CONJUNTOS$/, '1 CONJUNTOS'],
  [/^REBITAGEM PINOS$/, 'REBITAGEM PINOS'],
  [/^MAQUINA DE PLUG AUTOMATICA$/, 'MÁQUINA DE PLUG AUTOMÁTICA'],
  [/^PRENSA TOX$/, 'PRENSA TOX'],
  [/^RETRABALHO GERAL$/, 'RETRABALHO GERAL'],
];
const nomeDaColuna = (h) => {
  const n = norm(h);
  for (const [re, nome] of CABECALHOS) if (re.test(n)) return nome;
  return null;
};

const casoDe = (aba, celula) => CASOS.find((c) => c.aba === aba && c.celula === celula);
const retrabalhoDe = (aba, celula) => RETRABALHO.find((c) => c.aba === aba && c.celula === celula);

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(arquivo);

  const linhas = [];
  const avisos = [];
  const naoReconhecidos = new Set();
  let semResultado = 0;

  for (const ws of wb.worksheets) {
    const aba = ws.name.trim();
    if (/grafico/i.test(aba)) continue;

    // Cabeçalhos das máquinas ficam na linha 5, a partir da coluna C.
    const colunas = [];
    for (let c = 3; c <= ws.columnCount; c++) {
      const h = texto(ws.getRow(5).getCell(c)).replace(/\s+/g, ' ').trim();
      if (!h) continue;
      const n = norm(h);
      // Colunas de apoio da planilha, que não são máquina.
      if (n.includes('META') || ['TOTAL', 'TURNO', 'STATUS', 'FALTA DE MATERIAL', 'FALTAS DE OPERADORES'].includes(n)
          || n.startsWith('EMBALADOS')) continue;
      const nome = nomeDaColuna(h);
      if (!nome) { naoReconhecidos.add(`${aba}!${ws.getColumn(c).letter}: ${h}`); continue; }
      colunas.push({ c, letra: ws.getColumn(c).letter, nome });
    }

    // A data pode estar só na linha do T1 (abril faz isso); repete para baixo.
    let ultimaData = null;
    ws.eachRow({ includeEmpty: false }, (row, r) => {
      if (r < 6) return;
      const dv = cru(row.getCell(1));
      let data = dv instanceof Date ? dv.toISOString().slice(0, 10) : null;
      const rotulo = texto(row.getCell(2)).trim().toUpperCase();
      if (!data && rotulo && ultimaData && !/^(META|M[EÉ]DIA|TOTAL)/i.test(rotulo)) data = ultimaData;
      if (data) ultimaData = data;
      if (!data) return;

      const t = ABAS_HORA_EXTRA[aba] || TURNOS[rotulo];
      if (!t) {
        // Linha sem rótulo de turno E sem número nenhum é sobra da planilha
        // (um dia em que o T2 ficou em branco, por exemplo). Só avisa quando
        // há dado de verdade, senão o relatório vira ruído.
        const temDado = colunas.some((col) => {
          const v = cru(row.getCell(col.c));
          return v !== null && v !== undefined && String(v).trim() !== '';
        });
        if (temDado) avisos.push(`${aba} linha ${r}: tem dado mas o rótulo de turno não foi reconhecido ("${rotulo}")`);
        return;
      }

      for (const col of colunas) {
        const celula = `${col.letra}${r}`;
        const v = cru(row.getCell(col.c));
        if (v === undefined) { semResultado++; continue; }

        const base = { aba, celula, coluna: col.nome, cru: v === null ? '' : String(v) };

        // Retrabalho e observações: caso a caso, revisados pelo gestor.
        const rt = retrabalhoDe(aba, celula);
        if (rt) {
          linhas.push({ ...base, kind: rt.vira, centro: rt.centro, data, turno: t.turno,
            modo: rt.vira === 'note' ? null : t.modo, qtd: rt.quantidade ?? null, nota: rt.nota });
          continue;
        }
        if (col.nome === 'RETRABALHO GERAL') {
          if (v !== null && String(v).trim() !== '' && v !== 0) {
            avisos.push(`${aba}!${celula}: retrabalho não previsto no mapa — "${String(v).slice(0, 40)}"`);
          }
          continue;
        }

        const destino = CENTROS[col.nome];
        if (!destino) { naoReconhecidos.add(`${aba}!${celula}: ${col.nome} sem destino no mapa`); continue; }

        // Texto no lugar de número: os revisados viram parada; o resto é
        // descartado COM o texto guardado, para ninguém perder informação.
        const caso = casoDe(aba, celula);
        if (caso) {
          if (caso.vira === 'downtime') {
            linhas.push({ ...base, kind: 'downtime', centro: destino.centro, data, turno: t.turno,
              modo: null, qtd: null, nota: caso.motivo });
          } else {
            linhas.push({ ...base, kind: 'production', centro: destino.centro, data, turno: t.turno,
              modo: t.modo, qtd: caso.quantidade, nota: caso.nota });
          }
          continue;
        }

        if (v === null || String(v).trim() === '') continue;   // célula vazia não é dado

        if (typeof v !== 'number') {
          linhas.push({ ...base, kind: 'discard', centro: destino.centro, data, turno: t.turno,
            descarte: `texto no lugar da quantidade, não revisado: "${String(v).slice(0, 60)}"` });
          continue;
        }

        if (v > 0) {
          linhas.push({ ...base, kind: 'production', centro: destino.centro, data, turno: t.turno,
            modo: t.modo, qtd: v, nota: null });
        } else {
          const antes = !destino.desde || data < destino.desde;
          linhas.push({ ...base, kind: 'discard', centro: destino.centro, data, turno: t.turno,
            descarte: antes ? ZERO.antes : ZERO.depois });
        }
      }
    });
  }

  // ─── Id do lote: derivado do arquivo, para ser sempre o mesmo ─────────────
  const digest = crypto.createHash('sha256')
    .update(path.basename(arquivo) + '|' + fs.statSync(arquivo).size)
    .digest('hex');
  const lote = [digest.slice(0, 8), digest.slice(8, 12), '4' + digest.slice(13, 16),
    '8' + digest.slice(17, 20), digest.slice(20, 32)].join('-');

  // ─── Escreve o SQL ────────────────────────────────────────────────────────
  const esc = (s) => (s === null || s === undefined ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
  const num = (n) => (n === null || n === undefined ? 'null' : String(n));
  const partes = [];
  partes.push(`-- Gerado por supabase/import/extrair.cjs a partir de ${path.basename(arquivo)}`);
  partes.push(`-- ${linhas.length} linhas. Rodar dentro de uma transação; conferir ANTES de carregar.`);
  partes.push('');
  partes.push('begin;');
  partes.push(`insert into public.import_batches (id, source_file, description)`);
  partes.push(`values ('${lote}', ${esc(path.basename(arquivo))}, 'Histórico 20/12/2025 a 21/09/2026');`);
  partes.push('');

  for (let i = 0; i < linhas.length; i += 500) {
    const bloco = linhas.slice(i, i + 500);
    partes.push('insert into public.import_rows (batch_id, source_sheet, source_cell, raw_machine, raw_value,');
    partes.push('  kind, machine_id, production_date, shift_id, work_mode, quantity, notes, discard_reason)');
    partes.push(`select '${lote}', v.aba, v.celula, v.coluna, v.cru, v.kind, m.id, v.data::date,`);
    partes.push('       v.turno::smallint, v.modo, v.qtd, v.nota, v.descarte');
    partes.push('  from (values');
    partes.push(bloco.map((l) => '    (' + [
      esc(l.aba), esc(l.celula), esc(l.coluna), esc(l.cru), esc(l.kind), esc(l.centro),
      esc(l.data), num(l.turno), esc(l.modo ?? null), num(l.qtd ?? null),
      esc(l.nota ?? null), esc(l.descarte ?? null),
    ].join(', ') + ')').join(',\n'));
    partes.push('  ) as v(aba, celula, coluna, cru, kind, centro, data, turno, modo, qtd, nota, descarte)');
    partes.push('  left join public.machines m on lower(m.name) = lower(v.centro);');
    partes.push('');
  }
  partes.push('-- Confira antes de confirmar. Para desistir: rollback;');
  partes.push('commit;');
  fs.writeFileSync(saida, partes.join('\n') + '\n');

  // ─── Relatório para quem rodou ────────────────────────────────────────────
  const por = {};
  for (const l of linhas) por[l.kind] = (por[l.kind] || 0) + 1;
  const pecas = linhas.filter((l) => l.kind === 'production').reduce((s, l) => s + (l.qtd || 0), 0);
  console.log(`Lote ${lote}`);
  console.log(`Arquivo gerado: ${saida}  (${linhas.length} linhas)`);
  console.log('');
  for (const [k, v] of Object.entries(por).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(12)} ${String(v).padStart(6)}`);
  }
  console.log('');
  console.log(`  total de peças em apontamentos: ${pecas.toLocaleString('pt-BR')}`);
  if (semResultado) console.log(`\n  ${semResultado} células com fórmula sem resultado salvo (ignoradas, nada foi inventado)`);
  if (naoReconhecidos.size) {
    console.log(`\n  ${naoReconhecidos.size} cabeçalhos sem destino no mapa:`);
    for (const x of [...naoReconhecidos].slice(0, 10)) console.log(`    ${x}`);
  }
  if (avisos.length) {
    console.log(`\n  ${avisos.length} avisos:`);
    for (const x of avisos.slice(0, 10)) console.log(`    ${x}`);
  }
})().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
