# Assurance case (SACM) — `bpmn-react certify --assurance-case`

Gera o relatório print-ready do assurance case (Handoff 5, F-C3) a partir do
snapshot BPMN e do ledger exportado:

```bash
bpmn-react certify processo.bpmn --assurance-case assurance.html --ledger ledger.json
# rótulo do cabeçalho parametrizado (§11.4) — nunca hardcoded no renderer:
bpmn-react certify processo.bpmn --assurance-case assurance.html --sacm-version "SACM 2.3"
```

## Invariante do gerador (Handoff 5 §11, literal)

> **"Todo conteúdo do assurance case é derivado do ledger, nunca digitado."**

- **Claims** e **arguments** são templates canônicos instanciados com a
  identidade da versão (nome, semver, status) — não há campo de texto livre.
- **Evidências** são exclusivamente entradas do ledger hash-encadeado e as
  aprovações de promoção (`approvedBy`), cada uma com seu hash de conteúdo.
- Um claim sem evidência renderiza **"não sustentado"** em `--btv-error`
  (aceite 10.5.8) — o gerador nunca inventa sustentação.
- A verificação SHA-256 da cadeia roda **na geração** e o resultado consta no
  rodapé de auditoria de todas as páginas.

## Regras de multipágina (§11.2, vinculantes)

- A tabela de evidências repete o header em cada quebra de página (`<thead>`
  nativo no print).
- Evidências agrupadas por argument (A1, A2, …) com **subtotal por grupo**.
- Acima de 20 evidências por argument, o corpo colapsa em
  "N evidências · faixa de hashes #x…#y" com o **anexo completo** ao final.
- Rodapé "página n/N" em todas as páginas (margin box `@page` para engines
  de paged media; o box fixo de auditoria imprime em toda página no Chromium).

## Sem dark mode (§11.3, exceção declarada)

O relatório permanece na base papel (`#FAF9F6`/tinta) mesmo sob
`prefers-color-scheme: dark` — documento de auditoria tem UMA aparência
canônica. `color-scheme: only light` é intencional; **não é bug**.

## Versão da spec (§11.4)

O rótulo do cabeçalho vem de `SACM_SPEC_VERSION` (`SACM 2.3` — versão formal
vigente em [omg.org/spec/SACM](https://www.omg.org/spec/SACM), adotada em
outubro/2023, confirmada na implementação) e é sobrescritível por
`--sacm-version` / `AssuranceCaseOptions.specVersion`.
