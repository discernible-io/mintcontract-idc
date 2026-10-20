# Security And Compliance Improvements

> **Before editing:** Review [`documentation-standard.md`](../docs/docs/documentation-standard.md).

**Created:** 2026-05-24

This document lists improvements for this repository from a security and compliance point of view, ordered from lowest effort / lowest implementation risk to highest effort / highest implementation risk.

Reference standards reviewed from `../docs`:

- `configuration-standard.md`
- `cicd-deployment-standard.md`
- `allowed-fallback-standard.md`
- `logging-standard.md`
- `error-handling-standard.md`
- `test-constitution.md`
- `documentation-standard.md`
- `vocabulary-standard.md`
- `rpc-configuration.md`
- `planned-improvements.md`
- `frontend-branch-env-migration.md`

Scope reviewed in this repository:

- Contract code under `src/`
- Operator scripts: `deploy.sh`, `monitor_contract.sh`, `secure_credentials.sh`, `list_authorized_signers.sh`
- GitHub Actions workflow: `.github/workflows/deploy.yml` (tracked in git; deleted on disk but not yet committed as a removal)
- Repository documentation: `README.md`
- Ignore and tracked-file posture: `.gitignore`, `Cargo.lock`, `account.env`

## 1. Stop Tracking Local Account Configuration

Effort/risk: very low effort, low implementation risk.

`account.env` is tracked by git, while `README.md` and `secure_credentials.sh` both say local account configuration should be ignored. This conflicts with the configuration standard's separation between committed non-secret configuration and host/local secret material.

Recommended change:

- Add `account.env` to `.gitignore`.
- Remove `account.env` from version control with `git rm --cached account.env`.
- Rotate any key, token, account, or signer value that may have been exposed through git history.
- Update `list_authorized_signers.sh` to accept the contract name as an argument or from an environment variable, with `account.env` as an optional local convenience file only.

Why it matters:

- Prevents local deployment/account context from becoming a repository secret.
- Brings the repo closer to `configuration-standard.md` and `cicd-deployment-standard.md` guidance that secrets and runtime credentials stay outside git.

## 2. Add The Missing Security And Operations Documents Referenced By README

Effort/risk: low effort, low implementation risk.

`README.md` references `SECURITY.md`, `DEPLOYMENT_CHECKLIST.md`, `AUTHORIZED_SIGNERS.md`, and `emergency_pause.sh`, but those files do not exist in this repo.

Recommended change:

- Add `SECURITY.md` with responsible disclosure guidance and a "do not open public issues for vulnerabilities" rule.
- Add `DEPLOYMENT_CHECKLIST.md` covering testnet first, signer review, upgrade delay, contract status, fee checks, and post-deploy monitoring.
- Add `AUTHORIZED_SIGNERS.md` documenting how signers are managed without listing private material.
- Either add `emergency_pause.sh` or remove references to it and document the direct `pause_contract` / `resume_contract` commands.
- If any new file is placed under `docs/`, include the editor notice blockquote and a visible creation date immediately after the title, per `documentation-standard.md` principles 15 and 16.

Why it matters:

- Fixes documentation drift.
- Satisfies `documentation-standard.md` principle 10 (Complete Indexing): every document must be discoverable through `README.md`. Orphaned references violate this.
- Satisfies principle 11 (Meaningful Cross-References): references should only exist when the target materially improves reader outcomes.
- Gives operators a clear security runbook before incident response is needed.

## 3. Align `.gitignore` With Reproducible Rust Contract Builds

Effort/risk: low effort, low implementation risk.

`.gitignore` ignores `Cargo.lock`, but `Cargo.lock` is currently tracked. For deployable Rust applications and smart contracts, keeping `Cargo.lock` committed is usually the safer reproducibility posture.

Recommended change:

- Keep `Cargo.lock` tracked.
- Remove `Cargo.lock` from `.gitignore`.
- Document that dependency updates must be intentional and reviewed.

Why it matters:

- Reduces accidental dependency drift.
- Supports auditable contract builds and more predictable CI output.

## 4. Replace Ad Hoc Script Parsing With Safer Shell Patterns

Effort/risk: low effort, low implementation risk.

`list_authorized_signers.sh` uses unguarded `source account.env` and parses CLI output with `grep` / `sed`. `deploy.sh` also performs CLI configuration checks with text parsing. These are small but avoidable reliability and injection risks.

Recommended change:

- Use `set -euo pipefail` in shell scripts where practical.
- Quote every variable used in commands.
- Validate any sourced config path before loading it.
- Prefer `near ... --output json` or structured output where available, then parse with `jq`.
- Avoid sourcing `account.env`; use explicit arguments or a strict `KEY=value` loader that only accepts expected keys.

Why it matters:

