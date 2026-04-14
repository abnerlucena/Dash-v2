// ═══════════════════════════════════════════════════════════════
// DASHBOARD DE PRODUÇÃO — Google Apps Script (VERSÃO SEGURA)
// CORREÇÕES DE SEGURANÇA IMPLEMENTADAS
// ═══════════════════════════════════════════════════════════════

const PROD_SHEET = "Producao";
const USER_SHEET = "Usuarios";
const SESSION_SHEET = "Sessions";
const AUDIT_SHEET = "AuditLogs";
const INVITE_CODES_SHEET = "InviteCodes";
const METAS_SHEET = "Metas";
const MACHINES_SHEET = "Maquinas";
const MACHINES_HEADERS = ["id", "name", "hasMeta", "defaultMeta", "status", "createdBy", "createdAt"];
const HOLIDAYS_SHEET = "Feriados";
const HOLIDAYS_HEADERS = ["id", "date", "label", "type", "createdBy", "createdAt"];
const ADMIN_USER = "Admin";

// Configurações de Segurança
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutos
const SESSION_DURATION = 365 * 24 * 60 * 60 * 1000; // 1 ano — sessão longa, logout apenas manual
const VALID_TURNOS = ["TURNO 1", "TURNO 2", "TURNO 3"];

const PROD_HEADERS = [
  "id", "date", "turno", "machineId", "machineName",
  "meta", "producao", "savedBy", "savedAt", "editUser", "editTime", "obs"
];

const USER_HEADERS = ["nome", "senhaHash", "role", "criadoEm", "status", "loginAttempts", "lockedUntil"];
const SESSION_HEADERS = ["token", "nome", "role", "createdAt", "expiresAt"];
const AUDIT_HEADERS = ["timestamp", "user", "action", "details", "ip"];
const INVITE_HEADERS = ["code", "createdBy", "createdAt", "usedBy", "usedAt", "status"];
const METAS_HEADERS = ["machineId", "machineName", "meta", "updatedBy", "updatedAt", "vigenciaInicio"];

// Definição canônica das máquinas — única fonte de verdade no backend
// O frontend busca via getMachines; MACHINES_DEFAULT no app.js é apenas fallback
const MACHINE_DEFS = [
  {id:1,  name:"HORIZONTAL 1",                       hasMeta:true,  defaultMeta:500},
  {id:2,  name:"HORIZONTAL 2",                       hasMeta:true,  defaultMeta:500},
  {id:3,  name:"VERTICAL PLACAS / SUP. 1",           hasMeta:true,  defaultMeta:400},
  {id:4,  name:"VERTICAL PLACAS / SUP. 2",           hasMeta:true,  defaultMeta:400},
  {id:5,  name:"VERTICAL MÓDULOS 1",                 hasMeta:true,  defaultMeta:350},
  {id:6,  name:"VERTICAL MÓDULOS 2",                 hasMeta:true,  defaultMeta:350},
  {id:7,  name:"A GRANEL",                           hasMeta:true,  defaultMeta:600},
  {id:8,  name:"MÁQUINA INTERRUPTOR",                hasMeta:true,  defaultMeta:300},
  {id:9,  name:"TESTE INTERRUPTORES",                hasMeta:true,  defaultMeta:250},
  {id:10, name:"MANUAL INTERRUPTOR",                 hasMeta:true,  defaultMeta:200},
  {id:11, name:"MONTAGEM DIVERSOS",                  hasMeta:true,  defaultMeta:150},
  {id:12, name:"MONTAGEM PLACA REFINATTO",           hasMeta:true,  defaultMeta:180},
  {id:13, name:"KIT 1 PARAFUSO",                     hasMeta:true,  defaultMeta:220},
  {id:14, name:"KIT 2 PARAFUSO",                     hasMeta:true,  defaultMeta:220},
  {id:15, name:"MONTAGEM TOMADAS MANUAL",            hasMeta:true,  defaultMeta:160},
  {id:16, name:"MÁQUINA DE TOMADAS AUTOMÁTICA",      hasMeta:true,  defaultMeta:500},
  {id:17, name:"INSERÇÃO DOS CONTATOS INTERRUPTOR",  hasMeta:true, defaultMeta:0},
  {id:18, name:"FECHAMENTO TECLA INTERRUPTORES",     hasMeta:true, defaultMeta:0},
  {id:19, name:"RETRABALHO GERAL",                   hasMeta:true, defaultMeta:0}
];
// Derivado de MACHINE_DEFS — não precisa ser mantido manualmente
const DEFAULT_METAS = MACHINE_DEFS.map(m => ({id: m.id, name: m.name, meta: m.defaultMeta}));

// ══════════════════════════════════════════════════════════════
// 🔧 FUNÇÕES AUXILIARES - MANAGEMENT DE SENHAS
// ══════════════════════════════════════════════════════════════

/**
 * 🔑 VER SENHA DO ADMIN
 * Esta função mostra informações do Admin e GERA UMA NOVA SENHA
 * Use quando: Precisar fazer login pela primeira vez ou resetar senha
 */
function verSenhaAdmin() {
  Logger.log("===========================================");
  Logger.log("🔑 GERENCIAMENTO DE SENHA DO ADMIN");
  Logger.log("===========================================");
  
  try {
    const sheet = getUserSheet();
    const data = sheet.getDataRange().getValues();
    
    // Verificar se Admin existe (linha 2)
    if(data.length < 2) {
      Logger.log("❌ Erro: Planilha de usuários vazia");
      Logger.log("Execute a função doGet() primeiro para criar as planilhas");
      return;
    }
    
    const adminNome = data[1][0];
    const adminHash = data[1][1];
    const adminRole = data[1][2];
    
    Logger.log("📊 DADOS ATUAIS DO ADMIN:");
    Logger.log("   Nome: " + adminNome);
    Logger.log("   Role: " + adminRole);
    Logger.log("   Senha Hash: " + adminHash.substring(0, 20) + "...");
    Logger.log("");
    Logger.log("⚠️  A senha atual está CRIPTOGRAFADA (hash)");
    Logger.log("⚠️  Não é possível ver a senha original");
    Logger.log("");
    Logger.log("─────────────────────────────────────────");
    Logger.log("🔄 GERANDO NOVA SENHA TEMPORÁRIA...");
    Logger.log("─────────────────────────────────────────");
    
    // Gerar nova senha temporária
    const novaSenha = "Admin@" + Math.random().toString(36).substr(2, 8).toUpperCase();
    const novoHash = hashPassword(novaSenha);
    
    // Atualizar no Sheets
    sheet.getRange(2, 2).setValue(novoHash);
    
    Logger.log("");
    Logger.log("✅ SENHA ATUALIZADA COM SUCESSO!");
    Logger.log("");
    Logger.log("╔═══════════════════════════════════════╗");
    Logger.log("║   CREDENCIAIS DE LOGIN                ║");
    Logger.log("╠═══════════════════════════════════════╣");
    Logger.log("║   Usuário: Admin                      ║");
    Logger.log("║   Senha:   " + novaSenha + "              ║");
    Logger.log("╚═══════════════════════════════════════╝");
    Logger.log("");
    Logger.log("⚠️  IMPORTANTE:");
    Logger.log("   1. COPIE ESTA SENHA AGORA!");
    Logger.log("   2. Faça login no sistema");
    Logger.log("   3. Vá em: Admin → Redefinir Senha");
    Logger.log("   4. TROQUE para uma senha forte");
    Logger.log("");
    Logger.log("===========================================");
    
  } catch(error) {
    Logger.log("❌ ERRO: " + error.message);
    Logger.log("Stack: " + error.stack);
  }
}

// REMOVIDO: definirSenhaAdmin() duplicada (existia outra definição abaixo — erro de sintaxe no GAS)

/**
 * 📋 LISTAR TODOS OS USUÁRIOS
 * Use quando: Quiser ver todos os usuários cadastrados
 */
