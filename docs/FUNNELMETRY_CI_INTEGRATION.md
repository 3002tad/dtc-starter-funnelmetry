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

The manually dispatched [funnelmetry-integration-propose.yml](../.github/workflows/funnelmetry-integration-propose.yml)
uses the same planner artifact only after the operator enters `APPLY`. It validates
the patch against a fixed generated-file allowlist. The target design is that the
customer creates `funnelmetry/integration/<name>` first; `propose` then checks out,
commits to, and pushes only that named branch. It does not open a PR, merge, deploy,
or alter any other branch. The current workflow still creates a review branch and
must be updated to the target-branch model before this behavior is claimed as
implemented.

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

## Review and release flow

1. Change the manifest in a branch and open a PR.
2. Download the generated patch artifact and review its ownership/capability report.
3. Create `funnelmetry/integration/<name>` from the reviewed host branch. After a
   host update, merge/rebase that host branch here before rerunning `plan`.
4. If approved, run **Funnelmetry integration propose**, supplying this target branch,
   a reviewed immutable Funnelmetry planner commit SHA, and `APPLY`.
5. Review the new commit in a normal source PR and merge it through the Medusa
   release process. A source fingerprint/layout mismatch must stop the workflow;
   it must not apply an old patch opportunistically.
6. The normal CI builds the host image. Browser write key and backend signing key
   are injected only at runtime from the customer secret manager.

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

The workflow references `3002tad/Funnelmetry@main`. Before enabling it on GitHub,
the Funnelmetry repository must contain the reviewed installer commit. The proposal
workflow requires an immutable commit SHA explicitly; do not provide `main` or any
other mutable branch. The current packages are still internal prototype packages,
so their registry or source-delivery mechanism must be established before a
generated branch is expected to pass a production host build.