- Reduces accidental command injection and parsing errors.
- Supports `allowed-fallback-standard.md`: any fallback pattern beyond config and RPC fallback is forbidden, and even allowed fallbacks must be logged with enough context to audit the decision.

## 5. Make RPC Selection Explicit And Auditable

Effort/risk: low effort, low implementation risk.

`deploy.sh` silently switches `mainnet` and `testnet` to FastNEAR-backed connection names when no custom RPC URL is supplied. The sibling RPC/fallback standards allow RPC fallback, but require the fallback path to be intentional and logged.

`rpc-configuration.md` documents the `NEAR_NETWORK_CONFIG` environment variable and available network configs (`mainnet-lava`, `mainnet-fastnear`, etc.) for the `roditwallet.sh` script. The same explicit-selection pattern should apply to deploy-time RPC usage.

Recommended change:

- Treat the selected RPC/network connection as an explicit deploy input.
- Log whether a default, configured, or custom RPC endpoint is being used.
- Adopt the `NEAR_NETWORK_CONFIG` pattern from `rpc-configuration.md` so `deploy.sh` uses the same mechanism as `roditwallet.sh`.
- Avoid silently creating new NEAR CLI network connections during deployment unless the operator passed an explicit flag.
- Add a short `RPC selection` section to `README.md`.

Why it matters:

- Makes deployments easier to audit.
- Prevents accidental deployment against an unexpected network connection.
- Aligns with `allowed-fallback-standard.md`: whenever an allowed fallback is taken, it must be logged with enough context to audit the decision. Silent fallbacks are forbidden.

## 6. Fix README Drift Against The Current Contract Code

Effort/risk: low to medium effort, low implementation risk.

`README.md` contains several conflicts with the current source:

- It says the upgrade delay is 24 hours in many places, while `src/upgrade.rs` defaults to 30 seconds.
- It says the rate limit is 1 hour / 10 or 100 mints in later sections, while `src/lib.rs` uses 2 hours / 200 mints.
- It documents facial token character sets and category values that differ from `src/token_validation.rs`.
- It says `minting_permanently_disabled` uses `#[borsh(default)]`, but the current `Contract` field does not show that annotation.
- It references non-existing operational docs and scripts.
- It includes repeated or stale deployment instructions using different build outputs and NEAR CLI styles.

Recommended change:

- Make source code the single source of truth for constants and behavior.
- Move long examples and future ideas into focused files if they are still needed.
- Add a compact documentation index to `README.md`.
- Mark planned work as planned, not implemented.

Why it matters:

- Reduces operator mistakes during mainnet upgrades.
- Aligns with `documentation-standard.md` principles 1 (Single Source of Truth), 2 (No Duplication), and 10 (Complete Indexing).
- `vocabulary-standard.md` requires saying **main** (not *production*, *prod*, or *live*) for the deployment tier; README documentation should follow this.

## 7. Modernize And Harden The GitHub Actions Workflow

Effort/risk: medium effort, low to medium implementation risk.

`.github/workflows/deploy.yml` (tracked in git; deleted on disk but not committed as a removal) currently auto-runs on pushes to `main`, uses older/unmaintained actions (`actions/checkout@v3`, `actions/cache@v3`, `actions-rs/toolchain@v1`), downloads tooling with `curl`, installs the npm `near-cli`, and writes one monolithic `${{ secrets.NEAR_CREDENTIALS }}` value to `~/.near-credentials/credentials.json`. The workflow has no secret-scanning gate, no supply-chain freshness check, no explicit `permissions` block, and runs build+deploy in a single job.

Recommended change:

- Add explicit workflow `permissions` with least privilege (`contents: read`, `packages: write` for build; `contents: read` for deploy).
- Upgrade to maintained actions: `actions/checkout@v4`, remove `actions-rs/toolchain@v1` (unmaintained), pin third-party actions and binaries by version and checksum.
- Add a **Gitleaks** secret-scanning step as a mandatory gate before any build or deploy step, per `cicd-deployment-standard.md` guidance on [Secret scanning with Gitleaks]. Add a `.gitleaks.toml` with reviewed allowlists for documented non-secrets only.
- Split the workflow into two jobs: `build-and-verify` (checkout, secret scan, build, test, optimize WASM) and `deploy` (gated by `workflow_dispatch` or GitHub Environment approval for mainnet).
- Use `rust-toolchain.toml` consistently instead of `stable` if contract builds depend on a specific toolchain.
- Prefer `near-cli-rs` if local deployment scripts and docs rely on it.
- Store credentials per environment/account instead of one broad `NEAR_CREDENTIALS` secret. Use per-branch secrets with `_MAIN` / `_DEVELOPMENT` suffixes per `vocabulary-standard.md`.
- Clean up credential files at the end of the job (post-step or `always()` cleanup).
- Add `--depositYocto 1` to calls such as `resume_contract` when the contract requires the 1 yocto guard.
- Decide whether to commit or remove the `deploy.yml` deletion: the file is tracked in git but deleted on disk, which is ambiguous.