function listarUsuarios() {
  Logger.log("===========================================");
  Logger.log("👥 LISTA DE USUÁRIOS");
  Logger.log("===========================================");
  
  try {
    const users = getAllUsers();
    
    if(users.length === 0) {
      Logger.log("⚠️  Nenhum usuário encontrado");
      Logger.log("Execute doGet() primeiro para criar as planilhas");
      return;
    }
    
    Logger.log("Total de usuários: " + users.length);
    Logger.log("");
    
    users.forEach((u, i) => {
      Logger.log("─────────────────────────────────────────");
      Logger.log(`Usuário ${i + 1}:`);
      Logger.log("   Nome: " + u.nome);
      Logger.log("   Role: " + u.role);
      Logger.log("   Status: " + u.status);
      Logger.log("   Criado em: " + u.criadoEm);
      Logger.log("   Tentativas de login: " + (u.loginAttempts || 0));
      if(u.lockedUntil) {
        Logger.log("   ⚠️  Bloqueado até: " + u.lockedUntil);
      }
    });
    
    Logger.log("===========================================");
    
  } catch(error) {
    Logger.log("❌ ERRO: " + error.message);
  }
}

// ══════════════════════════════════════════════════════════════
// UTILITÁRIOS DE SEGURANÇA
// ══════════════════════════════════════════════════════════════

function generateToken() {
  return Utilities.getUuid() + '-' + Date.now();
}

function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for(let i = 0; i < 12; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function hashPassword(password) {
  // Usando SHA-256 disponível no Google Apps Script
  const rawHash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password + "SALT_SECRET_KEY_CHANGE_THIS" // IMPORTANTE: Trocar este salt!
  );
  return Utilities.base64Encode(rawHash);
}

function sanitizeString(str, maxLength = 200) {
  if(!str) return "";
  // Remove caracteres perigosos para prevenir formula injection
  return String(str)
    .replace(/[=+\-@\t\r\n]/g, '')
    .slice(0, maxLength)
    .trim();
}

function sanitizeNumber(num, min = 0, max = 1000000) {
  const n = Number(num);
  if(isNaN(n)) throw new Error("Número inválido");
  if(n < min || n > max) throw new Error(`Número fora do intervalo permitido (${min}-${max})`);
  return n;
}

function auditLog(user, action, details = {}) {
  try {
    const sheet = getAuditSheet();
    sheet.appendRow([
      new Date().toISOString(),
      user || "SYSTEM",
      action,
      JSON.stringify(details),
      "" // IP não disponível no Apps Script
    ]);
  } catch(e) {
    Logger.log("[AUDIT ERROR] " + e.message);
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function logError(action, error) {
  Logger.log(`[ERRO] ${action}: ${error.message}`);
  auditLog("SYSTEM", "ERROR", {action, error: error.message});
}

// ══════════════════════════════════════════════════════════════
// SHEETS MANAGEMENT
// ══════════════════════════════════════════════════════════════

function getProdSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(PROD_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(PROD_SHEET);
    sheet.appendRow(PROD_HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, PROD_HEADERS.length)
      .setBackground("#1e3a5f")
      .setFontColor("#ffffff")
      .setFontWeight("bold");
  } else {
    // Migração: adiciona colunas NOVAS ao final — nunca sobrescreve posições existentes
    const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(h => String(h).trim());
    PROD_HEADERS.forEach(header => {
      if (!existingHeaders.includes(header)) {
        const appendCol = sheet.getLastColumn() + 1;
        sheet.getRange(1, appendCol).setValue(header)
          .setBackground("#1e3a5f")
          .setFontColor("#ffffff")
          .setFontWeight("bold");
        existingHeaders.push(header);
      }
    });
  }
  return sheet;
}

function getUserSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(USER_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(USER_SHEET);
    sheet.appendRow(USER_HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, USER_HEADERS.length)
      .setBackground("#1e3a5f")
      .setFontColor("#ffffff")
      .setFontWeight("bold");
    
    // IMPORTANTE: Admin deve trocar senha no primeiro login
    const tempPassword = "TROCAR_SENHA_" + Math.random().toString(36).substr(2, 8);
    sheet.appendRow([
      ADMIN_USER,
      hashPassword(tempPassword),
      "admin",
      new Date().toISOString(),
      "ativo",
      0, // loginAttempts
      "" // lockedUntil
    ]);
    
    Logger.log("⚠️ SENHA TEMPORÁRIA DO ADMIN: " + tempPassword);
    Logger.log("⚠️ TROCAR IMEDIATAMENTE!");
  }
  return sheet;
}

function getSessionSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SESSION_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(SESSION_SHEET);
    sheet.appendRow(SESSION_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getAuditSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(AUDIT_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(AUDIT_SHEET);
    sheet.appendRow(AUDIT_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getInviteCodesSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(INVITE_CODES_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(INVITE_CODES_SHEET);
    sheet.appendRow(INVITE_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getMachinesSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(MACHINES_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(MACHINES_SHEET);
    sheet.appendRow(MACHINES_HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, MACHINES_HEADERS.length)
      .setBackground("#1e3a5f")
      .setFontColor("#ffffff")
      .setFontWeight("bold");
    // Migrar MACHINE_DEFS para a planilha
    const now = new Date().toISOString();
    MACHINE_DEFS.forEach(m => {
      sheet.appendRow([m.id, m.name, m.hasMeta ? "TRUE" : "FALSE", m.defaultMeta, "ativo", "SYSTEM", now]);
    });
  }
  return sheet;
}

function getMetasSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(METAS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(METAS_SHEET);
    sheet.appendRow(METAS_HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, METAS_HEADERS.length)
      .setBackground("#1e3a5f")
      .setFontColor("#ffffff")
      .setFontWeight("bold");
    // Inserir metas padrão
    const now = new Date().toISOString();
    DEFAULT_METAS.forEach(m => {
      sheet.appendRow([m.id, m.name, m.meta, "SYSTEM", now]);
    });
  }
  return sheet;
}

function getHolidaysSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(HOLIDAYS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(HOLIDAYS_SHEET);
    sheet.appendRow(HOLIDAYS_HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HOLIDAYS_HEADERS.length)
      .setBackground("#1e3a5f")
      .setFontColor("#ffffff")
      .setFontWeight("bold");
  }
  return sheet;
}

function actionGetHolidays(token) {
  const session = validateSession(token);
  if (!session) return { ok: false, error: "Sessão inválida ou expirada." };
  const sheet = getHolidaysSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { ok: true, holidays: [] };
  const tz = Session.getScriptTimeZone();
  const holidays = data.slice(1).map(row => ({
    id: String(row[0]),
    date: row[1] instanceof Date
      ? Utilities.formatDate(row[1], tz, "yyyy-MM-dd")
      : String(row[1]).slice(0, 10),
    label: String(row[2]),
    type: String(row[3]),
    createdBy: String(row[4]),
    createdAt: String(row[5]),
  }));
  return { ok: true, holidays };
}

function actionAddHoliday(token, date, label, type) {
  const session = validateSession(token);
  if (!session) return { ok: false, error: "Sessão inválida ou expirada." };
  if (session.role !== "admin") return { ok: false, error: "Acesso negado" };
  if (!date || !label || !type) return { ok: false, error: "Campos obrigatórios: date, label, type" };
  if (!["feriado", "dia_anulado"].includes(type)) return { ok: false, error: "Tipo inválido" };

  const sheet = getHolidaysSheet();
  const data = sheet.getDataRange().getValues();
  // Check duplicate date
  const tz = Session.getScriptTimeZone();
  if (data.length > 1) {
    const exists = data.slice(1).some(row => {
      const d = row[1] instanceof Date
        ? Utilities.formatDate(row[1], tz, "yyyy-MM-dd")
        : String(row[1]).slice(0, 10);
      return d === date;
    });
    if (exists) return { ok: false, error: "Já existe um feriado/dia anulado nessa data" };
  }

  const id = Utilities.getUuid();
  const now = new Date().toISOString();
  sheet.appendRow([id, date, label, type, session.nome, now]);
  auditLog(session.nome, "ADD_HOLIDAY", { date, label, type });
  return { ok: true, id };
}

function actionRemoveHoliday(token, id) {
  const session = validateSession(token);
  if (!session) return { ok: false, error: "Sessão inválida ou expirada." };
  if (session.role !== "admin") return { ok: false, error: "Acesso negado" };
  if (!id) return { ok: false, error: "id obrigatório" };

  const sheet = getHolidaysSheet();
  const data = sheet.getDataRange().getValues();
  const rowIndex = data.slice(1).findIndex(row => String(row[0]) === id);
  if (rowIndex === -1) return { ok: false, error: "Feriado não encontrado" };

  sheet.deleteRow(rowIndex + 2);
  auditLog(session.nome, "REMOVE_HOLIDAY", { id });
  return { ok: true };
}

// ══════════════════════════════════════════════════════════════
// SESSION MANAGEMENT
// ══════════════════════════════════════════════════════════════

function createSession(nome, role) {
  const sheet = getSessionSheet();
  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION);
  
  sheet.appendRow([
    token,
    nome,
    role,
    now.toISOString(),
    expiresAt.toISOString()
  ]);
  
  auditLog(nome, "SESSION_CREATED", {role});
  
  return {
    token,
    nome,
    role,
    expiresAt: expiresAt.toISOString()
  };
}

function validateSession(token) {
  if(!token) return null;
  
  const sheet = getSessionSheet();
  const data = sheet.getDataRange().getValues();
  
  for(let i = 1; i < data.length; i++) {
    if(data[i][0] === token) {
      const expiresAt = new Date(data[i][4]);
      if(expiresAt > new Date()) {
        return {
          token: data[i][0],
          nome: data[i][1],
          role: data[i][2]
        };
      } else {
        // Session expirada
        sheet.deleteRow(i + 1);
        return null;
      }
    }
  }
  return null;
}

function invalidateSession(token) {
  const sheet = getSessionSheet();
  const data = sheet.getDataRange().getValues();
  
  for(let i = data.length - 1; i >= 1; i--) {
    if(data[i][0] === token) {
      sheet.deleteRow(i + 1);
      auditLog(data[i][1], "SESSION_INVALIDATED", {});
      return true;
    }
  }
  return false;
}

function cleanExpiredSessions() {
  const sheet = getSessionSheet();
  const data = sheet.getDataRange().getValues();
  const now = new Date();
  
  for(let i = data.length - 1; i >= 1; i--) {
    const expiresAt = new Date(data[i][4]);
    if(expiresAt < now) {
      sheet.deleteRow(i + 1);
    }
  }
}

// ══════════════════════════════════════════════════════════════
// FUNÇÃO AUXILIAR - DEFINIR SENHA DO ADMIN
// Execute esta função UMA VEZ para definir a senha inicial
// ══════════════════════════════════════════════════════════════

function definirSenhaAdmin() {
  // ⚠️ TROQUE AQUI pela senha que você quer usar (não deixe senha real no código-fonte)
  const SENHA_INICIAL = "TROCAR_ANTES_DE_USAR";
  
  Logger.log("════════════════════════════════════════");
  Logger.log("🔐 DEFININDO SENHA DO ADMINISTRADOR");
  Logger.log("════════════════════════════════════════");
  
  try {
    // Criar planilha de usuários se não existir
    const sheet = getUserSheet();
    
    // Gerar hash da senha
    const senhaHash = hashPassword(SENHA_INICIAL);
    
    // Verificar se Admin já existe
    const data = sheet.getDataRange().getValues();
    let adminRow = -1;
    
    for(let i = 1; i < data.length; i++) {
      if(data[i][0] === ADMIN_USER) {
        adminRow = i + 1; // +1 porque sheet é 1-indexed
        break;
      }
    }
    
    if(adminRow > 0) {
      // Admin já existe, apenas atualizar senha
      sheet.getRange(adminRow, 2).setValue(senhaHash);
      Logger.log("✅ Senha do Admin ATUALIZADA com sucesso!");
    } else {
      // Admin não existe, criar
      sheet.appendRow([
        ADMIN_USER,
        senhaHash,
        "admin",
        new Date().toISOString(),
        "ativo",
        0,
        ""
      ]);
      Logger.log("✅ Conta Admin CRIADA com sucesso!");
    }
    
    Logger.log("");
    Logger.log("📋 CREDENCIAIS DE LOGIN:");
    Logger.log("   Usuário: Admin");
    Logger.log("   Senha: " + SENHA_INICIAL);
    Logger.log("");
    Logger.log("⚠️  IMPORTANTE:");
    Logger.log("   1. Use estas credenciais para fazer o primeiro login");
    Logger.log("   2. TROQUE a senha imediatamente após entrar");
    Logger.log("   3. Delete esta função do código após usar");
    Logger.log("");
    Logger.log("════════════════════════════════════════");
    
    return {
      ok: true,
      usuario: "Admin",
      senha: SENHA_INICIAL
    };
    
  } catch(err) {
    Logger.log("❌ ERRO: " + err.message);
    Logger.log(err.stack);
    return {
      ok: false,
      error: err.message
    };
  }
}

// ══════════════════════════════════════════════════════════════
// FUNÇÃO DE TESTE - Testar criação de planilhas
// ══════════════════════════════════════════════════════════════

function testarSistema() {
  Logger.log("════════════════════════════════════════");
  Logger.log("🧪 TESTANDO SISTEMA");
  Logger.log("════════════════════════════════════════");
  
  try {
    // Criar todas as planilhas
    Logger.log("1. Criando planilha de Produção...");
    getProdSheet();
    Logger.log("   ✅ OK");
    
    Logger.log("2. Criando planilha de Usuários...");
    getUserSheet();
    Logger.log("   ✅ OK");
    
    Logger.log("3. Criando planilha de Sessões...");
    getSessionSheet();
    Logger.log("   ✅ OK");
    
    Logger.log("4. Criando planilha de Auditoria...");
    getAuditSheet();
    Logger.log("   ✅ OK");
    
    Logger.log("5. Criando planilha de Códigos de Convite...");
    getInviteCodesSheet();
    Logger.log("   ✅ OK");

    Logger.log("6. Criando planilha de Metas Globais...");
    getMetasSheet();
    Logger.log("   ✅ OK");

    Logger.log("");
    Logger.log("════════════════════════════════════════");
    Logger.log("✅ TODAS AS PLANILHAS CRIADAS!");
    Logger.log("════════════════════════════════════════");
    Logger.log("");
    Logger.log("📋 Próximos passos:");
    Logger.log("   1. Execute a função: definirSenhaAdmin()");
    Logger.log("   2. Anote a senha que aparecer nos logs");
    Logger.log("   3. Faça o deploy da Web App");
    Logger.log("   4. Copie a URL");
    Logger.log("   5. Use no frontend (app.js)");
    Logger.log("");
    
    return { ok: true };
    
  } catch(err) {
    Logger.log("❌ ERRO: " + err.message);
    return { ok: false, error: err.message };
  }
}

// ══════════════════════════════════════════════════════════════
// PONTO DE ENTRADA
// ══════════════════════════════════════════════════════════════

function doGet(e) {
  try {
    // Limpar sessões expiradas periodicamente
    if(Math.random() < 0.1) cleanExpiredSessions();
    
    // ✅ SEGURO: Se executado diretamente sem parâmetros (pelo Run no Apps Script)
    if (!e || !e.parameter || !e.parameter.payload) {
      Logger.log("===========================================");
      Logger.log("🚀 INICIALIZANDO SISTEMA SEGURO");
      Logger.log("===========================================");
      
      // Força criação das planilhas na primeira execução
      Logger.log("📋 Criando/verificando planilhas...");
      const userSheet = getUserSheet();
      getProdSheet();
      getSessionSheet();
      getAuditSheet();
      getInviteCodesSheet();
      getMetasSheet();
      Logger.log("✅ Todas as planilhas criadas/verificadas");
      
      // Verificar se Admin foi criado e mostrar informações
      Logger.log("");
      Logger.log("👤 VERIFICANDO USUÁRIO ADMIN...");
      const users = getAllUsers();
      const admin = users.find(u => u.nome === ADMIN_USER);
      
      if(admin) {
        Logger.log("✅ Usuário Admin encontrado!");
        Logger.log("");
        Logger.log("📊 INFORMAÇÕES DO ADMIN:");
        Logger.log("   Nome: " + admin.nome);
        Logger.log("   Role: " + admin.role);
        Logger.log("   Status: " + admin.status);
        Logger.log("   Criado em: " + admin.criadoEm);
        Logger.log("");
        Logger.log("⚠️  A SENHA ESTÁ EM HASH (CRIPTOGRAFADA)");
        Logger.log("⚠️  Para ver a senha, execute a função: verSenhaAdmin()");
        Logger.log("⚠️  Ou execute: definirSenhaAdmin()");
      } else {
        Logger.log("⚠️  Admin não encontrado (erro inesperado)");
      }
      
      Logger.log("");
      Logger.log("===========================================");
      Logger.log("✅ SISTEMA INICIALIZADO COM SUCESSO!");
      Logger.log("📌 Versão: 2.5-SECURE");
      Logger.log("🔒 Segurança: Enterprise Grade");
      Logger.log("===========================================");
      
      return json({
        ok: true,
        msg: "API online - Sistema inicializado",
        version: "2.6-SHARED-METAS",
        security: "Enterprise Grade",
        planilhas: ["Producao", "Usuarios", "Sessions", "AuditLogs", "InviteCodes", "Metas"]
      });
    }

    // ✅ SEGURO: Processar requisição normal da API
    const raw = decodeURIComponent(e.parameter.payload);
    const decoded = Utilities.newBlob(Utilities.base64Decode(raw)).getDataAsString();
    const payload = JSON.parse(decoded);

    Logger.log(`[ACTION] ${payload.action}`);

    switch (payload.action) {
      case "login":
        return json(actionLogin(payload.nome, payload.senha));
      case "logout":
        return json(actionLogout(payload.token));
      case "register":
        return json(actionRegister(payload.nome, payload.senha, payload.inviteCode));
      case "generateInviteCode":
        return json(actionGenerateInviteCode(payload.token));
      case "listInviteCodes":
        return json(actionListInviteCodes(payload.token));
      case "adminCreateUser":
        return json(actionAdminCreateUser(payload.token, payload.nome, payload.senha));
      case "resetPassword":
        return json(actionResetPassword(payload.token, payload.targetNome, payload.novaSenha));
      case "listUsers":
        return json(actionListUsers(payload.token));
      case "toggleUser":
        return json(actionToggleUser(payload.token, payload.targetNome));
      case "getAll":
        return json(actionGetAll(payload.token));
      case "upsert":
        return json(actionUpsert(payload.token, payload.records || []));
      case "delete":
        return json(actionDelete(payload.token, payload.date, payload.turno, payload.machineId, payload.id));
      case "append":
        return json(actionAppend(payload.token, payload.records || []));
      case "getMachines":
        return json(actionGetMachines(payload.token));
      case "addMachine":
        return json(actionAddMachine(payload.token, payload.name, payload.hasMeta, payload.defaultMeta));
      case "updateMachine":
        return json(actionUpdateMachine(payload.token, payload.machineId, payload.name, payload.hasMeta, payload.defaultMeta));
      case "toggleMachine":
        return json(actionToggleMachine(payload.token, payload.machineId));
      case "getMetas":
        return json(actionGetMetas(payload.token));
      case "saveMetas":
        return json(actionSaveMetas(payload.token, payload.metas, payload.vigenciaInicio));
      case "getHolidays":
        return json(actionGetHolidays(payload.token));
      case "addHoliday":
        return json(actionAddHoliday(payload.token, payload.date, payload.label, payload.type));
      case "removeHoliday":
        return json(actionRemoveHoliday(payload.token, payload.id));
      default:
        auditLog("UNKNOWN", "INVALID_ACTION", {action: payload.action});
        return json({ ok: false, error: "Ação desconhecida" });
    }
  } catch (err) {
    logError("doGet", err);
    return json({ ok: false, error: "Erro no servidor. Tente novamente." });
  }
}

// ══════════════════════════════════════════════════════════════
// AUTENTICAÇÃO E AUTORIZAÇÃO
// ══════════════════════════════════════════════════════════════

function getAllUsers() {
  const sheet = getUserSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  return data.slice(1).map((row, i) => ({
    _row: i + 2,
    nome: row[0] || "",
    senhaHash: row[1] || "",
    role: row[2] || "operator",
    criadoEm: row[3] || "",
    status: row[4] || "ativo",
    loginAttempts: row[5] || 0,
    lockedUntil: row[6] || ""
  }));
}

function actionLogin(nome, senha) {
  try {
    if (!nome || !senha) {
      return { ok: false, error: "Preencha todos os campos" };
    }

    const users = getAllUsers();
    const u = users.find(user => user.nome.toLowerCase() === nome.toLowerCase());
    
    if (!u) {
      auditLog(nome, "LOGIN_FAILED", {reason: "user_not_found"});
      return { ok: false, error: "Usuário ou senha incorretos" };
    }

    // Verificar se conta está bloqueada
    if (u.lockedUntil) {
      const lockTime = new Date(u.lockedUntil);
      if (lockTime > new Date()) {
        const minutesLeft = Math.ceil((lockTime - new Date()) / 60000);
        auditLog(nome, "LOGIN_BLOCKED", {minutesLeft});
        return { 
          ok: false, 
          error: `Conta bloqueada temporariamente. Tente novamente em ${minutesLeft} minutos.` 
        };
      }
    }

    // Verificar senha — abre a sheet uma única vez para todo o fluxo de login
    const userSheet = getUserSheet();
    const passwordHash = hashPassword(senha);
    if (u.senhaHash !== passwordHash) {
      // Incrementar tentativas
      const newAttempts = (u.loginAttempts || 0) + 1;

      // Bloquear se exceder limite
      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCKOUT_DURATION).toISOString();
        userSheet.getRange(u._row, 6, 1, 2).setValues([[newAttempts, lockUntil]]);
        auditLog(nome, "ACCOUNT_LOCKED", {attempts: newAttempts});
        return { 
          ok: false, 
          error: "Muitas tentativas incorretas. Conta bloqueada por 15 minutos." 
        };
      }
      
      userSheet.getRange(u._row, 6).setValue(newAttempts);
      auditLog(nome, "LOGIN_FAILED", {reason: "wrong_password", attempts: newAttempts});
      return {
        ok: false,
        error: `Senha incorreta. ${MAX_LOGIN_ATTEMPTS - newAttempts} tentativas restantes.`
      };
    }

    // Verificar status
    if (u.status === "bloqueado") {
      auditLog(nome, "LOGIN_FAILED", {reason: "account_blocked"});
      return { ok: false, error: "Conta bloqueada. Contate o administrador." };
    }

    // Login bem-sucedido - resetar tentativas
    userSheet.getRange(u._row, 6, 1, 2).setValues([[0, ""]]);

    // Criar sessão
    const session = createSession(u.nome, u.role);
    
    auditLog(nome, "LOGIN_SUCCESS", {role: u.role});
    
    return { 
      ok: true, 
      session: {
        token: session.token,
        nome: session.nome,
        role: session.role,
        expiresAt: session.expiresAt
      }
    };
  } catch (err) {
    logError("actionLogin", err);
    return { ok: false, error: "Erro ao fazer login" };
  }
}

