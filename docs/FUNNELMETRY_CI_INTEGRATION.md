# Funnelmetry CI integration

This repository has two intentionally separate integration workflows. Neither
workflow merges code, deploys, or receives runtime integration secrets.

## What runs in GitHub Actions

The workflow [funnelmetry-integration-plan.yml](../.github/workflows/funnelmetry-integration-plan.yml):

1. Checks out this Medusa repository.
2. Checks out the reviewed Funnelmetry planner release.
3. Reads the non-secret [funnelmetry.integration.yaml](../funnelmetry.integration.yaml).
4. Validates the pinned DTC Starter/Medusa version and generates two artifacts:
   `integration-plan.json` and `integration.patch`.

The planner rejects an artifact directory inside the Medusa checkout. The workflow
also has `contents: read`, so it cannot push, create PRs, or merge generated code.

The push-triggered [funnelmetry-integration-propose.yml](../.github/workflows/funnelmetry-integration-propose.yml)
runs when `funnelmetry.integration.yaml` changes on a pre-created
`funnelmetry/integration/<name>` branch. That manifest commit is the source owner's
authorization to apply the generated patch. `propose` validates the branch prefix,
checks out, commits to, and pushes only the current branch. It does not open a PR,
create another branch, merge, deploy, or alter any other branch. A rerun with an empty
planner patch ends as `no_changes` rather than creating an empty commit.

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

1. Change the manifest in a branch and open a PR.
2. Download the generated patch artifact and review its ownership/capability report.
3. Create `funnelmetry/integration/<name>` from the reviewed host branch. After a
   host update, merge/rebase that host branch here before rerunning `plan`.
4. Push the manifest change. **Funnelmetry integration propose** applies the generated
   patch to the same integration branch automatically.
5. Review the new commit in a normal source PR and merge it through the Medusa
   release process. A source fingerprint/layout mismatch must stop the workflow;
   it must not apply an old patch opportunistically.
6. The proposal workflow resolves the pinned private packages, installs with
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

`ingest.browser_url` is the non-secret endpoint embedded in the Browser SDK and must
be reachable from the shopper's browser. `ingest.backend_url` is embedded in the
Medusa subscriber and may be an internal/container-reachable endpoint. This split is
needed when the storefront browser reaches the host via `localhost` while a separate
backend container reaches it via `host.docker.internal` or an internal DNS name. The
bindings read the key names declared by `browser_write_key_ref` and
`backend_signing_key_ref`. For the browser, the configured write-key name is exposed
with the `NEXT_PUBLIC_` prefix; the backend signing key is never exposed to the
storefront. Do not put secret values in the manifest.

## Initial activation prerequisite

Before enabling either workflow, set the Medusa repository variable
`FUNNELMETRY_PLANNER_REF` to the reviewed 40-character Funnelmetry commit SHA. Both
workflows reject an empty, branch, tag, or other mutable reference.

The integration packages are distributed privately through GitHub Packages under
the `@3002tad` scope. Before `propose` or the integration build resolves them, grant
this Medusa repository Actions read access from each package's settings. The
committed `.npmrc` contains only the registry and `${NODE_AUTH_TOKEN}` reference;
it never contains the token value. Publication is restricted to a reviewed
`integration-kit-v<version>` tag in the Funnelmetry repository.
