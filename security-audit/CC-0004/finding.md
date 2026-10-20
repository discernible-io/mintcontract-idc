---
id: "CC-0004"
title: "Mint fee signature optional owneraccount_id enables front-run redirect"
status: "EXPLOITED"
severity: "HIGH"
cvss_v4:
  vector: "CVSS:4.0/AV:N/AC:L/AT:P/PR:N/UI:N/VC:H/VI:H/VA:N/SC:N/SI:N/SA:N"
  score: 8.2
  justification: "Network attacker with a captured fee signature (mempool or broker) can mint a fixed token_id to their NEAR account before the legitimate minter; high integrity impact on on-chain passport ownership when signed JSON omits owneraccount_id."
confidence: "CONFIRMED"
category: "Business Logic"
cwe:
  - "CWE-639"
  - "CWE-345"
language: "rust"
target_area: "NEAR RODiT contract mint"
files:
  - "src/mintcontract-idc/src/lib.rs"
  - "src/mintcontract-idc/README.md"
symbols:
  - "rodit_mint"
  - "verify_fee_signature"
entry_points:
  - "NEAR contract method rodit_mint"
sources:
  - "fee_data_json"
  - "owneraccount_id transaction argument"
  - "fee_signature_base64url"
sinks:
  - "Token.owner_id assignment"
  - "fee signature verification over fee_data_json bytes"
trust_boundary: "external NEAR transaction submitter -> on-chain token ownership"
assets_at_risk:
  - "On-chain RODiT registry integrity"
  - "Mint economics and passport ownership"
validation:
  status: "CONFIRMED"
  methods:
    - "static_proof"
    - "runtime_reproduction"
  evidence_dir: "itemdb/evidence/CC-0004"
  summary: "Contract skips owner binding when owneraccount_id absent from signed fee JSON; signclient returns three-field fee_data; sandbox script shows alternate owners pass binding for one signature."
exploitation:
  status: "DEMONSTRATED"
  impact_demonstrated: "Attacker front-ran rodit_mint on NEAR sandbox with captured three-field fee signature; on-chain owner_id became attacker account for fixed token_id."
  exploit_type: "fee signature replay with owneraccount_id redirect via NEAR rodit_mint"
  severity_before: "HIGH"
  severity_after: "HIGH"
  artifacts_dir: "itemdb/evidence/CC-0004/exploits"
  summary: "Black-box PoC mints passport to attacker using intercepted signclient-shaped fee JSON without owneraccount_id."
created_at: "2026-10-20"
updated_at: "2026-10-20"
---

# Summary

`rodit_mint` verifies fee signatures over `fee_data_json` but only enforces `owneraccount_id` consistency when that field is present in the signed JSON. Legacy fee payloads without `owneraccount_id` can be front-run: an attacker reuses the captured fee signature and supplies their own `owneraccount_id` argument to mint the token to themselves.

# Target context

`mintcontract-idc` is the on-chain registry for RODiT passports. Minting requires an authorized fee signature over JSON fee data. The server broker and SignPortal pipeline produce signed fee blobs consumed by NEAR transactions.

# Affected code

- `src/mintcontract-idc/src/lib.rs` — `rodit_mint` lines binding `token_id` and `mintingfeeaccount` in JSON; `owneraccount_id` check wrapped in `if let Some(fee_owner) = fee_data.get("owneraccount_id")`.
- `src/mintcontract-idc/README.md` — documents the known gap and mitigation (embed `owneraccount_id` in signed JSON).

# Vulnerability hypothesis

When signers omit `owneraccount_id` from the signed fee JSON (current caller behavior per README), the contract cannot bind ownership to the signature. Any party observing a valid `(fee_data_json, fee_signature_base64url)` pair before the legitimate minter submits their transaction can call `rodit_mint` with the same fee artifacts but a different `owneraccount_id`, becoming token owner while paying the required fee deposit.

# Source-to-sink reasoning

1. **Source:** Attacker observes fee JSON + signature (mempool, broker logs, network, compromised client).
2. **Propagation:** Attacker constructs NEAR transaction with identical `fee_data_json` and `fee_signature_base64url`.
3. **Validation gap:** No `require!` when `owneraccount_id` absent from JSON; argument `owneraccount_id` is attacker-controlled.
4. **Sink:** `Token { owner_id: owneraccount_id.clone() }` stored on successful mint.
5. **Boundary:** Economic/fees satisfied; ownership integrity violated.

# Attackability / trigger conditions

