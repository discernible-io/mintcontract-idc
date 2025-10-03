# RODiT: A Policy-Rich Token Contract for API Access on NEAR (Testnet)

Audience: NEAR developers (testnet only)  
Example account: `20251001-rodit-org.testnet`  
Controlling domain: `rodit.org`

---

## Who

- **Contract owner**
  - Deploys/initializes the contract and controls lifecycle.
  - Admin methods in `src/lib.rs`:
    - Pause/resume: `pause_contract()`, `resume_contract()` (aliases: `pause()`, `resume()`)
    - Upgrade controls: `propose_upgrade()`, `cancel_upgrade()`, `finalize_upgrade()`
    - Signer management: `add_authorized_signer()`, `remove_authorized_signer()`

- **Token holders**
  - Own, transfer, and burn RODiT tokens.
  - Methods: `rodit_transfer()`, `rodit_burn()`, views like `rodit_tokens_for_owner()`

- **Authorized signers**
  - Keys permitted to sign fee data for minting (stored in `authorized_signers: UnorderedSet<Vec<u8>>`).

- **Integrators**
  - Use view functions for metadata, tokens, and stats (read-only).

---

## What

A NEAR smart contract for API-access tokens with strong metadata semantics, upgrade discipline, and auditable events.

- **Core types** in `src/lib.rs`:
  - `Token` with `owner_id: AccountId`
  - `TokenMetadata` with API-policy fields (e.g., `openapijson_url`, `permissioned_routes`, `jwt_duration`, `serviceprovider_id`)
  - `JsonToken` view wrapper (token_id, owner_id, metadata)
  - `RoditContractMetadata` with embedded JSON-LD context `DID_WBA_JSON_LD`
  - `ContractStatus`: `Active | Paused | Upgrading`
  - `ContractStats`: `created_at`, `last_updated_at`, `total_supply`

- **Storage layout** in `src/lib.rs`:
  - `tokens_by_id: LookupMap<String, Token>`
  - `token_metadata_by_id: UnorderedMap<String, TokenMetadata>`
  - `tokens_per_owner: LookupMap<AccountId, Vector<String>>` (ordered per owner)
  - `authorized_signers: UnorderedSet<Vec<u8>>`
  - `storage_deposits: LookupMap<AccountId, u128>`
  - `upgrade_config: upgrade::ContractUpgrade`

- **Public API (selected)**:
  - Mutations: `rodit_mint(...)`, `rodit_transfer(...)`, `rodit_burn(...)`, `recover_token(...)`
  - Views: `rodit_token`, `rodit_tokens`, `rodit_tokens_for_owner`, `rodit_total_supply`, `rodit_supply_for_owner`, `rodit_tokens_filtered`, `rodit_metadata`, `rodit_metadata_jsonld`, `did_wba_jsonld`
  - Management: pause/resume, upgrade lifecycle, signer management

---

## Where

- **Code layout**:
  - `src/lib.rs`: Main contract, state, endpoints, and views
  - `src/events.rs`: NEP-297-style event emitters
  - `src/storage.rs`: Storage and fee handling (`handle_account_fees_and_storage()`)
  - `src/token_validation.rs`: Metadata validation for minting
  - `src/upgrade.rs`: Time-locked upgrade configuration and helpers

- **Contract constants**:
  - `RODIT_METADATA_SPEC = "RODIT-near.org-20251001"`
  - Issuer URL: `"20251001.rodit.org"`

- **Testnet account for examples**: `20251001-rodit-org.testnet`

---

## When

- **Initialization**:
  - `init(owner_id, metadata)` sets the owner, applies default metadata (if `None`), initializes collections, sets `status = Active`.

- **Lifecycle**:
  - Most mutating ops require `status == Active` (enforced by `assert_contract_active()`).
  - Owner can `pause_contract()` and `resume_contract()`.
  - Upgrading: `propose_upgrade()` → wait enforced delay → `finalize_upgrade()` (only proposer), with status transitions `Active → Upgrading → Active`.

