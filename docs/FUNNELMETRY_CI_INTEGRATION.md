# Funnelmetry CI integration

This repository uses a review-only integration workflow. It does not change
Medusa application files, open a pull request, merge code, deploy, or receive
runtime secrets.

## What runs in GitHub Actions

The workflow [funnelmetry-integration-plan.yml](../.github/workflows/funnelmetry-integration-plan.yml):

1. Checks out this Medusa repository.
2. Checks out the reviewed Funnelmetry planner release.
3. Reads the non-secret [funnelmetry.integration.yaml](../funnelmetry.integration.yaml).
4. Validates the pinned DTC Starter/Medusa version and generates two artifacts:
   `integration-plan.json` and `integration.patch`.

The planner rejects an artifact directory inside the Medusa checkout. The workflow
also has `contents: read`, so it cannot push, create PRs, or merge generated code.

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
3. If approved, a developer applies the patch in a separate source PR, reviews it,
   and merges it through the normal Medusa release process.
4. The normal CI builds the host image. Browser write key and backend signing key
   are injected only at runtime from the customer secret manager.

`ingest.url` is intentionally a placeholder until an environment-specific ingress
endpoint exists. Do not put secret values in the manifest.

## Initial activation prerequisite

The workflow references `3002tad/Funnelmetry@main`. Before enabling it on GitHub,
the Funnelmetry repository must contain the reviewed installer commit. For a real
deployment, replace `main` with an immutable release tag or commit SHA.