Why it matters:

- Brings the workflow closer to `cicd-deployment-standard.md`, which now requires Gitleaks as a mandatory gate and explicit `permissions` blocks.
- Reduces supply-chain and credential exposure risk.
- Prevents CI from bypassing manual review before mainnet deployment.
- `vocabulary-standard.md` requires using **main** (not *production*) for the deployment tier name.

## 8. Make Mainnet Upgrade Delay Match The Security Claim

Effort/risk: medium effort, medium implementation risk.

The contract and deployment scripts currently default to a 30-second upgrade delay. The README repeatedly claims 24-hour mainnet delay behavior. A 30-second delay is useful for development, but it is not the security review window described in the docs.

Recommended change:

- Set the contract default upgrade delay to 24 hours for mainnet deployments, or make the delay explicitly configured during initialization / deployment.
- Raise `MIN_UPGRADE_DELAY_SECONDS` for mainnet-safe deployments.
- Update `deploy.sh` to read the on-chain delay from `get_upgrade_status` instead of hardcoding `UPGRADE_DELAY_SECONDS=30`.
- Add a deployment checklist step that verifies `get_upgrade_status` and `get_config` before any main upgrade.

Why it matters:

- Restores the time-lock security property described in the docs.
- Gives operators time to notice and cancel unsafe upgrade proposals.

## 9. Require `owneraccount_id` In Signed Fee Payloads

Effort/risk: medium effort; **medium–high rollout risk** (coordinate SignPortal / signclient before or with contract upgrade). CodeCome **CC-0004** rates finding **HIGH** (CVSS 8.2, EXPLOITED on NEAR sandbox). Operator judgment: the mempool/race front-run is **hard for attackers to win**, so operational risk aligns with README “known low-risk gap” on likelihood; impact if won remains high (passport ownership hijack).

`rodit_mint` validates `owneraccount_id` only if it is present in `fee_data_json`. Production-shaped fee JSON signs `{token_id, mintingfee, mintingfeeaccount}` only, so an intercepted fee signature *could* be front-run with a different `owneraccount_id`. Local audit package: `security-audit/CC-0004/` (gitignored; harness under `~/CodeCome`).

Recommended change:

- Make `owneraccount_id` mandatory in `fee_data_json` (always `require!`, not optional).
- Include `owneraccount_id` in the canonical signed payload generated by all signing services.
- Add tests that prove mismatched owner, token id, fee account, and fee value are rejected.
- Publish a short migration note for clients that still sign the legacy three-field payload (deploying the contract fix alone breaks those mints).

Why it matters:

- Binds the signature to the actual intended recipient.
- Removes a known security gap rather than preserving a risky compatibility path.

## 10. Strengthen Metadata Validation To Be Strict By Default

Effort/risk: medium effort, medium implementation risk because accepted metadata may narrow.

Several validators search for valid substrings instead of validating the whole input. Examples include date, URL, CIDR, and ISO country code checks. `validate_url` also allows `localhost`, and `validate_iso3166` accepts any string containing `WLD`.

Recommended change:

- Anchor validators to the full input where the metadata field is supposed to contain one value.
- Treat comma-separated lists and JSON policy objects as parsed data, not substring matches.
- Decide whether `localhost` should be test-only and reject it for mainnet metadata.
- Add negative tests for prefix/suffix smuggling such as `bad https://example.com trailing`.

Why it matters:

- Prevents malformed policy metadata from being minted on-chain.
- Better matches the README claim of comprehensive input validation.

## 11. Replace The Current Unit Test Harness With Real NEAR SDK Test Contexts

Effort/risk: medium effort, medium implementation risk.

The tests in `src/lib.rs` use a `mock_env` helper that does not actually set NEAR predecessor/deposit context. Some tests call payable owner-only methods without the required 1 yocto deposit. `src/token_validation.rs` tests also reference `decode_facial_token_id`, but that function is not defined in the file.

Recommended change:

- Use `near-sdk` test utilities to set predecessor, signer, attached deposit, and block timestamp.
- Fix or remove tests that reference missing functions.
- Add tests for 1 yocto guards, owner-only functions, upgrade delay, rate limits, signature binding, storage accounting, and validation edge cases.
- Use real cryptographic signatures (Ed25519) in signature-related tests rather than fake or placeholder values, per `test-constitution.md` cryptographic signature requirements.
- Report test outcomes as **passed** or **not-passed** (not "success/failure"), per `test-constitution.md` terminology.
- Do not alter protocol-critical formats (timestamp format, signed message construction, signature encoding) during debugging, per the Protocol-Sensitive Rule.
- Run the suite in CI before deployment.

Why it matters:

- Aligns with `test-constitution.md`: tests must exercise real behavior and must not mock away protocol-sensitive paths. The constitution now requires real cryptographic signatures, SDK-first test patterns, and findings-first reporting.
- Reduces the chance that security-sensitive assumptions pass tests without being exercised.

## 12. Make Fee Signature Verification An Internal Helper Unless A Public Oracle Is Intended

Effort/risk: medium effort, medium to high implementation risk if external clients call this method directly.

`verify_fee_signature` is exposed as a contract method because it is `pub` inside the `near_bindgen` implementation. It accepts arbitrary messages and signatures, checks against all authorized signers, and returns detailed failure reasons. If this method is not intentionally part of the public API, it should be internal.

Recommended change:

- Move signature verification into a private helper outside the public contract API.
- If public verification is intentional, document it in `README.md` and add tests that define what information it may reveal.
- Keep failure messages useful but avoid exposing unnecessary signer or payload internals.

Why it matters:

- Shrinks the public contract surface.
- Avoids exposing an unintended verification oracle.

## 13. Add State Migration Resilience Before The Next Layout Change

Effort/risk: high effort, high implementation risk.

`upgrade()` currently deserializes prior state directly as the current `Contract` type. That is fragile when fields are added, removed, or reordered. The README already suggests a future `ContractLegacyState` migration path, but it is not implemented.

Recommended change:

- Add explicit legacy state structs for known deployed layouts.
- Implement a migration function that can deserialize known old layouts and rebuild the current state.
- Add tests that serialize old layouts and upgrade them into the current contract.
- Document exactly which deployed versions can upgrade safely.

Why it matters:

- Prevents contract bricking during upgrades.
- Supports the upgrade discipline described by the deployment and security documentation.

## 14. Move Toward Reproducible, Reviewable Contract Artifacts

Effort/risk: high effort, high implementation risk because it changes release workflow.

Local `deploy.sh` uses `cargo near build non-reproducible-wasm --no-abi`, while CI uses `cargo build` plus `wasm-opt`. The produced WASM paths and toolchains differ across README, scripts, and workflow.

The sibling `../docs` repository now includes a `signatures/` directory with a release signing model: `RELEASE_SIGNING_KEY.asc` (OpenPGP public key), `SHA256SUMS` (checksums for distributed packages), and `SHA256SUMS.asc` (detached signature over checksums). This pattern can be adopted for contract WASM artifacts.

Recommended change:

- Pick one canonical release build path.
- Record tool versions for Rust, `cargo-near`, `wasm-opt`, and NEAR CLI.
- Produce and publish a WASM SHA-256 hash before deployment, following the `signatures/SHA256SUMS` pattern from `../docs`.
- Consider signing release WASM artifacts with a detached OpenPGP signature, mirroring `signatures/SHA256SUMS.asc`.
- Require review/approval of the hash before mainnet deployment.
- Document how to reproduce the release artifact from a clean checkout.

Why it matters:

- Makes contract deployments auditable.
- Reduces supply-chain and accidental-build-drift risk.
- Aligns with the release signing model already established in `../docs/signatures/`.

## 15. Add Secret Scanning With Gitleaks

Effort/risk: low effort, low implementation risk.

The repository has no Gitleaks configuration or CI secret-scanning step. `account.env` is tracked with account identifiers, and credential material has historically been present in git history. `cicd-deployment-standard.md` now requires Gitleaks as a mandatory gate in `build-images` before any build, install, or deploy step.

Recommended change:

- Add a `.gitleaks.toml` at the repo root with narrow allowlists for documented non-secrets only (for example, contract account names that look like secrets but are public identifiers).
- Add a Gitleaks step to the GitHub Actions workflow (or create a new workflow if `deploy.yml` is removed) that runs `gitleaks detect --source . --verbose --redact` after checkout and before any build step.
- Run Gitleaks locally before push as an early-feedback habit: `gitleaks detect --source . --verbose --redact`.
- If Gitleaks finds real secrets in git history, rotate them and treat them as compromised even if the commit is reverted.

Why it matters:

- `cicd-deployment-standard.md` now treats Gitleaks as a required CI gate alongside `enforce-minimum-package-age.js`. The same severity applies: any finding must fail the job before content reaches a deployed artifact.
- Complements `.gitignore` and `secrets.env` host-only controls; detects secrets already present in tracked files or history.

## Verification Notes

Static review was completed against the files listed above and updated against the latest `../docs` standards as of 2026-05-25. Standards that have significantly expanded since the original review include `cicd-deployment-standard.md` (Gitleaks, slim images, systemd linger, APP_DIR), `documentation-standard.md` (principles 12–16), `test-constitution.md` (SDK-first, protocol-sensitive, findings-first), and the addition of `planned-improvements.md`, `frontend-branch-env-migration.md`, and `signatures/`. I attempted to run `cargo test`, but the environment did not have `cargo` installed, so no local build/test result is included in this review.