- **Events**:
  - Emitted for mint, transfer, burn, recover, fees, and status changes via `src/events.rs`.

---

## Why

- **Deterministic token order per owner**:
  - `tokens_per_owner` uses `Vector<String>` to preserve acquisition order.
  - `internal_add_token_to_owner()`: prevents duplicates and uses `Vector::push`.
  - `internal_remove_token_from_owner()`: uses index `position()` + `swap_remove()` for O(1) removal.

- **Safety-first state changes**:
  - Uses checks-effects-interactions.
  - Explicit `require!()` messages for clear on-chain error debugging.

- **Upgrade discipline**:
  - Owner-only, proposer-bound finalize, enforced delay, and strict status transitions improve safety.

- **Semantic metadata**:
  - JSON-LD vocabulary (`DID_WBA_JSON_LD`) provides standard, machine-readable fields for API policy and auditing.

---

## How

- **Minting (`rodit_mint(...)`)**:
  1. Validates metadata via `validate_token_metadata(...)` (`src/token_validation.rs`).
  2. Ensures attached deposit equals the fee specified in `fee_data_json`.
  3. Verifies `fee_signature_base64url` using an authorized signer.
  4. Persists token + metadata, updates owner vector, updates `total_supply` and timestamps.
  5. Computes actual storage delta with `env::storage_usage()` and calls `handle_account_fees_and_storage(...)` (`src/storage.rs`).
  6. Emits standardized mint event.

- **Transfer / Burn**:
  - `rodit_transfer(...)`: owner-only; moves token between owners’ vectors, updates token owner, emits event.
  - `rodit_burn(...)`: owner-only; removes token and metadata, decrements supply, emits event.

- **Views**:
  - `rodit_token(token_id)`: returns `JsonToken`.
  - `rodit_tokens(from_index, limit)`: paginates all tokens.
  - `rodit_tokens_for_owner(account_id, from_index, limit)`: paginates the owner’s token vector (in acquisition order).
  - `rodit_tokens_filtered(..., service_provider_id)`: filters by `TokenMetadata.serviceprovider_id`.
  - `rodit_metadata_jsonld()`: returns metadata as a JSON-LD document (with embedded `@context`).

- **Upgrade protocol (`src/upgrade.rs`)**:
  - `propose_upgrade(&mut self)`: owner-only; sets status to `Upgrading`, records proposer and timestamp, emits status event.
  - `finalize_upgrade(&mut self)`: proposer-only; validates delay has elapsed, resets proposal metadata.
  - `set_upgrade_delay(new_delay)`: min 60 seconds.

- **Deploy (fresh testnet account)**:
  - Build the contract WASM (e.g., with `cargo near build`).
  - Deploy code to `20251001-rodit-org.testnet`.
  - Call `init` with `{"owner_id":"20251001-rodit-org.testnet","metadata":null}`.

---

## Event Schema (Exact)

All events use this envelope (NEP-297 style), per `src/events.rs`:

```json
{
  "standard": "PENDING nepXXX",
  "version": "RODIT-near.org-20251001",
  "event": "<event_name>",
  "data": [ { /* event-specific object */ } ]
}
```

- **rodit_mint**
```json
{
  "standard": "PENDING nepXXX",
  "version": "RODIT-near.org-20251001",
  "event": "rodit_mint",
  "data": [
    {
      "owner_id": "<account_id>",
      "token_ids": ["<token_id>"]
    }
  ]
}
```

- **rodit_transfer**
```json
{
  "standard": "PENDING nepXXX",
  "version": "RODIT-near.org-20251001",
  "event": "rodit_transfer",
  "data": [
    {
      "old_owner_id": "<account_id>",
      "new_owner_id": "<account_id>",
      "token_ids": ["<token_id>"],
      "memo": "<string or null>"
    }
  ]
}
```

