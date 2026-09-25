// Junta o build (prototype/dist) num único HTML com CSS e JS embutidos,
// para abrir sem servidor ou publicar como página.
// Uso: npm run proto:html  →  prototype/dist/dash-producao-prototipo.html
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
let html = readFileSync(path.join(dist, "index.html"), "utf8");

html = html.replace(
  /<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/g,
  (_, file) => `<style>${readFileSync(path.join(dist, file), "utf8")}</style>`,
);
html = html.replace(
  /<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/g,
  (_, file) =>
    `<script type="module">${readFileSync(path.join(dist, file), "utf8").replace(/<\/script/g, "<\\/script")}</script>`,
);

const leftovers = html.replace(/<style>[\s\S]*?<\/style>|<script type="module">[\s\S]*?<\/script>/g, "");
if (/\.\/assets\//.test(leftovers)) throw new Error("Algum asset não foi embutido no HTML");

const out = path.join(dist, "dash-producao-prototipo.html");
writeFileSync(out, html);
console.log(`${out} (${Math.round(html.length / 1024)} KB)`);