- Fee signing pipeline does not include `owneraccount_id` in JSON (documented current state).
- Attacker can submit NEAR transaction before victim with same fee signature and sufficient deposit.
- Token ID in JSON still fixed; race is on **who becomes owner** of that minted passport.

# Impact

Unauthorized passport ownership hijack for pre-committed `token_id` values, undermining registry integrity and enabling impersonation of minted identities. Economic loss to legitimate minter (fee paid by attacker still mints asset attacker owns).

# Validation plan

1. Unit test in `mintcontract-idc` (NEAR sandbox): build `fee_data_json` without `owneraccount_id`, sign with test authorized signer key.
2. Call `rodit_mint` as account A with `owneraccount_id: A` — success baseline.
3. Replay same fee JSON/signature as account B with `owneraccount_id: B` — expect success on vulnerable contract.
4. Add `owneraccount_id` to signed JSON and repeat — expect B rejected after fix.
5. Cross-check SignPortal/signclient output for presence of `owneraccount_id` in fee payloads.

# Counter-analysis

Reviewer conclusion:

Keep in `PENDING` at **HIGH** severity. On-chain logic gap is explicit and documented; meets engagement bar for registry integrity impact.

Evidence reviewed:

- `mintcontract-idc/src/lib.rs` `rodit_mint`: `owneraccount_id` match enforced only inside `if let Some(fee_owner) = fee_data.get("owneraccount_id")`.
- README and `TODO.md` acknowledge the front-run scenario when field omitted from signed JSON.
- Threat-model asset "On-chain RODiT registry integrity" and theme "Contract authorized signer" align.
- Attacker capability "submit NEAR transactions" + observe mempool/logs fits mempool front-run model.

Disproof attempts:

- `token_id` and `mintingfeeaccount` are bound in signed JSON—attack does not change minted ID, only **owner** when owner not in signed payload.
- No `owneraccount_id` references in `signclient.public.routes.js` or fee services under `idclawserver-idc` (supports claim that callers may omit field today).

Semantic deduplication:

Distinct from CC-0005 (off-chain permission rate inflation). Both touch mint economics but different sinks (on-chain owner vs JWT permission metadata).

Remaining assumptions:

- Fee signing pipeline in production omits `owneraccount_id` from signed JSON (README states current callers).
- Attacker can race victim's mint transaction on NEAR.

Confidence adjustment:

Unchanged **HIGH** for contract logic; NEAR sandbox unit test still required for `CONFIRMED`.

Recommended next action:

Phase 4 NEAR sandbox test per validation plan; trace SignPortal/signclient fee JSON for `owneraccount_id` presence.

# Validation result

Status: CONFIRMED

Method: static_proof, runtime_reproduction

Date: 2026-10-20

Summary: `rodit_mint` only compares `owneraccount_id` to signed JSON when `owneraccount_id` is present in `fee_data_json`. Signclient/SignPortal fee payloads include `token_id`, `mintingfee`, and `mintingfeeaccount` only. A sandbox script reproduces SHA-512/ed25519 fee verification and shows both `victim.testnet` and `attacker.testnet` pass the owner-binding gate for the same signature when the field is omitted; embedding `owneraccount_id` in JSON rejects the attacker.

Commands:

- `cd src/mintcontract-idc && CONTRACT_NAME=test.near cargo test --lib`
- `node sandbox/validation/CC-0004/validate_owner_redirect.mjs`

Observed behavior: Identical signed fee JSON (no owner field) accepts arbitrary `owneraccount_id` argument at the binding check; mitigated when owner is in JSON.

Expected vulnerable behavior: Attacker reuses fee signature with different `owneraccount_id` and becomes token owner.

Expected safe behavior: Owner argument always bound to signed fee data.

Conclusion: Vulnerability confirmed via reachable on-chain logic and production-aligned fee JSON shape.

Limitations: No live NEAR `rodit_mint` double-call on chain; see `itemdb/evidence/CC-0004/limitations.md`.

# Evidence

- `itemdb/evidence/CC-0004/README.md`
- `itemdb/evidence/CC-0004/static-proof.md`
- `itemdb/evidence/CC-0004/output.txt`
- `itemdb/evidence/CC-0004/commands.txt`
- `itemdb/evidence/CC-0004/limitations.md`
- `sandbox/validation/CC-0004/validate_owner_redirect.mjs`

# Exploitation Result

Status: DEMONSTRATED (2026-10-20)

Method: Local NEAR sandbox deployment of production WASM; black-box `rodit_mint` via JSON-RPC using `exploit.py` / `cc0004-exploit-near.mjs`.

Chain:

1. Lab/simulated capture: `captured-fee-signclient.json` (three-field `fee_data`, valid ed25519 fee signature, no `owneraccount_id`).
2. Attacker account submitted `rodit_mint` with `owneraccount_id=attacker.sandbox` and victim-intended owner `victim.sandbox` unused by contract checks.
3. Transaction succeeded; `rodit_mint` event logged `owner_id=attacker.sandbox`.
4. `rodit_token` view returned `owner_id=attacker.sandbox` (`OWNER_HIJACK=true` in PROOF block).

Artifacts: `itemdb/evidence/CC-0004/exploits/README.md`, `captured-output.txt`, `impact-log.txt`.

# Demonstrated Impact

An attacker who intercepts a valid SignPortal/signclient fee package can mint the victim’s pre-authorized `token_id` to the attacker’s NEAR account before the victim’s transaction lands. The fee signature still verifies (token and fee accounts match the signed JSON), but ownership is taken from the unauthenticated `owneraccount_id` argument because the signed JSON omits that field.

In the sandbox run, the attacker paid the mint deposit and became the on-chain owner of facial token `bdbdbdbdbdbd` while the victim account never received ownership—proving registry integrity loss for that passport identity.

# Root cause analysis

`rodit_mint` verifies ed25519 signatures over `fee_data_json` but wraps the owner consistency check in `if let Some(fee_owner) = fee_data.get("owneraccount_id")`. When SignPortal/signclient signs only `{token_id, mintingfee, mintingfeeaccount}`, the branch is skipped and `Token.owner_id` is set directly from the attacker-controlled `owneraccount_id` function argument.

# Data flow

1. SignPortal / `POST /api/signclient` → three-field `fee_data` + `fee_signature_base64url` (`src/idclawserver-idc/src/routes/signclient.public.routes.js` ~770).
2. Attacker observes capture → NEAR transaction `rodit_mint` with same fee fields (`entry_points`: NEAR RPC).
3. `fee_data_json` parsed in `rodit_mint` (`src/mintcontract-idc/src/lib.rs` ~409).
4. Optional owner `require!` skipped when `owneraccount_id` absent from JSON (`lib.rs` ~431–437).
5. `Token { owner_id: owneraccount_id }` persisted (`lib.rs` ~486–490).

# Inputs and preconditions

- Signed `fee_data_json` without `owneraccount_id` (production-shaped three keys).
- Valid `fee_signature_base64url` from authorized signer for that JSON.
- Attacker NEAR account with balance for mint fee deposit and gas.
- `token_id` not yet minted on chain (race before victim).

# Recording

- `itemdb/evidence/CC-0004/exploits/recordings/exploit.cast` — asciinema of `reproduce.sh`
- `itemdb/evidence/CC-0004/exploits/recordings/exploit.gif` — rendered preview
- `itemdb/evidence/CC-0004/exploits/recordings/reproduce.sh` — idempotent demo driver
- `itemdb/evidence/CC-0004/exploits/recordings/env.txt` — tool versions
- `itemdb/evidence/CC-0004/exploits/recordings/README.md` — play/re-run instructions

# Remediation idea

Require `owneraccount_id` in `fee_data_json`, include it in signed bytes, and `require!` match with function argument always (not optional). Coordinate SignPortal and `/api/signclient` to embed owner in fee JSON.

```diff
--- a/src/mintcontract-idc/src/lib.rs
+++ b/src/mintcontract-idc/src/lib.rs
@@ -428,11 +428,14 @@
             format!("Minting fee account mismatch: signature is for '{}' but using '{}'", fee_minting_account, mintingfee_account)
         );
         
-        // Verify owner account matches (if present in fee_data)
-        if let Some(fee_owner) = fee_data.get("owneraccount_id").and_then(|v| v.as_str()) {
-            require!(
-                fee_owner == owneraccount_id.as_str(),
-                format!("Owner account mismatch: signature is for '{}' but using '{}'", fee_owner, owneraccount_id)
-            );
-        }
+        let fee_owner = fee_data
+            .get("owneraccount_id")
+            .and_then(|v| v.as_str())
+            .unwrap_or_else(|| panic!("owneraccount_id not found or not a string in fee data"));
+        require!(
+            fee_owner == owneraccount_id.as_str(),
+            format!(
+                "Owner account mismatch: signature is for '{}' but using '{}'",
+                fee_owner,
+                owneraccount_id
+            )
+        );
```

# Notes

README explicitly labels gap; treated as code-level weakness with HIGH impact when legacy payloads remain in production. Distinct from off-chain signclient validation issues.