- **rodit_burn**
```json
{
  "standard": "PENDING nepXXX",
  "version": "RODIT-near.org-20251001",
  "event": "rodit_burn",
  "data": [
    {
      "owner_id": "<account_id>",
      "token_ids": ["<token_id>"]
    }
  ]
}
```

- **rodit_recover**
```json
{
  "standard": "PENDING nepXXX",
  "version": "RODIT-near.org-20251001",
  "event": "rodit_recover",
  "data": [
    {
      "previous_owner_id": "<account_id>",
      "new_owner_id": "<account_id>",
      "token_ids": ["<token_id>"]
    }
  ]
}
```

- **rodit_storage_payment**
```json
{
  "standard": "PENDING nepXXX",
  "version": "RODIT-near.org-20251001",
  "event": "rodit_storage_payment",
  "data": [
    {
      "account_id": "<account_id>",
      "amount": "<yoctoNEAR as string>"
    }
  ]
}
```

- **rodit_contract_fee**
```json
{
  "standard": "PENDING nepXXX",
  "version": "RODIT-near.org-20251001",
  "event": "rodit_contract_fee",
  "data": [
    {
      "amount": "<yoctoNEAR as string>"
    }
  ]
}
```

- **rodit_provider_fee**
```json
{
  "standard": "PENDING nepXXX",
  "version": "RODIT-near.org-20251001",
  "event": "rodit_provider_fee",
  "data": [
    {
      "provider_id": "<account_id>",
      "amount": "<yoctoNEAR as string>"
    }
  ]
}
```

- **rodit_signer_added**
```json
{
  "standard": "PENDING nepXXX",
  "version": "RODIT-near.org-20251001",
  "event": "rodit_signer_added",
  "data": [
    {
      "public_key": "<hex-or-base64 string as logged>"
    }
  ]
}
```

- **rodit_signer_removed**
```json
{
  "standard": "PENDING nepXXX",
  "version": "RODIT-near.org-20251001",
  "event": "rodit_signer_removed",
  "data": [
    {
      "public_key": "<hex-or-base64 string as logged>"
    }
  ]
}
```

- **rodit_status_change**
```json
{
  "standard": "PENDING nepXXX",
  "version": "RODIT-near.org-20251001",
  "event": "rodit_status_change",
  "data": [
    {
      "status": "Active | Paused | Upgrading"
    }
  ]
}
```

---

## Example Testnet Commands (using `near` CLI)

- **Status and stats**
```bash
near view 20251001-rodit-org.testnet get_contract_status --network-id testnet
near view 20251001-rodit-org.testnet get_contract_stats --network-id testnet
```

- **Metadata JSON-LD**
```bash
near view 20251001-rodit-org.testnet rodit_metadata_jsonld --network-id testnet
```

- **Tokens**
```bash
near view 20251001-rodit-org.testnet rodit_tokens '{"from_index":"0","limit":10}' --network-id testnet
near view 20251001-rodit-org.testnet rodit_tokens_for_owner '{"account_id":"20251001-rodit-org.testnet","from_index":"0","limit":10}' --network-id testnet
```

- **Transfer (example)**
```bash
near call 20251001-rodit-org.testnet rodit_transfer \
  '{"receiver_id":"<RECEIVER>.testnet","token_id":"token-001","memo":null}' \
  --account-id 20251001-rodit-org.testnet --network-id testnet
```

---

## Licensing & Compliance

- All rights reserved.  
- For trials/evaluation, contact: **rodit@rodit.org**

---

## Roadmap

- Next article: how to create two intertwined root RODiT certificates for servers and clients (and their relation to issuance and validation).
- Separate article: fee-signature generation details and best practices.

---

## Summary

The RODiT contract provides a policy-rich token for API access on NEAR testnet with:
- Ordered per-owner token tracking for predictable pagination
- Explicit lifecycle (Active/Paused/Upgrading) with upgrade safety
- JSON-LD-based metadata for semantic interoperability
- Standardized NEP-297-style event logs for observability

Use `20251001-rodit-org.testnet` as your reference contract on testnet.
