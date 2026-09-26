// ─── Recuperação de senha: a chegada pelo link do e-mail ──────
// Quem esqueceu a senha recebe um e-mail do Supabase. O link do e-mail passa
// pelo servidor do Supabase e volta para este app já com a permissão de trocar
// a senha no endereço — de duas formas possíveis:
//
//   fluxo implícito  .../Dash-v2/?recuperar=1#access_token=...&type=recovery
//   fluxo PKCE       .../Dash-v2/?recuperar=1&code=...
//
// O `?recuperar=1` é nosso (vem do `redirectTo`, em repositories/supabase/auth.ts);
// o resto é o Supabase que acrescenta.
//
// Por que este arquivo existe, em vez de a tela de login só olhar o endereço:
//
// 1. O app usa HashRouter, ou seja, o hash do endereço É a rota. Um hash como
//    "#access_token=..." não é rota nenhuma, e o roteador abriria a página
//    "não encontrada". O token tem de sair do endereço antes de a tela montar.
// 2. Quem lê o token é o supabase-js (opção `detectSessionInUrl`), e ele só lê
//    no instante em que o cliente é criado. O cliente é criado sob demanda
//    (ver lib/supabase.ts), então é preciso criá-lo de propósito aqui, antes —
//    se a tela limpasse o endereço primeiro, o token se perderia e a
//    recuperação nunca funcionaria.
//
// Por isso `prepararRecuperacaoDeSenha()` roda em main.tsx, antes do render.
import { clearSession } from "@/lib/api";
import { isSupabase } from "@/lib/repositories";
import { getSupabase } from "@/lib/supabase";

const LINK_INVALIDO =
  "O link de recuperação expirou ou já foi usado. Peça um novo e-mail.";

/** O que o endereço trazia. */
export type PedidoDeRecuperacao =
  /** Veio token (ou código): dá para trocar a senha. */
  | { tipo: "sessao" }
  /** Veio pelo link, mas sem token válido — o motivo já em português. */
  | { tipo: "erro"; mensagem: string };

/** Em qual tela do cartão de login a visita deve começar. */
export type EstadoRecuperacao =
  | { tela: "novaSenha" }
  | { tela: "recuperar"; erro: string };

/**
 * Lê o endereço e diz o que ele traz. Função pura, sem efeito nenhum —
 * separada do resto justamente para poder ser testada.
 */
export function lerRecuperacaoDoEndereco(
  search: string,
  hash: string,
): PedidoDeRecuperacao | null {
  const busca = new URLSearchParams(search);
  // O hash pode ser a rota ("#/"), a rota com parâmetros ("#/?x=1") ou o token
  // solto do Supabase ("#access_token=..."). Tirar o "#" e a "/" da frente
  // deixa os três casos no mesmo formato de leitura.
  const doHash = new URLSearchParams(hash.replace(/^#/, "").replace(/^\/+/, "").replace(/^\?/, ""));

  const marcado = busca.has("recuperar");
  const ehRecuperacao = doHash.get("type") === "recovery";
  // Visita comum (abriu o app, entrou pelo dashboard): nada a fazer.
  if (!marcado && !ehRecuperacao) return null;

  // O Supabase avisa por aqui quando o próprio link já não vale — link velho,
  // link já usado, ou pedido feito duas vezes.
  const erro =
    doHash.get("error_description") ?? busca.get("error_description") ??
    doHash.get("error") ?? busca.get("error");
  if (erro) return { tipo: "erro", mensagem: mensagemDoErro(erro) };

  const temPermissao = doHash.has("access_token") || busca.has("code");
  return temPermissao ? { tipo: "sessao" } : { tipo: "erro", mensagem: LINK_INVALIDO };
}

function mensagemDoErro(erro: string): string {
  // Só o "expirou" ganha texto próprio: é o caso que acontece de verdade, e
  // saber que basta pedir outro e-mail resolve a dúvida de quem está na tela.
  if (/expired|otp_expired/i.test(erro)) {
    return "O link de recuperação expirou. Peça um novo e-mail.";
  }
  return LINK_INVALIDO;
}

let estado: EstadoRecuperacao | null = null;

/**
 * Se esta visita veio do link do e-mail, diz em que tela ela começa. Devolve
 * `null` numa visita comum. A tela de login chama isto ao montar.
 */
export function recuperacaoEmAndamento(): EstadoRecuperacao | null {
  return estado;
}

/**
 * Trata a chegada pelo link do e-mail: transforma o token do endereço na sessão
 * temporária de recuperação, apaga o token do endereço e do histórico do
 * navegador, e guarda em que tela o login deve abrir.
 *
 * Roda uma vez, em main.tsx, antes de a tela montar. Nunca falha para fora:
 * qualquer problema vira a tela de "pedir outro e-mail", com o motivo escrito.
 */
export async function prepararRecuperacaoDeSenha(): Promise<void> {
  // No modo Apps Script não existe recuperação por e-mail, e criar o cliente do
  // Supabase ali não faria sentido nenhum.
  if (!isSupabase) return;

  let pedido: PedidoDeRecuperacao | null = null;
  try {
    pedido = lerRecuperacaoDoEndereco(window.location.search, window.location.hash);
  } catch {
    return; // endereço estranho: segue como visita comum
  }
  if (!pedido) return;

  // Quem chega pelo link tem de cair na tela de senha nova. Se este navegador
  // tivesse um login guardado, o app abriria o dashboard e a tela nunca
  // apareceria — então o login antigo sai de cena.
  try { clearSession(); } catch { /* sem localStorage */ }

  if (pedido.tipo === "erro") {
    estado = { tela: "recuperar", erro: pedido.mensagem };
    normalizarEndereco();
    return;
  }

  try {
    // Criar o cliente é o que faz o supabase-js ler o token do endereço;
    // `getSession()` espera essa leitura terminar. Sessão em mãos = o link
    // valia, e a troca de senha pode acontecer.
    const { data } = await getSupabase().auth.getSession();
    estado = data.session
      ? { tela: "novaSenha" }
      : { tela: "recuperar", erro: LINK_INVALIDO };
  } catch {
    // Supabase sem configuração, ou sem rede: a tela pede outro e-mail.
    estado = { tela: "recuperar", erro: LINK_INVALIDO };
  }
  normalizarEndereco();
}

/**
 * Devolve ao endereço o formato que o HashRouter espera ("#/" = tela de login)
 * e tira dele o token — que não deve ficar visível na barra nem no histórico.
 */
function normalizarEndereco(): void {
  try {
    window.history.replaceState(null, "", `${window.location.pathname}#/`);
  } catch { /* navegador sem history: o endereço fica como está */ }
}