function actionLogout(token) {
  invalidateSession(token);
  return { ok: true };
}

function actionRegister(nome, senha, inviteCode) {
  // Access code stored in Script Properties — set via:
  //   Project Settings → Script properties → ACCESS_CODE = <your code>
  // Never hardcode secrets in source.
  const ACCESS_CODE = PropertiesService.getScriptProperties().getProperty("ACCESS_CODE");
  if (!ACCESS_CODE) {
    logError("actionRegister", new Error("ACCESS_CODE not configured in Script Properties"));
    return { ok: false, error: "Registros desativados temporariamente. Contate o administrador." };
  }
  try {
    if (!nome || !senha || !inviteCode) {
      return { ok: false, error: "Preencha todos os campos" };
    }

    if (nome.length < 3) {
      return { ok: false, error: "Nome deve ter pelo menos 3 caracteres" };
    }

    if (senha.length < 4) {
      return { ok: false, error: "Senha deve ter pelo menos 4 caracteres" };
    }

    // Validar código de acesso fixo
    if (String(inviteCode).trim() !== ACCESS_CODE) {
      auditLog(nome, "REGISTER_FAILED", {reason: "invalid_access_code", received: String(inviteCode).trim()});
      return { ok: false, error: "Código de acesso inválido" };
    }

    // Verificar se nome já existe
    const users = getAllUsers();
    if (users.find(u => u.nome.toLowerCase() === nome.toLowerCase())) {
      auditLog(nome, "REGISTER_FAILED", {reason: "name_exists"});
      return { ok: false, error: "Este nome já está em uso" };
    }

    // Criar usuário
    const userSheet = getUserSheet();
    const sanitizedNome = sanitizeString(nome, 50);
    const passwordHash = hashPassword(senha);

    userSheet.appendRow([
      sanitizedNome,
      passwordHash,
      "operator",
      new Date().toISOString(),
      "ativo",
      0,
      ""
    ]);

    auditLog(sanitizedNome, "REGISTER_SUCCESS", {});
    
    // Criar sessão automaticamente
    const session = createSession(sanitizedNome, "operator");
    
    return { 
      ok: true, 
      session: {
        token: session.token,
        nome: session.nome,
        role: session.role,
        expiresAt: session.expiresAt
      }
    };
  } catch (err) {
    logError("actionRegister", err);
    return { ok: false, error: "Erro ao criar conta" };
  }
}

