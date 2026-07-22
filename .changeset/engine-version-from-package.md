---
'@buildtovalue/engine': patch
---

ENGINE_VERSION agora é derivada do package.json no build (scripts/sync-version.mjs gera src/version.ts; version-packages re-sincroniza; teste de sincronia trava deriva). Corrige a divergência constante (1.1.0-next.0) × pacote publicado (1.1.0-next.1) — a versão gravada por instância é a que replay (D6) e StateMigrator (D14) usam.
