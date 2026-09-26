// Gera os PDFs dos cadernos a partir dos HTML desta pasta.
//
//   node docs/database/cadernos/gerar-pdfs.cjs            todos
//   node docs/database/cadernos/gerar-pdfs.cjs 03 05      só esses
//
// Requer o Chromium do Playwright, que já é dependência do projeto (npm install).
const path = require('path');
const fs = require('fs');
const url = require('url');
const { chromium } = require('@playwright/test');

const pasta = __dirname;
const filtros = process.argv.slice(2);

const arquivos = fs
  .readdirSync(pasta)
  .filter((f) => f.endsWith('.html'))
  .filter((f) => filtros.length === 0 || filtros.some((p) => f.startsWith(p)))
  .sort();

if (arquivos.length === 0) {
  console.error('Nenhum caderno encontrado para', filtros.join(', ') || '(todos)');
  process.exit(1);
}

(async () => {
  const navegador = await chromium.launch();
  let problemas = 0;

  for (const arquivo of arquivos) {
    const pagina = await navegador.newPage();
    const erros = [];
    pagina.on('pageerror', (e) => erros.push(e.message));

    await pagina.goto(url.pathToFileURL(path.join(pasta, arquivo)).href, { waitUntil: 'networkidle' });
    await pagina.waitForTimeout(600); // deixa a fonte web terminar de carregar

    const titulo = await pagina.title();
    const saida = path.join(pasta, arquivo.replace(/\.html$/, '.pdf'));

    await pagina.pdf({
      path: saida,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate:
        '<div style="width:100%;font:8pt system-ui;color:#7C8B9A;padding:0 14mm;' +
        'display:flex;justify-content:space-between">' +
        '<span>' + titulo + '</span>' +
        '<span><span class="pageNumber"></span>/<span class="totalPages"></span></span></div>',
    });

    const kb = Math.round(fs.statSync(saida).size / 1024);
    if (erros.length) problemas += erros.length;
    console.log(`${path.basename(saida).padEnd(34)} ${String(kb).padStart(4)} KB` + (erros.length ? `  ERROS: ${erros.join(' | ')}` : ''));
    await pagina.close();
  }

  await navegador.close();
  process.exit(problemas ? 1 : 0);
})().catch((e) => {
  console.error('FALHOU:', e.message);
  process.exit(1);
});
