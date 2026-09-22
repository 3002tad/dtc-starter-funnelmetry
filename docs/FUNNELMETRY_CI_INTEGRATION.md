# Funnelmetry CI integration

This repository has two intentionally separate integration workflows. The manifest
is the source of truth; neither workflow merges, deploys, or receives runtime
integration secrets.

## What runs in GitHub Actions

The push-triggered [funnelmetry-integration-propose.yml](../.github/workflows/funnelmetry-integration-propose.yml)
runs when `funnelmetry.integration.yaml` changes on a pre-created
`funnelmetry/integration/<name>` branch. That manifest commit is the source owner's
authorization to apply the generated patch only to that same branch. It validates the
pinned Medusa version, generates `integration-plan.json` and `integration.patch`
outside the checkout, checks the generated-file allowlist, resolves private packages,
builds/type-checks the host, then commits to and pushes only that target branch. It
uploads an audit artifact; a rerun with an empty planner patch ends as `no_changes`.

[funnelmetry-integration-plan.yml](../.github/workflows/funnelmetry-integration-plan.yml)
runs read-only when the manifest is pushed on the integration branch. It uses the
same pinned planner to record `integration-plan.json`, validate that the generated
patch applies, list the planned files in the workflow summary, and upload the plan
artifact. It is an informational check, not a pre-apply approval gate, and it does
not alter source code.

## Private Funnelmetry repository access

Because `3002tad/Funnelmetry` is private, configure the Medusa repository secret
`FUNNELMETRY_PLANNER_READ_TOKEN` before running the workflow. Use a fine-grained
personal access token or GitHub App installation token with only **Contents: Read**
on the Funnelmetry repository; do not grant write, workflow, package, organization
or broad account access. The token is consumed only by the second checkout step and
must never be put in `funnelmetry.integration.yaml`.

GitHub does not expose repository secrets to pull requests from forks, so a fork PR
will not run the private planner checkout. Do not replace `pull_request` with
`pull_request_target` just to make the secret available.

The automatic apply workflow runs on a direct push and therefore executes the workflow
definition from that integration branch. Enable it only for trusted source owners or
maintainers who are allowed to change the workflow; do not use it as a workflow for
untrusted external contributions. Branch protection and a least-privilege planner token
remain required even though the token only reads the private Funnelmetry repository.

## Review and release flow

1. Create `funnelmetry/integration/<name>` from the chosen host base branch, then
   change and push the manifest on that trusted integration branch.
2. **Funnelmetry integration plan** reads the YAML and records/checks the exact
   patch implied by it. In parallel, **Funnelmetry integration propose** regenerates
   that patch, validates its ownership allowlist, injects it, validates the host,
   then commits and pushes only to the same pre-created branch. Neither workflow
   creates a branch, and plan is not an approval gate for propose.
3. Use the integration branch as the source of the normal Medusa release/deploy flow.
   A source fingerprint/layout mismatch must stop the workflow; it must not apply an
   old patch opportunistically.
4. The proposal workflow resolves the pinned private packages, installs with
   `--frozen-lockfile`, builds the Medusa backend, type-checks the storefront binding,
   and only then commits the updated `pnpm-lock.yaml`. A full Next.js production build
   also needs a running, seeded Medusa API because the DTC starter generates catalog
   pages from live data; that runtime-level check belongs to the next integration gate.
   The browser write key is injected at storefront build time; the backend signing
   key is injected only into the backend runtime. Neither is a package credential.

Protect `main` and other important branches with a GitHub ruleset/branch protection.
`contents: write` is a repository-level token permission; workflow input checks are
not a substitute for repository-side protection.

## Technical integration rollout (optional experiment)

This is a technical canary/blue-green comparison, not an A/B testing platform for
marketing or a causal claim about conversion. Deploy a control build without the
binding and a treatment build with it, assign traffic persistently (for example by
cookie or edge), and keep business logic identical. Compare host p95 latency,
errors, CPU/RAM, bandwidth, event/receipt/duplicate/retry/loss, and checkout/order
success. The control build cannot establish funnel-behavior causality because it
does not emit Browser SDK data. If both variants emit to Funnelmetry, isolate their
analysis with an approved source partition or experiment label before aggregating.

`ingest.url` is intentionally a placeholder until an environment-specific ingress
endpoint exists. The generated binding embeds this non-secret endpoint and reads
the key names declared by `browser_write_key_ref` and `backend_signing_key_ref`.
For the browser, the configured write-key name is exposed with the `NEXT_PUBLIC_`
prefix; the backend signing key is never exposed to the storefront. Do not put
secret values in the manifest.

## Initial activation prerequisite

Before enabling either workflow, set the Medusa repository variable
`FUNNELMETRY_PLANNER_REF` to the reviewed 40-character Funnelmetry commit SHA. Both
workflows reject an empty, branch, tag, or other mutable reference.

The integration packages are distributed privately through GitHub Packages under
the `@3002tad` scope. Before `propose` resolves them, grant this Medusa repository
Actions read access from each package's settings. The committed `.npmrc` contains
only the registry and `${NODE_AUTH_TOKEN}` reference; it never contains the token
value. Publication is restricted to a reviewed `integration-kit-v<version>` tag in
the Funnelmetry repository.

If package Actions access cannot be delegated to this repository, add the repository
secret `FUNNELMETRY_PACKAGE_READ_TOKEN`. Its value must be a fine-grained token with
**Packages: Read** and access to the private Funnelmetry packages (or a classic PAT
with `read:packages` and the repository access required by GitHub Packages). Never
use a deploy key, a runtime signing key, or a browser write key here. The `propose`
workflow prefers this secret and falls back to `GITHUB_TOKEN` only when package
access has explicitly been granted.