// ══════════════════════════════════════════════════════════════
// ADMIN FUNCTIONS
// ══════════════════════════════════════════════════════════════

function actionGenerateInviteCode(token) {
  const session = validateSession(token);
  if(!session || session.role !== "admin") {
    auditLog(session?.nome || "UNKNOWN", "UNAUTHORIZED_INVITE_GEN", {});
    return { ok: false, error: "Acesso negado" };
  }
  
  const code = generateInviteCode();
  const sheet = getInviteCodesSheet();
  
  sheet.appendRow([
    code,
    session.nome,
    new Date().toISOString(),
    "", // usedBy
    "", // usedAt
    "ativo"
  ]);
  
  auditLog(session.nome, "INVITE_CODE_GENERATED", {code});
  
  return { ok: true, code };
}

function actionListInviteCodes(token) {
  const session = validateSession(token);
  if(!session || session.role !== "admin") {
    return { ok: false, error: "Acesso negado" };
  }
  
  const sheet = getInviteCodesSheet();
  const data = sheet.getDataRange().getValues();
  
  const codes = data.slice(1).map(row => ({
    code: row[0],
    createdBy: row[1],
    createdAt: row[2],
    usedBy: row[3],
    usedAt: row[4],
    status: row[5]
  }));
  
  return { ok: true, codes };
}

function actionListUsers(token) {
  const session = validateSession(token);
  if(!session || session.role !== "admin") {
    return { ok: false, error: "Acesso negado" };
  }
  
  const users = getAllUsers().map(u => ({
    nome: u.nome,
    role: u.role,
    criadoEm: u.criadoEm,
    status: u.status
  }));
  
  return { ok: true, users };
}

function actionToggleUser(token, targetNome) {
  const session = validateSession(token);
  if(!session || session.role !== "admin") {
    return { ok: false, error: "Acesso negado" };
  }
  
  const users = getAllUsers();
  const u = users.find(user => user.nome.toLowerCase() === targetNome.toLowerCase());
  
  if (!u) return { ok: false, error: "Usuário não encontrado" };
  if (u.nome === ADMIN_USER) return { ok: false, error: "Não é possível bloquear o admin principal" };
  
  const newStatus = u.status === "ativo" ? "bloqueado" : "ativo";
  getUserSheet().getRange(u._row, 5).setValue(newStatus);
  
  auditLog(session.nome, "USER_TOGGLED", {target: targetNome, newStatus});
  
  return { ok: true, newStatus };
}

function actionResetPassword(token, targetNome, novaSenha) {
  const session = validateSession(token);
  if(!session || session.role !== "admin") {
    return { ok: false, error: "Acesso negado" };
  }
  
  // FIX #3: exigia 8 chars mas registration/adminCreate aceitam 4 — frontend dizia "Mín. 4"
  if (!novaSenha || novaSenha.length < 4) {
    return { ok: false, error: "Senha deve ter pelo menos 4 caracteres" };
  }
  
  const users = getAllUsers();
  const u = users.find(user => user.nome.toLowerCase() === targetNome.toLowerCase());
  
  if (!u) return { ok: false, error: "Usuário não encontrado" };
  
  const newHash = hashPassword(novaSenha);
  getUserSheet().getRange(u._row, 2).setValue(newHash);
  
  auditLog(session.nome, "PASSWORD_RESET", {target: targetNome});
  
  return { ok: true };
}

function actionAdminCreateUser(token, nome, senha) {
  const session = validateSession(token);
  if (!session || session.role !== "admin") {
    return { ok: false, error: "Acesso negado" };
  }

  if (!nome || nome.trim().length < 3) {
    return { ok: false, error: "Nome deve ter pelo menos 3 caracteres" };
  }
  if (!senha || senha.length < 4) {
    return { ok: false, error: "Senha deve ter pelo menos 4 caracteres" };
  }

  const sanitizedNome = sanitizeString(nome.trim(), 50);
  const users = getAllUsers();
  if (users.find(u => u.nome.toLowerCase() === sanitizedNome.toLowerCase())) {
    return { ok: false, error: "Este nome já está em uso" };
  }

  getUserSheet().appendRow([
    sanitizedNome,
    hashPassword(senha),
    "operator",
    new Date().toISOString(),
    "ativo",
    0,
    ""
  ]);

  auditLog(session.nome, "USER_CREATED_BY_ADMIN", { nome: sanitizedNome });
  return { ok: true };
}

// ══════════════════════════════════════════════════════════════
// METAS GLOBAIS (compartilhadas entre todos os usuários)
// ══════════════════════════════════════════════════════════════

function readMachinesFromSheet() {
  const sheet = getMachinesSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const data = sheet.getRange(2, 1, lastRow - 1, MACHINES_HEADERS.length).getValues();
  return data.map(row => ({
    id: Number(row[0]),
    name: String(row[1]),
    hasMeta: String(row[2]).toUpperCase() === "TRUE",
    defaultMeta: Number(row[3]),
    status: String(row[4]) || "ativo",
    createdBy: String(row[5]),
    createdAt: String(row[6])
  }));
}

function actionGetMachines(token) {
  const session = validateSession(token);
  if (!session) return { ok: false, error: "Sessão inválida ou expirada. Faça login novamente." };
  const all = readMachinesFromSheet();
  const active = all.filter(m => m.status === "ativo");
  return { ok: true, machines: active, allMachines: all };
}

