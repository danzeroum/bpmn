# Releasing to npm (item I-6)

This is the exact, owner-side runbook to publish the `@buildtovalue/*` packages
to npm. Everything a human must do — and only that — is here. The pipeline
itself lives in [`.github/workflows/release.yml`](.github/workflows/release.yml)
(manual trigger, dry-run by default).

> **Scope correction:** an older comment in `release.yml` still mentions the
> pre-rename scope `@bpmn-react`. The packages were renamed to **`@buildtovalue`**
> (see `pendencias.md` / the rename PR). The scope you must own and reserve on
> npm is **`@buildtovalue`**, not `@bpmn-react`.

## What gets published

`pnpm -r publish` publishes every non-private workspace package and skips the
private ones automatically. Today that is **18 public packages** at `1.0.0`:

```
@buildtovalue/adapters-bpmn   @buildtovalue/anchor-git      @buildtovalue/anchor-rfc3161
@buildtovalue/anchor-s3       @buildtovalue/audit           @buildtovalue/cli
@buildtovalue/conformance     @buildtovalue/copilot         @buildtovalue/core
@buildtovalue/dmn             @buildtovalue/identity        @buildtovalue/library
@buildtovalue/library-react   @buildtovalue/react           @buildtovalue/registry
@buildtovalue/replay          @buildtovalue/sfeel           @buildtovalue/simulation
@buildtovalue/soundness       @buildtovalue/studio
```

Skipped (`"private": true`): `@buildtovalue/example`, `@buildtovalue/domain-example`,
`@buildtovalue/healthcare`.

Each public package already sets `"publishConfig": { "access": "public" }`, so
scoped packages publish publicly without extra flags.

---

## Step 0 — Own the scope on npm (one time)

1. Sign in at <https://www.npmjs.com> with an account (or org) you control.
2. Create the org/scope **`@buildtovalue`**:
   - Personal scope: it exists implicitly once you publish under `@<your-user>`;
     for an **org** scope, create the org at
     <https://www.npmjs.com/org/create> named `buildtovalue`.
3. Confirm the name is free / yours: `npm view @buildtovalue/core` should 404
   before the first release (or show your package after).

Enable 2FA on the account (npm requires it for publishing). Use an **automation**
token (below) so 2FA doesn't block CI.

---

## Step 1 — Choose an auth method

### Path A — Automation token (simplest; recommended for the first release)

1. npm → your avatar → **Access Tokens** → **Generate New Token** →
   **Granular Access Token** (or Classic → *Automation*).
   - Type: **Automation** (bypasses 2FA in CI).
   - Permissions: **Read and write** for the `@buildtovalue` scope/packages.
   - Expiration: set a calendar reminder to rotate it.
2. Copy the token (starts with `npm_…`; shown once).
3. In GitHub: repo → **Settings → Secrets and variables → Actions → New
   repository secret**:
   - Name: **`NPM_TOKEN`**  (must match `secrets.NPM_TOKEN` in the workflow)
   - Value: the token from step 2.

The workflow already wires `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` with
`registry-url: https://registry.npmjs.org`, so nothing else is needed for a
token-based publish.

### Path B — OIDC "trusted publishing" (no long-lived token)

npm can trust this GitHub workflow directly, so no `NPM_TOKEN` is stored. This
requires the package to **already exist** on npm, so use it only *after* the
first release (which must go out via Path A). For each package: npm package page
→ **Settings → Trusted Publisher → GitHub Actions**, and enter:
`danzeroum/bpmn`, workflow `release.yml`, environment (leave blank). With
trusted publishing configured, remove the `NODE_AUTH_TOKEN` env from the publish
step. Provenance is then attached automatically.

---

## Step 2 — Turn on provenance (one small workflow edit)

The current `release.yml` does **not** yet request provenance. To get the npm
provenance attestation (the green "Built and signed on GitHub Actions" badge),
apply this change to `.github/workflows/release.yml`:

```yaml
 jobs:
   publish:
     runs-on: ubuntu-latest
     permissions:
       contents: read
+      id-token: write          # OIDC — required for npm provenance
     steps:
       ...
       - name: Publish to npm
         run: >
           pnpm -r publish --access public --no-git-checks
+          --provenance
           ${{ inputs.dry_run && '--dry-run' || '' }}
         env:
           NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Notes:
- `id-token: write` lets the job mint the OIDC token npm uses to sign provenance.
- `--provenance` (equivalently `NPM_CONFIG_PROVENANCE: true`) tells npm to build
  and publish the attestation. It needs npm ≥ 9.5 — the workflow's Node 22
  satisfies this.
- Provenance requires a **public** repo and public packages; both hold here.
- `--dry-run` skips the actual publish AND provenance, so validate first (Step 3)
  then do the real run (Step 4).

---

## Step 3 — Dry run (validate everything, publish nothing)

1. GitHub → **Actions → Release → Run workflow**.
2. Leave **Dry run = true** (the default). Run it.
3. The job runs the full gate (`check:no-runtime-deps`, `pnpm audit`, lint,
   build, typecheck, `test:coverage`), generates the CycloneDX SBOM artifact,
   and runs `pnpm -r publish … --dry-run`.
4. Confirm the log lists each of the 18 packages as *would publish* with the
   right version, and that **no** private package appears. Download the
   **`sbom-cyclonedx`** artifact if you want the bill of materials on file.

If the dry run is green, you are ready to release.

---

## Step 4 — Real release

1. **Actions → Release → Run workflow**, set **Dry run = false**, run it.
2. The same gate runs, then `pnpm -r publish --access public` publishes all 18
   packages to npm.
3. Watch the log for `+ @buildtovalue/<pkg>@1.0.0` lines and any per-package
   errors (e.g. a name already taken, or a missing `dist` — the build step
   guards against the latter).

### Bumping versions for later releases

`pnpm -r publish` refuses to republish a version that already exists. For the
next release, bump versions first (all packages move together here):

```bash
pnpm -r exec npm version patch   # or: minor / major
git commit -am "release: vX.Y.Z" && git push
```

Then re-run the workflow (Step 3 → Step 4).

---

## Step 5 — Verify on npm

For a spot check (e.g. the main package):

```bash
npm view @buildtovalue/react version         # prints 1.0.0
npm view @buildtovalue/react dist.tarball     # the published artifact URL
```

**Provenance:**
- On each package page at `https://www.npmjs.com/package/@buildtovalue/<pkg>`,
  look for the **"Provenance"** panel — it links the exact source commit and the
  `release.yml` run that built it.
- From the CLI, verify the signed attestations across installed deps:

  ```bash
  npm audit signatures
  ```

  It reports how many packages have verified registry signatures and provenance.

**SBOM:** the CycloneDX SBOM is attached to each workflow run as the
`sbom-cyclonedx` artifact (Actions → the run → Artifacts).

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `402 Payment Required` on publish | Scoped package defaulting to private — ensure `publishConfig.access=public` (already set) and, for a token, that it has write access to the scope. |
| `403 Forbidden` / `you must be logged in` | `NPM_TOKEN` missing, expired, or lacks write scope. Regenerate (Step 1A). |
| `ENEEDAUTH` in the log | `registry-url` not set for the auth step — it already is (`setup-node`), so this usually means the secret name isn't exactly `NPM_TOKEN`. |
| Provenance panel absent after release | The workflow ran without `id-token: write` **or** `--provenance` (Step 2), or `--dry-run` was still on. |
| `E409 Conflict` / cannot publish over existing version | Version already on npm — bump versions (Step 4) and re-run. |
| A private package tried to publish | It shouldn't — `pnpm -r publish` skips `"private": true`. If you see it, check that package's `private` flag. |

Everything else — the quality gate, SBOM, dry-run safety — is automated in the
workflow; your part is Steps 0–5.
