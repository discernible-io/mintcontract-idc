# Security And Compliance Improvements

This document lists improvements for this repository from a security and compliance point of view, ordered from lowest effort / lowest implementation risk to highest effort / highest implementation risk.

Reference standards reviewed from `../docs`:

- `configuration-standard.md`
- `cicd-deployment-standard.md`
- `allowed-fallback-standard.md`
- `logging-standard.md`
- `error-handling-standard.md`
- `test-constitution.md`
- `documentation-standards.md`
- `vocabulary-standard.md`
- `rpc-configuration.md`

Scope reviewed in this repository:

- Contract code under `src/`
- Operator scripts: `deploy.sh`, `monitor_contract.sh`, `secure_credentials.sh`, `list_authorized_signers.sh`
- GitHub Actions workflow: `.github/workflows/deploy.yml`
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

Why it matters:

- Fixes documentation drift.
- Satisfies `documentation-standards.md` expectations around discoverability and non-orphaned references.
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
- Supports the `allowed-fallback-standard.md` preference for explicit, observable behavior over implicit secondary paths.

## 5. Make RPC Selection Explicit And Auditable

Effort/risk: low effort, low implementation risk.

`deploy.sh` silently switches `mainnet` and `testnet` to FastNEAR-backed connection names when no custom RPC URL is supplied. The sibling RPC/fallback standards allow RPC fallback, but require the fallback path to be intentional and logged.

Recommended change:

- Treat the selected RPC/network connection as an explicit deploy input.
- Log whether a default, configured, or custom RPC endpoint is being used.
- Avoid silently creating new NEAR CLI network connections during deployment unless the operator passed an explicit flag.
- Add a short `RPC selection` section to `README.md`.

Why it matters:

- Makes deployments easier to audit.
- Prevents accidental deployment against an unexpected network connection.

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
- Aligns with `documentation-standards.md` on single source of truth, no duplication, and complete indexing.

## 7. Modernize And Harden The GitHub Actions Workflow

Effort/risk: medium effort, low to medium implementation risk.

`.github/workflows/deploy.yml` currently auto-runs on pushes to `main`, uses older/unmaintained actions (`actions/checkout@v3`, `actions/cache@v3`, `actions-rs/toolchain@v1`), downloads tooling with `curl`, installs the npm `near-cli`, and writes one monolithic `${{ secrets.NEAR_CREDENTIALS }}` value to `~/.near-credentials/credentials.json`.

Recommended change:

- Add explicit workflow `permissions` with least privilege.
- Upgrade maintained actions and pin third-party actions or binaries by version and checksum.
- Use `rust-toolchain.toml` consistently instead of `stable` if contract builds depend on a specific toolchain.
- Prefer `near-cli-rs` if local deployment scripts and docs rely on it.
- Split build/verify from deploy, with deploy gated by `workflow_dispatch` or GitHub Environment approval for main.
- Store credentials per environment/account instead of one broad `NEAR_CREDENTIALS` secret.
- Clean up credential files at the end of the job.
- Add `--depositYocto 1` to calls such as `resume_contract` when the contract requires the 1 yocto guard.

Why it matters:

- Brings the workflow closer to `cicd-deployment-standard.md`.
- Reduces supply-chain and credential exposure risk.
- Prevents CI from bypassing manual review before main deployment.

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

Effort/risk: medium effort, medium implementation risk because signer clients must change together.

`rodit_mint` validates `owneraccount_id` only if it is present in `fee_data_json`. The README already identifies this as a replay/redirect gap: an intercepted signed fee payload that lacks `owneraccount_id` could be front-run to mint to a different owner.

Recommended change:

- Make `owneraccount_id` mandatory in `fee_data_json`.
- Include `owneraccount_id` in the canonical signed payload generated by all signing services.
- Add tests that prove mismatched owner, token id, fee account, and fee value are rejected.
- Publish a short migration note for clients that still sign the legacy payload.

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
- Run the suite in CI before deployment.

Why it matters:

- Aligns with `test-constitution.md`: tests must explain real behavior and should not mock away protocol-sensitive paths.
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

Recommended change:

- Pick one canonical release build path.
- Record tool versions for Rust, `cargo-near`, `wasm-opt`, and NEAR CLI.
- Produce and publish a WASM hash before deployment.
- Require review/approval of the hash before main deployment.
- Document how to reproduce the release artifact from a clean checkout.

Why it matters:

- Makes contract deployments auditable.
- Reduces supply-chain and accidental-build-drift risk.

## Verification Notes

Static review was completed against the files listed above. I attempted to run `cargo test`, but the environment did not have `cargo` installed, so no local build/test result is included in this review.