function actionAddMachine(token, name, hasMeta, defaultMeta) {
  const session = validateSession(token);
  if (!session) return { ok: false, error: "Sessão inválida ou expirada." };
  if (session.role !== "admin") return { ok: false, error: "Apenas administradores podem gerenciar máquinas." };
  if (!name || !name.trim()) return { ok: false, error: "Nome da máquina é obrigatório." };

  const all = readMachinesFromSheet();
  const dup = all.find(m => m.name.toUpperCase() === name.trim().toUpperCase());
  if (dup) return { ok: false, error: "Já existe uma máquina com esse nome." };

  const maxId = all.reduce((mx, m) => Math.max(mx, m.id), 0);
  const newId = maxId + 1;
  const now = new Date().toISOString();
  const sheet = getMachinesSheet();
  sheet.appendRow([newId, name.trim(), hasMeta ? "TRUE" : "FALSE", Number(defaultMeta) || 0, "ativo", session.nome, now]);

  auditLog(session.nome, "ADD_MACHINE", { id: newId, name: name.trim() });
  return { ok: true, machine: { id: newId, name: name.trim(), hasMeta: !!hasMeta, defaultMeta: Number(defaultMeta) || 0, status: "ativo" } };
}

function actionUpdateMachine(token, machineId, name, hasMeta, defaultMeta) {
  const session = validateSession(token);
  if (!session) return { ok: false, error: "Sessão inválida ou expirada." };
  if (session.role !== "admin") return { ok: false, error: "Apenas administradores podem gerenciar máquinas." };
  if (!name || !name.trim()) return { ok: false, error: "Nome da máquina é obrigatório." };

  const sheet = getMachinesSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { ok: false, error: "Máquina não encontrada." };

  const data = sheet.getRange(2, 1, lastRow - 1, MACHINES_HEADERS.length).getValues();
  const rowIdx = data.findIndex(row => Number(row[0]) === Number(machineId));
  if (rowIdx === -1) return { ok: false, error: "Máquina não encontrada." };

  // Check duplicate name (excluding current)
  const dup = data.find((row, i) => i !== rowIdx && String(row[1]).toUpperCase() === name.trim().toUpperCase());
  if (dup) return { ok: false, error: "Já existe outra máquina com esse nome." };

  const sheetRow = rowIdx + 2;
  sheet.getRange(sheetRow, 2, 1, 3).setValues([[name.trim(), hasMeta ? "TRUE" : "FALSE", Number(defaultMeta) || 0]]);

  auditLog(session.nome, "UPDATE_MACHINE", { id: Number(machineId), name: name.trim() });
  return { ok: true };
}

function actionToggleMachine(token, machineId) {
  const session = validateSession(token);
  if (!session) return { ok: false, error: "Sessão inválida ou expirada." };
  if (session.role !== "admin") return { ok: false, error: "Apenas administradores podem gerenciar máquinas." };

  const sheet = getMachinesSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { ok: false, error: "Máquina não encontrada." };

  const data = sheet.getRange(2, 1, lastRow - 1, MACHINES_HEADERS.length).getValues();
  const rowIdx = data.findIndex(row => Number(row[0]) === Number(machineId));
  if (rowIdx === -1) return { ok: false, error: "Máquina não encontrada." };

  const current = String(data[rowIdx][4]);
  const newStatus = current === "ativo" ? "inativo" : "ativo";
  sheet.getRange(rowIdx + 2, 5).setValue(newStatus);

  auditLog(session.nome, "TOGGLE_MACHINE", { id: Number(machineId), newStatus });
  return { ok: true, newStatus };
}

function actionGetMetas(token) {
  const session = validateSession(token);
  if (!session) {
    return { ok: false, error: "Sessão inválida ou expirada. Faça login novamente." };
  }

  try {
    const sheet = getMetasSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { ok: true, metas: {}, metasInfo: {} };

    const data = sheet.getRange(2, 1, lastRow - 1, METAS_HEADERS.length).getValues();
    const metas = {};
    const metasInfo = {};
    data.forEach(row => {
      const machineId = Number(row[0]);
      if (machineId > 0) {
        metas[machineId] = Number(row[2]);
        metasInfo[machineId] = {
          updatedBy: String(row[3] || ""),
          updatedAt: row[4] ? String(row[4]) : "",
          vigenciaInicio: row[5] ? String(row[5]) : ""
        };
      }
    });

    return { ok: true, metas, metasInfo };
  } catch (err) {
    logError("actionGetMetas", err);
    return { ok: false, error: "Erro ao carregar metas" };
  }
}

function actionSaveMetas(token, metas, vigenciaInicio) {
  const session = validateSession(token);
  if (!session) {
    return { ok: false, error: "Sessão inválida ou expirada" };
  }

  try {
    if (!metas || typeof metas !== 'object') {
      return { ok: false, error: "Dados de metas inválidos" };
    }

    const sheet = getMetasSheet();
    const allData = sheet.getDataRange().getValues();
    const now = new Date().toISOString();
    // vigenciaInicio: data a partir da qual a meta entra em vigor (padrão: hoje)
    const vigDate = vigenciaInicio
      ? String(vigenciaInicio).slice(0, 10)
      : Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyy-MM-dd");

    Object.keys(metas).forEach(machineIdStr => {
      const machineId = Number(machineIdStr);
      if (isNaN(machineId) || machineId <= 0) return;

      const metaVal = sanitizeNumber(metas[machineIdStr], 0, 100000);

      // Localizar linha da máquina
      let foundRow = -1;
      for (let i = 1; i < allData.length; i++) {
        if (Number(allData[i][0]) === machineId) {
          foundRow = i + 1;
          break;
        }
      }

      if (foundRow > 0) {
        // Atualizar meta, responsável, timestamp e vigenciaInicio
        sheet.getRange(foundRow, 3, 1, 4).setValues([[metaVal, session.nome, now, vigDate]]);
      }
    });

    SpreadsheetApp.flush();
    auditLog(session.nome, "METAS_SAVED", { vigenciaInicio: vigDate });
    return { ok: true };
  } catch (err) {
    logError("actionSaveMetas", err);
    return { ok: false, error: err.message };
  }
}

// ══════════════════════════════════════════════════════════════
// DATA OPERATIONS
// ══════════════════════════════════════════════════════════════

function actionGetAll(token) {
  const session = validateSession(token);
  if(!session) {
    return { ok: false, error: "Sessão inválida ou expirada. Faça login novamente." };
  }
  
  try {
    const sheet = getProdSheet();
    const lastRow = sheet.getLastRow();
    
    if (lastRow <= 1) return { ok: true, data: [] };

    const data = sheet.getRange(2, 1, lastRow - 1, PROD_HEADERS.length).getValues();
    
    const records = data.map(row => {
      const obj = {};
      PROD_HEADERS.forEach((header, i) => {
        const value = row[i];
        
        if (value === null || value === undefined || value === "") {
          obj[header] = "";
          return;
        }
        
        // Converter Date para ISO
        if (header === "date" && value instanceof Date) {
          const year = value.getFullYear();
          const month = String(value.getMonth() + 1).padStart(2, '0');
          const day = String(value.getDate()).padStart(2, '0');
          obj[header] = `${year}-${month}-${day}`;
          return;
        }
        
        obj[header] = String(value).trim();
      });
      return obj;
    }).filter(r => r.machineId !== "" && r.date !== "");
    
    return { ok: true, data: records };
    
  } catch (err) {
    logError("actionGetAll", err);
    return { ok: false, error: "Erro ao carregar dados" };
  }
}

