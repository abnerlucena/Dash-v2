// Hook PostToolUse (Write|Edit): ao alterar uma migration do banco, lembra o Claude
// de atualizar a documentação em docs/database/ no mesmo commit.
let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  let filePath = "";
  try {
    const payload = JSON.parse(input);
    filePath = (payload.tool_input && payload.tool_input.file_path) || "";
  } catch {
    return;
  }
  if (!/supabase[\\/]migrations[\\/]/.test(filePath)) return;

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext:
        "Uma migration do banco foi alterada (" + filePath + "). Antes de concluir, atualize a documentação em docs/database/ conforme as normas de docs/database/README.md: " +
        "CHANGELOG.md (sempre: nova entrada com versão, data, migration e decisões), " +
        "02-referencia-tecnica.md (se mudou tabela, coluna, tipo, regra, índice, trigger, função ou RLS), " +
        "01-visao-geral.md (se o usuário/gestor perceberia a mudança) e " +
        "03-decisoes.md (se houve escolha entre alternativas). Suba a versão do schema.",
    },
  }));
});
