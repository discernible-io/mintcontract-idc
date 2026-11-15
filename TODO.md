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
- GitHub Actions: no workflow is committed (`.github/` is absent from `HEAD`; removal of `deploy.yml` is already in history)
- Repository documentation: `README.md`
- Ignore and tracked-file posture: `.gitignore`, `Cargo.lock`, `account.env`

## 1. Stop Tracking Local Account Configuration

**Status (2026-10-22):** Done. `account.env` is gitignored and removed from the index; local file may remain. `list_authorized_signers.sh` accepts an account argument / `CONTRACT_NAME` / optional local file. Rotate any historically exposed values separately.

Effort/risk: very low effort, low implementation risk.

`account.env` was tracked by git while `README.md` and `secure_credentials.sh` said local account configuration should be ignored.

Recommended change:

- Add `account.env` to `.gitignore`.
- Remove `account.env` from version control with `git rm --cached account.env`.
- Rotate any key, token, account, or signer value that may have been exposed through git history.
- Update `list_authorized_signers.sh` to accept the contract name as an argument or from an environment variable, with `account.env` as an optional local convenience file only.

Why it matters:

- Prevents local deployment/account context from becoming a repository secret.
- Brings the repo closer to `configuration-standard.md` and `cicd-deployment-standard.md` guidance that secrets and runtime credentials stay outside git.

## 2. Add The Missing Security And Operations Documents Referenced By README

**Status (2026-10-30):** Done. Responsible disclosure, the deployment checklist, and signer practice live in `README.md`. `emergency_pause.sh` lives in `scripts/`.

Effort/risk: low effort, low implementation risk.

`README.md` previously referenced these files before they existed.

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

**Status (2026-10-21):** Done. `.gitignore` does not list `Cargo.lock`. `Cargo.lock` stays tracked.

Effort/risk: low effort, low implementation risk.

For deployable Rust applications and smart contracts, keeping `Cargo.lock` committed is the safer reproducibility posture. That is the current tree.

Recommended change:

- Keep `Cargo.lock` tracked.
- Remove `Cargo.lock` from `.gitignore`.
- Document that dependency updates must be intentional and reviewed.

Why it matters:

- Reduces accidental dependency drift.
- Supports auditable contract builds and more predictable CI output.

## 4. Replace Ad Hoc Script Parsing With Safer Shell Patterns

**Status (2026-10-22):** Partially done. `deploy.sh` and `list_authorized_signers.sh` use `set -euo pipefail`, quote variables, and load `CONTRACT_NAME` without sourcing arbitrary shell. Residual: prefer `near --output json` + `jq` where CLI supports it.

Effort/risk: low effort, low implementation risk.

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

**Status (2026-10-22):** Done for silent rewrite. `deploy.sh` no longer rewrites `mainnet`/`testnet` to FastNEAR; it logs `RPC selection` from cli-rpc-url, `NEAR_NETWORK_CONFIG`, or named connection.

Effort/risk: low effort, low implementation risk.

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

**Status (2026-10-22):** Ops-doc references resolved (item **2**). Rechecked 2026-10-21/22:

- Upgrade delay and mint rate limit match the source: 24 hours (`86_400`) and 200 mints / 2 hours.
- README no longer says `minting_permanently_disabled` uses `#[borsh(default)]`.
- Facial token character sets and category values may still differ from `src/token_validation.rs` (not re-audited line by line).
- Repeated or stale deployment instructions using different build outputs and NEAR CLI styles may remain (not re-audited line by line).

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

No GitHub Actions workflow is in `HEAD` (`.github/` has no tracked files; the old `deploy.yml` removal is already committed). That removed workflow auto-ran on pushes to `main`, used older actions (`actions/checkout@v3`, `actions/cache@v3`, `actions-rs/toolchain@v1`), downloaded tooling with `curl`, installed the npm `near-cli`, and wrote one monolithic `${{ secrets.NEAR_CREDENTIALS }}` value to `~/.near-credentials/credentials.json`. It had no secret-scanning gate, no supply-chain freshness check, no explicit `permissions` block, and ran build+deploy in a single job. A replacement still needs those controls.

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
- Add the replacement workflow in git. The old `deploy.yml` deletion is already committed; do not treat the working tree as an uncommitted removal.

Why it matters:

- Brings the workflow closer to `cicd-deployment-standard.md`, which now requires Gitleaks as a mandatory gate and explicit `permissions` blocks.
- Reduces supply-chain and credential exposure risk.
- Prevents CI from bypassing manual review before mainnet deployment.
- `vocabulary-standard.md` requires using **main** (not *production*) for the deployment tier name.