function actionUpsert(token, records) {
  const session = validateSession(token);
  if(!session) {
    return { ok: false, error: "Sessão inválida ou expirada" };
  }
  
  try {
    if (!records || records.length === 0) {
      return { ok: false, error: "Nenhum registro fornecido" };
    }
    
    const sheet = getProdSheet();
    const allData = sheet.getDataRange().getValues();

    // Posições fixas por PROD_HEADERS — consistente com actionGetAll
    const _idIdx    = PROD_HEADERS.indexOf("id");
    const _dateIdx  = PROD_HEADERS.indexOf("date");
    const _turnoIdx = PROD_HEADERS.indexOf("turno");
    const _machIdx  = PROD_HEADERS.indexOf("machineId");

    records.forEach((rec, idx) => {
      // Validações
      if (!rec.date || !rec.turno || !rec.machineId) {
        Logger.log(`[UPSERT] Registro ${idx} ignorado - campos obrigatórios ausentes`);
        return;
      }
      
      // Validar turno
      if(!VALID_TURNOS.includes(rec.turno)) {
        throw new Error(`Turno inválido: ${rec.turno}`);
      }
      
      // Sanitizar e validar
      // Valida formato ISO de data (YYYY-MM-DD) para evitar formula injection
      const dateStr = String(rec.date || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        throw new Error(`Formato de data inválido: ${dateStr}`);
      }
      const sanitizedData = {
        date: dateStr,
        turno: rec.turno,
        machineId: sanitizeNumber(rec.machineId, 1, 100),
        machineName: sanitizeString(rec.machineName, 100),
        meta: sanitizeNumber(rec.meta, 0, 1000000),
        producao: sanitizeNumber(rec.producao, 0, 100000),
        savedBy: sanitizeString(rec.savedBy, 50),
        savedAt: sanitizeString(rec.savedAt, 50),
        editUser: sanitizeString(rec.editUser, 50),
        editTime: sanitizeString(rec.editTime, 50),
        // obs: undefined significa "não fornecido — preservar valor existente"
        obs: rec.obs !== undefined ? sanitizeString(rec.obs, 500) : undefined
      };
      
      // Procurar registro existente (por posição fixa — igual ao actionGetAll)
      let foundRow = -1;
      for (let i = 1; i < allData.length; i++) {
        var rawDate = allData[i][_dateIdx];
        var rowDate;
        if (rawDate instanceof Date) {
          rowDate = rawDate.getFullYear() + "-" +
            String(rawDate.getMonth()+1).padStart(2,"0") + "-" +
            String(rawDate.getDate()).padStart(2,"0");
        } else {
          rowDate = String(rawDate || "").trim();
        }
        const rowTurno  = String(allData[i][_turnoIdx] || "").trim();
        const rowMachId = String(allData[i][_machIdx]  || "").trim();

        if (rowDate === String(sanitizedData.date) &&
            rowTurno === String(sanitizedData.turno) &&
            rowMachId === String(sanitizedData.machineId)) {
          foundRow = i + 1;
          break;
        }
      }
      
      const rowData = PROD_HEADERS.map(header => {
        if (header === "id") {
          if (foundRow > 0) {
            return allData[foundRow - 1][_idIdx] || Utilities.getUuid();
          }
          return Utilities.getUuid();
        }

        if (sanitizedData[header] !== undefined && sanitizedData[header] !== null) {
          return sanitizedData[header];
        }

        // Preserva campos do registro original quando não fornecidos na atualização
        if (foundRow > 0 && (header === "savedBy" || header === "savedAt" || header === "obs")) {
          const existingIdx = PROD_HEADERS.indexOf(header);
          return existingIdx >= 0 ? (allData[foundRow - 1][existingIdx] || "") : "";
        }

        return "";
      });
      
      if (foundRow > 0) {
        sheet.getRange(foundRow, 1, 1, PROD_HEADERS.length).setValues([rowData]);
        auditLog(session.nome, "RECORD_UPDATED", {date: rec.date, turno: rec.turno, machineId: rec.machineId});
      } else {
        sheet.appendRow(rowData);
        auditLog(session.nome, "RECORD_CREATED", {date: rec.date, turno: rec.turno, machineId: rec.machineId});
      }
    });
    
    SpreadsheetApp.flush();
    return { ok: true, updated: records.length };
    
  } catch (err) {
    logError("actionUpsert", err);
    return { ok: false, error: err.message };
  }
}

// ══════════════════════════════════════════════════════════════
// ALERTAS AUTOMÁTICOS POR EMAIL
// ══════════════════════════════════════════════════════════════
// Como usar:
//   1. Abra o GAS editor → Executar → setupDailyTrigger()
//   2. Autorize as permissões (MailApp, Trigger)
//   3. O relatório será enviado às 23:00 todo dia para o e-mail da conta Google
//   4. Para cancelar: Gatilhos → delete "sendDailyReport"

function setupDailyTrigger() {
  // Remove triggers existentes para evitar duplicação
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'sendDailyReport')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('sendDailyReport')
    .timeBased()
    .everyDays(1)
    .atHour(23)
    .create();

  Logger.log("✅ Trigger configurado: sendDailyReport será executado às 23:00 todo dia.");
  Logger.log("   E-mail será enviado para: " + Session.getActiveUser().getEmail());
}

