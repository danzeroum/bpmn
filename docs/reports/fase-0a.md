# Relatório — Fase 0a: Publicação da biblioteca no npm

> **Data:** 2026-07-22 · **Fase:** F0a (PLANO-buildtovalue-platform-v1.2, §5)
> **Status:** CONCLUÍDA com 1 pendência de decisão do dono (domain-example)

## Resumo

A publicação da biblioteca **já estava efetivada** quando esta fase começou: os 23 pacotes
públicos do monorepo foram publicados no npm pelo dono (`danzeroum`) em **2026-07-18**,
manualmente (fora do `release.yml` — o workflow tem zero execuções no GitHub Actions).
O objetivo da F0a ("pacotes instaláveis; D5 destravado") está atingido. Esta fase validou a
reprodutibilidade do release e documenta a lista publicada.

## Lista publicada (verificada no registry em 2026-07-22)

Todas as versões abaixo conferem **exatamente** com os `package.json` do repo na `main`:

| Pacote | Versão | | Pacote | Versão |
|---|---|---|---|---|
| @buildtovalue/adapters-bpmn | 1.1.0 | | @buildtovalue/identity | 1.0.1 |
| @buildtovalue/agentflow | 1.0.0 | | @buildtovalue/library | 1.0.0 |
| @buildtovalue/anchor-git | 1.0.1 | | @buildtovalue/library-react | 1.0.1 |
| @buildtovalue/anchor-rfc3161 | 1.0.1 | | @buildtovalue/lint | 1.1.0 |
| @buildtovalue/anchor-s3 | 1.0.1 | | @buildtovalue/react | 1.1.0 |
| @buildtovalue/audit | 1.1.0 | | @buildtovalue/registry | 1.0.1 |
| @buildtovalue/cli | 1.0.1 | | @buildtovalue/replay | 1.0.0 |
| @buildtovalue/conformance | 1.1.0 | | @buildtovalue/sfeel | 1.0.0 |
| @buildtovalue/copilot | 1.0.1 | | @buildtovalue/simulation | 1.0.1 |
| @buildtovalue/core | 1.1.0 | | @buildtovalue/soundness | 1.0.1 |
| @buildtovalue/dmn | 1.0.1 | | @buildtovalue/studio | 1.1.0 |

Fora do release (flag `private: true`, conforme pendências §1): `example`, `healthcare`.

## Validação de reprodutibilidade (equivalente local ao dry-run do release.yml)

O disparo do `release.yml` via API foi negado à integração (`403 Resource not accessible`),
então o gate do workflow foi executado **localmente na `main`**, passo a passo idêntico:

- `pnpm install --frozen-lockfile` ✅
- `pnpm check:no-runtime-deps` ✅ · `pnpm build` ✅ · `pnpm typecheck` ✅ (exit 0)
- `pnpm -r publish --access public --no-git-checks --dry-run` ✅ — resultado: **nenhum
  pacote publicado teria delta**; o único que o publish soltaria é `domain-example@1.0.0`
  (ver pendência abaixo). Privados pulados automaticamente.

## Pendências — RESOLVIDAS pelo dono em 2026-07-22

1. **`domain-example`: DECIDIDO — permanece privado.** `pendencias.md` §1 dizia privado; o
   commit `7258bb7` o deixara `public` no `package.json` (sem publicar). Decisão do dono:
   "publicar depois é fácil; despublicar não é" — `"private": true` **restaurado** neste
   branch. O entry de fixtures continua disponível via workspace para o corpus interno.
2. **`NPM_TOKEN` no Actions: ADICIONADO pelo dono.** Requisito firmado: antes do prerelease
   do engine (`1.1.0-next.N`, F0b.7), rodar o `release.yml` em dry-run **pelo Actions** (não
   só local) e anexar o link da execução aqui como evidência de pipeline reproduzível.
3. **Permissão de Actions para a integração:** o disparo via API segue negado (403) para
   esta integração — o dry-run do item 2 precisa ser disparado pelo dono na UI do Actions,
   ou conceder `actions: write` ao app para as próximas fases.

## Aceite da fase

- Pacotes instaláveis ✅ (verificado no registry)
- Releases reproduzíveis ✅ (gate local verde + dry-run sem deltas inesperados)
- Lista publicada documentada ✅ (este relatório)
