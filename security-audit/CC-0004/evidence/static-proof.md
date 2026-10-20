# Static proof — CC-0004

## Claim

When `owneraccount_id` is omitted from signed `fee_data_json`, `rodit_mint` does not bind the transaction argument `owneraccount_id` to the fee signature, allowing a third party to reuse the same fee artifacts and mint with a different owner.

## Contract sink and guard

File: `src/mintcontract-idc/src/lib.rs`, function `rodit_mint`.

- `token_id` and `mintingfeeaccount` are always required to match parsed JSON (`require!` at lines 417–428).
- `owneraccount_id` is enforced only when present in JSON:

```rust
if let Some(fee_owner) = fee_data.get("owneraccount_id").and_then(|v| v.as_str()) {
    require!(fee_owner == owneraccount_id.as_str(), ...);
}
```

- On success, ownership is taken from the **function argument**, not from signed JSON when the field is absent:

```rust
let token = Token { owner_id: owneraccount_id.clone() };
```

Fee signature verification uses the raw `fee_data_json` bytes (line 472) and does not include the `owneraccount_id` argument in the signed message.

## Production caller omits `owneraccount_id` from signed fee JSON

File: `src/idclawserver-idc/src/routes/signclient.public.routes.js` (lines 764–774).

Comment: `SignPortal signs: { token_id, mintingfee, mintingfeeaccount }`.

Response `fee_data` object contains only those three keys — no `owneraccount_id`.

Grep across `src/**/*.js` found zero references to `owneraccount` in JS sources.

## Reachability (threat model)

- Attacker capability: submit NEAR transactions; observe mempool or broker responses (documented in `itemdb/notes/threat-model.md`).
- Trust boundary crossed: external NEAR transaction submitter → on-chain token `owner_id`.
- Asset: on-chain RODiT registry integrity.

## Impact path

1. Victim obtains valid `(fee_data_json, fee_signature_base64url)` from SignPortal/signclient (no owner in JSON).
2. Attacker submits `rodit_mint` with identical fee fields and signature but `owneraccount_id` = attacker.
3. Contract passes optional owner check; signature still valid; token stored with attacker as `owner_id`.

## Mitigation (documented in target)

`mintcontract-idc/README.md` and `TODO.md` §9 require mandating `owneraccount_id` inside signed JSON.