## 8. Make Mainnet Upgrade Delay Match The Security Claim

**Status (2026-10-21):** Closed for the delay value. `DEFAULT_UPGRADE_DELAY_SECONDS` and `MIN_UPGRADE_DELAY_SECONDS` in `src/upgrade.rs` are `86_400`. `deploy.sh` sets `UPGRADE_DELAY_SECONDS=86400`. README describes the same 24-hour default.

Effort/risk: medium effort, medium implementation risk.

Residual: `deploy.sh` still hardcodes that wait instead of reading `get_upgrade_status`.

Recommended change:

- Set the contract default upgrade delay to 24 hours for mainnet deployments, or make the delay explicitly configured during initialization / deployment.
- Raise `MIN_UPGRADE_DELAY_SECONDS` for mainnet-safe deployments.
- Update `deploy.sh` to read the on-chain delay from `get_upgrade_status` instead of hardcoding `UPGRADE_DELAY_SECONDS=30`.
- Add a deployment checklist step that verifies `get_upgrade_status` and `get_config` before any main upgrade.

Why it matters:

- Restores the time-lock security property described in the docs.
- Gives operators time to notice and cancel unsafe upgrade proposals.

## 9. Require `owneraccount_id` In Signed Fee Payloads

Effort/risk: medium effort; **medium–high rollout risk** (coordinate SignPortal / signclient before or with contract upgrade). CodeCome **CC-0004** rates finding **HIGH** (CVSS 8.2, EXPLOITED on NEAR sandbox). Operator judgment: the mempool/race front-run is **hard for attackers to win**, so likelihood is low; impact if won remains high (passport ownership hijack).

`rodit_mint` validates `owneraccount_id` only if it is present in `fee_data_json`. Production-shaped fee JSON signs `{token_id, mintingfee, mintingfeeaccount}` only, so an intercepted fee signature *could* be front-run with a different `owneraccount_id`.

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

**Status (2026-10-22):** Done for a dedicated workflow. Root `.gitleaks.toml` and `.github/workflows/gitleaks.yml` (SHA-pinned actions) run on push/PR. Fold into a fuller deploy workflow when item **7** lands.

Effort/risk: low effort, low implementation risk.

`account.env` is no longer tracked. Credential material may still exist in git history — rotate if exposed.

Recommended change:

- Add a `.gitleaks.toml` at the repo root with narrow allowlists for documented non-secrets only (for example, contract account names that look like secrets but are public identifiers).
- Add a Gitleaks step to a new GitHub Actions workflow (`deploy.yml` is already gone from `HEAD`) that runs `gitleaks detect --source . --verbose --redact` after checkout and before any build step.
- Run Gitleaks locally before push as an early-feedback habit: `gitleaks detect --source . --verbose --redact`.
- If Gitleaks finds real secrets in git history, rotate them and treat them as compromised even if the commit is reverted.

Why it matters:

- `cicd-deployment-standard.md` now treats Gitleaks as a required CI gate alongside `enforce-minimum-package-age.js`. The same severity applies: any finding must fail the job before content reaches a deployed artifact.
- Complements `.gitignore` and `secrets.env` host-only controls; detects secrets already present in tracked files or history.

## 16. Versioned Root Holders For Portal And Sanctum (Same NFTs)

**Status (2026-11-03):** Open. Design only; not implemented.

Effort/risk: high effort; **high implementation risk** (contract layout + 24-hour upgrade). Rollout must stay in lockstep with `rodit-sdk`, SignPortal, and SignSanctum. Depends on item **13** if `Contract` gains fields.

Portal and sanctum stay the **same two RODiTs**. A generation is only which NEAR implicit account (`owner_id`, which is the Ed25519 public key) held each token, and from which date. Do not mint a second pair, do not suffix facial `token_id`s, and do not accumulate historical `id=` segments on `serviceprovider_id`.

The verifier primitive is **owner-at-generation**: given the portal or sanctum `token_id` plus a generation (or timestamp), return the implicit account that was the public key at that time.