function sendDailyReport() {
  try {
    const tz = "America/Sao_Paulo";
    const today = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
    const dateFormatted = Utilities.formatDate(new Date(), tz, "dd/MM/yyyy");

    // Carregar dados de produção da planilha
    const sheet = getProdSheet();
    const allData = sheet.getDataRange().getValues();
    if (allData.length <= 1) return;
    const headers = allData[0];

    const dateIdx    = PROD_HEADERS.indexOf("date");
    const machIdIdx  = PROD_HEADERS.indexOf("machineId");
    const machNameIdx= PROD_HEADERS.indexOf("machineName");
    const prodIdx    = PROD_HEADERS.indexOf("producao");

    // Filtrar registros de hoje
    const todayRows = allData.slice(1).filter(row => {
      const d = row[dateIdx];
      if (!d) return false;
      const ds = d instanceof Date
        ? Utilities.formatDate(d, tz, "yyyy-MM-dd")
        : String(d).slice(0, 10);
      return ds === today;
    });

    if (todayRows.length === 0) {
      Logger.log("[sendDailyReport] Sem dados para hoje (" + today + "). E-mail não enviado.");
      return;
    }

    // Carregar metas
    const metaMap = {};
    getMetasSheet().getDataRange().getValues().slice(1).forEach(r => {
      metaMap[Number(r[0])] = Number(r[2]);
    });

    // Agregar produção por máquina (soma todos os turnos)
    const agg = {};
    todayRows.forEach(row => {
      const mId = Number(row[machIdIdx]);
      if (!agg[mId]) agg[mId] = { name: String(row[machNameIdx] || "Máquina " + mId), prod: 0 };
      agg[mId].prod += Number(row[prodIdx]) || 0;
    });

    // Calcular % da meta diária (meta * 3 turnos)
    const report = [];
    const alerts = [];
    Object.entries(agg).forEach(function(entry) {
      var id = entry[0]; var a = entry[1];
      const metaDia = (metaMap[Number(id)] || 0) * 3;
      const pct = metaDia > 0 ? Math.round(a.prod / metaDia * 100) : null;
      report.push({ name: a.name, prod: a.prod, meta: metaDia, pct: pct });
      if (pct !== null && pct < 80) {
        alerts.push({ name: a.name, prod: a.prod, meta: metaDia, pct: pct });
      }
    });

    if (alerts.length === 0) {
      Logger.log("[sendDailyReport] Todas as máquinas >= 80%. E-mail não enviado.");
      auditLog("SYSTEM", "DAILY_REPORT_SKIPPED", { reason: "all_ok", date: today });
      return;
    }

    // Montar HTML do e-mail
    function colFor(pct) {
      return pct === null ? '#666' : pct >= 100 ? '#27AE60' : pct >= 80 ? '#E87722' : '#C8102E';
    }
    function tr(r) {
      var c = colFor(r.pct);
      return '<tr><td style="padding:7px 12px;border-bottom:1px solid #eee">' + r.name +
        '</td><td style="padding:7px 12px;border-bottom:1px solid #eee;text-align:center">' + r.prod.toLocaleString() +
        '</td><td style="padding:7px 12px;border-bottom:1px solid #eee;text-align:center">' + (r.meta > 0 ? r.meta.toLocaleString() : '—') +
        '</td><td style="padding:7px 12px;border-bottom:1px solid #eee;text-align:center;color:' + c + ';font-weight:bold">' +
        (r.pct !== null ? r.pct + '%' : '—') + '</td></tr>';
    }
    var thead = '<tr><th style="padding:8px 12px;background:#003057;color:#fff;text-align:left">Máquina</th>' +
      '<th style="padding:8px 12px;background:#003057;color:#fff;text-align:center">Produção</th>' +
      '<th style="padding:8px 12px;background:#003057;color:#fff;text-align:center">Meta Dia</th>' +
      '<th style="padding:8px 12px;background:#003057;color:#fff;text-align:center">% Meta</th></tr>';

    var alertRows = alerts.sort(function(a,b){ return (a.pct||0)-(b.pct||0); }).map(tr).join('');
    var reportRows = report.sort(function(a,b){ return a.name.localeCompare(b.name); }).map(tr).join('');

    var body = '<div style="font-family:\'Segoe UI\',sans-serif;max-width:700px">' +
      '<div style="background:#003057;padding:20px 28px;border-radius:6px 6px 0 0">' +
      '<h2 style="color:#fff;margin:0;font-size:18px">⚠️ Alerta de Produção — ' + dateFormatted + '</h2>' +
      '<p style="color:#A8C6D8;margin:6px 0 0;font-size:13px">' + alerts.length + ' máquina(s) abaixo de 80% da meta diária</p>' +
      '</div><div style="background:#fff;padding:20px 28px;border:1px solid #ddd;border-top:none">' +
      '<h3 style="color:#C8102E;margin-top:0">🚨 Máquinas em Alerta</h3>' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px"><thead>' + thead + '</thead><tbody>' + alertRows + '</tbody></table>' +
      '<h3 style="color:#003057;margin-top:24px">📊 Resumo Completo do Dia</h3>' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px"><thead>' + thead + '</thead><tbody>' + reportRows + '</tbody></table>' +
      '<p style="color:#999;font-size:11px;margin-top:20px">Enviado automaticamente às ' +
      Utilities.formatDate(new Date(), tz, "HH:mm") + ' pelo Dashboard de Produção WEG.</p>' +
      '</div></div>';

    var email = Session.getActiveUser().getEmail();
    var subject = '⚠️ [Dashboard WEG] ' + alerts.length + ' máquina(s) abaixo de 80% — ' + dateFormatted;

    MailApp.sendEmail({ to: email, subject: subject, htmlBody: body });
    auditLog("SYSTEM", "DAILY_REPORT_SENT", { alerts: alerts.length, to: email, date: today });
    Logger.log("[sendDailyReport] E-mail enviado para " + email + ". " + alerts.length + " alerta(s).");

  } catch (err) {
    Logger.log("[sendDailyReport] ERRO: " + err.message + "\n" + err.stack);
    auditLog("SYSTEM", "DAILY_REPORT_ERROR", { error: err.message });
  }
}

// FIX: actionAppend — sempre cria nova linha, nunca substitui (usado pelo ConflictModal "criar novo apontamento")
function actionAppend(token, records) {
  const session = validateSession(token);
  if (!session) return { ok: false, error: "Sessão inválida ou expirada" };

  try {
    if (!records || records.length === 0) return { ok: false, error: "Nenhum registro fornecido" };

    const sheet = getProdSheet();

    records.forEach(function(rec, idx) {
      if (!rec.date || !rec.turno || !rec.machineId) {
        Logger.log("[APPEND] Registro " + idx + " ignorado - campos obrigatórios ausentes");
        return;
      }
      if (!VALID_TURNOS.includes(rec.turno)) {
        throw new Error("Turno inválido: " + rec.turno);
      }
      var dateStr = String(rec.date || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        throw new Error("Formato de data inválido: " + dateStr);
      }

      var rowData = PROD_HEADERS.map(function(header) {
        if (header === "id") return Utilities.getUuid();
        if (header === "date") return dateStr;
        if (header === "turno") return rec.turno;
        if (header === "machineId") return sanitizeNumber(rec.machineId, 1, 100);
        if (header === "machineName") return sanitizeString(rec.machineName, 100);
        if (header === "meta") return sanitizeNumber(rec.meta, 0, 1000000);
        if (header === "producao") return sanitizeNumber(rec.producao, 0, 100000);
        if (header === "savedBy") return sanitizeString(rec.savedBy, 50);
        if (header === "savedAt") return sanitizeString(rec.savedAt, 50);
        if (header === "editUser") return sanitizeString(rec.editUser || "", 50);
        if (header === "editTime") return sanitizeString(rec.editTime || "", 50);
        if (header === "obs") return sanitizeString(rec.obs || "", 500);
        return "";
      });

      sheet.appendRow(rowData);
      auditLog(session.nome, "RECORD_APPENDED", { date: rec.date, turno: rec.turno, machineId: rec.machineId });
    });

    SpreadsheetApp.flush();
    return { ok: true, appended: records.length };
  } catch (err) {
    logError("actionAppend", err);
    return { ok: false, error: err.message };
  }
}

function actionDelete(token, date, turno, machineId, id) {
  const session = validateSession(token);
  if(!session) {
    return { ok: false, error: "Sessão inválida ou expirada" };
  }

  try {
    if (!date || !turno || !machineId) {
      return { ok: false, error: "Parâmetros inválidos" };
    }

    const sheet = getProdSheet();
    const allData = sheet.getDataRange().getValues();

    // Usa posições fixas do PROD_HEADERS — igual ao actionGetAll
    // Isso garante consistência independente da ordem dos headers na planilha
    const idIdx    = PROD_HEADERS.indexOf("id");
    const dateIdx  = PROD_HEADERS.indexOf("date");
    const turnoIdx = PROD_HEADERS.indexOf("turno");
    const machIdx  = PROD_HEADERS.indexOf("machineId");

    let deleted = false;
    for (let i = allData.length - 1; i >= 1; i--) {
      const row = allData[i];
      var matched = false;

      // Busca por id (UUID único) — mais confiável
      if (id) {
        const rowId = String(row[idIdx] || "").trim();
        if (rowId && rowId === String(id)) matched = true;
      }

      // Fallback: busca por date/turno/machineId
      if (!matched) {
        var rawDate = row[dateIdx];
        var rowDate;
        if (rawDate instanceof Date) {
          rowDate = rawDate.getFullYear() + "-" +
            String(rawDate.getMonth()+1).padStart(2,"0") + "-" +
            String(rawDate.getDate()).padStart(2,"0");
        } else {
          rowDate = String(rawDate || "").trim();
        }
        const rowTurno  = String(row[turnoIdx] || "").trim();
        const rowMachId = String(row[machIdx]  || "").trim();
        if (rowDate === String(date) &&
            rowTurno === String(turno) &&
            rowMachId === String(machineId)) matched = true;
      }

      if (matched) {
        sheet.deleteRow(i + 1);
        deleted = true;
        auditLog(session.nome, "RECORD_DELETED", {id, date, turno, machineId});
        break;
      }
    }
    
    if (!deleted) {
      return { ok: false, error: "Registro não encontrado" };
    }
    
    SpreadsheetApp.flush();
    return { ok: true };
    
  } catch (err) {
    logError("actionDelete", err);
    return { ok: false, error: err.message };
  }
}