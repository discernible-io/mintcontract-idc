# Evidence for CC-0004

Date: 2026-10-20

# Summary

Confirms that production-shaped fee JSON (no `owneraccount_id`) allows two different `owneraccount_id` transaction arguments to pass the contract's optional owner binding while sharing one valid fee signature. Static analysis ties this to `rodit_mint` in `mintcontract-idc` and SignPortal fee fields returned by `signclient`.

# Validation method

- `static_proof`
- `runtime_reproduction` (sandbox script mirroring binding + signature algorithm)

# Environment

- Host: Linux, Node.js v22.23.2
- Rust: rustc 1.99.0; `cargo test --lib` in `src/mintcontract-idc` (CONTRACT_NAME from `account.env` via `test.near`)
- Workspace: `/home/dedalo47/CodeCome`
- No live NEAR RPC or SignPortal calls

# Threat-model assumptions (if applicable)

- Attacker may submit NEAR transactions and obtain or observe valid fee JSON + signature before the victim mints (mempool / broker response), per `itemdb/notes/threat-model.md`.
- Fee signing in production omits `owneraccount_id` (supported by signclient code and contract README).

# Commands executed

See `commands.txt`.

    cd src/mintcontract-idc && CONTRACT_NAME=test.near cargo test --lib
    node sandbox/validation/CC-0004/validate_owner_redirect.mjs

# Inputs

- Production-shaped fee object: `{ token_id, mintingfee, mintingfeeaccount }` only
- Script: `sandbox/validation/CC-0004/validate_owner_redirect.mjs`

# Observed result

- `output.txt`: same fee JSON and signature verify; `victim.testnet` and `attacker.testnet` both pass owner binding when field absent; attacker rejected when JSON includes `owneraccount_id: victim.testnet`.
- `static-proof.md`: source-to-sink with file references.
- `cargo test`: 25 passed; 2 unrelated owner-context tests failed (pre-existing test harness gap).

# Expected vulnerable behavior

Two distinct `owneraccount_id` values succeed the pre-mint owner check for identical signed fee data without `owneraccount_id` in JSON.

# Expected safe behavior

Owner argument must match signed `owneraccount_id` or mint must fail when field is mandatory in JSON.

# Conclusion

**CONFIRMED** — On-chain logic explicitly skips owner binding when the field is absent; off-chain pipeline supplies three-field fee JSON only; sandbox reproduction shows signature-valid replay accepts alternate owners.

# Files

- `README.md`
- `commands.txt`
- `output.txt`
- `logs.txt`
- `static-proof.md`
- `limitations.md`

# Limitations

See `limitations.md`.