NEAR RPC can replay `rodit_token` with `block_id` instead of `finality` ([contract RPC](https://docs.near.org/api/rpc/contracts)), but regular nodes (including the FastNEAR host this stack uses) drop state after about five epochs (~36 hours, `GARBAGE_COLLECTED_BLOCK`). Archival RPC is a different endpoint and wants a block height or hash, not a calendar date. `view_access_key_list` is the wrong facility: rotation is a new implicit account taking the NFT, not a new access key on the old account. Archival replay is a forensic backup, not the login / HOLA / `isamatch` path.

Recommended change:

- Add a tiny side map only for the two root token ids (they rarely rotate), not a history list on every token:
  - `history_enabled: UnorderedSet<token_id>` — mark the pair after mint; do not match on the names `portal` / `sanctum` (`token_id` never contains them; two `id=` segments also appear on children).
  - `previous_owners: LookupMap<token_id → [(generation, account_id, valid_from)]>` — generation 0 is the mint-time holders.
- Keep `Token { owner_id }` as the live holder. On `rodit_transfer` and `recover_token`, if `history_enabled` contains the id, append `(old owner_id, block_timestamp)` then set the new owner. Ordinary client/server transfers stay overwrite-only.
- Expose current-state views (`finality: final`):
  - `rodit_owner_at({ token_id, generation })` / `rodit_owner_at({ token_id, timestamp })` → `account_id`
  - `rodit_owner_history(token_id)`
  - `rodit_token` still returns the live `owner_id` (optional empty `previous_owners` on `JsonToken` is fine; do not make events or `rodit_tokens_for_owner` the read API).
- Pair crossed signatures always verify against **generation 0**. After rotation, live `owner_id` is the issuance key for new children, not the key that signed the pair.
- New client and server RODiTs carry that generation (or date) **inside the signed metadata**. Prefer `;gen=N` on `serviceprovider_id` (already in the canonical hash; contract only length-checks it; no `TokenMetadata` Borsh rewrite). A dedicated metadata field is clearer but migrates every existing token. `not_before` is too coarse.
- Missing `gen` on already-minted children means **generation 0**, not the current owner. The first rotation otherwise breaks every existing client and server.
- Rotate in one NEAR transaction: two `rodit_transfer` calls, same `valid_from`, same generation index. Wipe the previous private keys off-chain after cutover. Do not burn, remint, or transfer without `history_enabled`.
- `rodit-sdk`: parse `gen` from the child; call `rodit_owner_at`; check `serviceprovider_signature` against that public key. Vaults keep the same `token_id` and swap the secret.

Why it matters:

- Lets the root key pair rotate without minting different NFTs or invalidating historical trust chains.
- Keeps live verification on ordinary RPC (`finality: final`) instead of archival `block_id` queries.
- Leaves this contract oblivious of portal/sanctum roles: owner history is an opt-in token property.

## Verification Notes

Static review was completed against the files listed above and updated against the latest `../docs` standards as of 2026-05-25. Rechecked 2026-10-21: items **3** and **8** (delay value) match the tree; item **6** no longer has the upgrade-delay, rate-limit, or `#[borsh(default)]` mismatches; item **7**'s workflow is absent from `HEAD` rather than an uncommitted deletion. Standards that have significantly expanded since the original review include `cicd-deployment-standard.md` (Gitleaks, slim images, systemd linger, APP_DIR), `documentation-standard.md` (principles 12–16), `test-constitution.md` (SDK-first, protocol-sensitive, findings-first), and the addition of `planned-improvements.md`, `frontend-branch-env-migration.md`, and `signatures/`. I attempted to run `cargo test`, but the environment did not have `cargo` installed, so no local build/test result is included in this review.


## Standards conformance gaps (host audit 2026-10-27)

NEAR contract ([applicability matrix](../docs/docs/documentation-standard.md#applicability-matrix)). Cross-ref [`planned-improvements.md`](../docs/docs/planned-improvements.md) **15**.

| Gap | Standard | Evidence / action |
| --- | --- | --- |
| Single build command | coding / configuration (contract binding) | `deploy.sh` (`cargo near build non-reproducible-wasm`) vs other documented/`wasm-opt` paths — pick one canonical command for CI + deploy (item **14**) |
| Deploy manifest + logging binding | configuration / logging **PI 15** | One tier deploy manifest listing init args with `source`; deploy log lists each argument — still no proven reference recorded in docs |
| README → standards | documentation | Weak/absent pointer to discernible-io/docs — add reference-only link |
| Local `docs/` | distribution | Service docs present without cicd standard copy — OK if reference-only; do not invent a third standards tree |
| Toolchain pin | coding | `rust-toolchain.toml` + `Cargo.lock` present — keep as the pattern; adopt fmt/clippy/`cargo deny` when CI expands beyond Gitleaks |
