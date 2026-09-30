# Documentação do Banco de Dados — Dash de Produção

Esta pasta é a **fonte oficial** sobre o banco de dados do Dash de Produção (Supabase / PostgreSQL).
Ela registra **o que existe, como funciona, por que foi decidido assim e o que mudou**.

> **Estado atual do schema:** `v0.19.2` — implementado no Supabase (projeto de testes), com o histórico real carregado: 2.507 apontamentos de 20/12/2025 a 21/09/2026, 17.627.977 peças. Migrations em `supabase/migrations/`; importação em `supabase/import/`.
> A `0.17.1` não mexeu no schema: registra a **recuperação de senha por e-mail** (D45), que usa o Supabase Auth e depende de configuração no painel do projeto.
> A `0.18.0` e a `0.19.0` puseram a **meta que depende da lotação** no cálculo (D39/D46/D47): três bases — meta do turno, meta do turno rateada pela lotação, e meta por pessoa.
> O sistema em produção continua sendo Google Sheets + Google Apps Script (`Main.gs`).
