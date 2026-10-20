# Limitations — CC-0004

- Full on-chain `rodit_mint` was not invoked twice on NEAR testnet/sandbox in this run. Existing `mintcontract-idc` unit tests do not cover owner redirect; several tests fail without a proper `VMContextBuilder` setup (`test_owner_functions`, `test_js_signature_compatibility`).
- Runtime reproduction used a sandbox script that mirrors contract fee canonicalization, SHA-512 + ed25519 verification, and the optional `owneraccount_id` binding branch from `lib.rs`.
- Production SignPortal signing was not exercised live; fee JSON shape is inferred from `signclient.public.routes.js` and README, which match the validated three-field payload.
- Mempool race timing and attacker observation of fee artifacts are assumed per threat model, not demonstrated on a live network.
