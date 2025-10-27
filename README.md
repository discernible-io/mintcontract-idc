![cableguard logo banner](./banner.png)

# RODiT: Policy-Rich Token Contract for API Access on NEAR

**Contract Version**: RODiTCorp-near.org-20251027  
**Example Account**: `roditcorp-com.near`  
**Controlling Domain**: `rodit.org`

---

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Contract Architecture](#contract-architecture)
- [Token Metadata Guide](#token-metadata-guide)
- [Security Features](#security-features)
- [API Reference](#api-reference)
- [Deployment Guide](#deployment-guide)
- [Discernible Ecosystem](#discernible-ecosystem)

---

## Overview

Discernible DEV API forge creates sets of RODIT in testnet with all the configuration and subscription information necessary to set up Discernible TUN API calls.

Authentication between API clients and server uses PKC with a twist. Ownership of the RODITs is double-checked with the NEAR Protocol in real time, and the PKC pair used is the pair of the RODIT themselves.

Read more: https://vaceituno.medium.com/unleashing-the-power-of-public-key-cryptography-with-non-fungible-tokens-513286d47524

### What is RODiT?

A NEAR smart contract for API-access tokens with strong metadata semantics, upgrade discipline, and auditable events.

**Key Features**:
- Policy-rich token metadata for API access control
- Time-locked upgrade mechanism (24-hour delay)
- Rate limiting (10 mints per hour per account)
- Configurable fee system
- Automatic storage cost management
- NEP-297-style event logging
- JSON-LD-based metadata for semantic interoperability

---

## Quick Start

### 0. Prerequisites

- near cli installed
- Download the code from the repository
- When downloading from VS Code it is possible that the shell script files have the wrong permissions and need to be set x so they can run
- Installing npm:
  ```bash
  node -v
  sudo npm cache clean -f
  sudo npm install -g n
  sudo n stable
  node -v
  ```

### 1. Install and Build

```bash
npm install  # in each directory
npm run build
```

### 2. Deploy the Contract

```bash
# Delete the neardev directory where the contract is
npm run deploy
```

### 3. Initialize the Contract

```bash
npm run init
```

### 4. Start the Front End

```bash
npm run start
# Open the Front End from a browser
# Log in with your NEAR Wallet
```

**Start as background process**:
```bash
setsid npm run start >/dev/null 2>&1 < /dev/null &
```

### 5. Jump Start Your Server Account

In your API Endpoints and API Clients, install near and create an implicit account ID and a key pair:

```bash
near generate-key
```

**Output example**:
- Key pair with ed25519:BNcExLS7k84HswwFHpB49jZnh1y6bsRS7P51FVmeBBxs public key for an ACCOUNT "9a1de9b4aa4ddd4a3091f43f1de680a9f5405d70e8ca69c3fb5daa96b5cd1270"
- Resulting in the key pair stored in: `~/.near-credentials/testnet/9a1de9b4aa4ddd4a3091f43f1de680a9f5405d70e8ca69c3fb5daa96b5cd1270.json`
- From your NEAR wallet send some 0.01 Near to the newly generated implicit account ID to activate it

### 6. Input the Discernible Configuration

Input values for:
- **Number of clients**: No default value
- **API Provider**: No default value / IT CAN BE EMPTY
- **API Service Description**: No default value / IT CAN BE EMPTY
- **Date of Expiration of API Service**: 1 year in the future from today / IT CAN BE EMPTY
- **Date of Start of API Service**: today
- **IPv4 addresses range of the API clients**: 10.0.0.1/24
- **Port where the API server listens**: A random number between 49152 and 65535
- **DNS server IPv4 address**: No default value / IT CAN BE EMPTY
- **Initial IPv4 address for API clients**: 0.0.0.0/0, ::/0
- **IPv4 address of the API server where the clients connect**: No default value
- **Maximum KB per second of each API connection**: 100000
- **Private key in Base58 of the server for signatures**: No default value
- **Implicit account of the service provider in HEX**: No default value

---

## Contract Architecture

### Who

- **Contract owner**
  - Deploys/initializes the contract and controls lifecycle
  - Admin methods in `src/lib.rs`:
    - Pause/resume: `pause_contract()`, `resume_contract()`
    - Upgrade controls: `propose_upgrade()`, `cancel_upgrade()`, `finalize_upgrade()`
    - Signer management: `add_authorized_signer()`, `remove_authorized_signer()`

- **Token holders**
  - Own, transfer, and burn RODiT tokens
  - Methods: `rodit_transfer()`, `rodit_burn()`, views like `rodit_tokens_for_owner()`

- **Authorized signers**
  - Keys permitted to sign fee data for minting (stored in `authorized_signers: UnorderedSet<Vec<u8>>`)

- **Integrators**
  - Use view functions for metadata, tokens, and stats (read-only)

### Core Types

**In `src/lib.rs`**:
- `Token` with `owner_id: AccountId`
- `TokenMetadata` with API-policy fields (e.g., `openapijson_url`, `permissioned_routes`, `jwt_duration`, `serviceprovider_id`)
- `JsonToken` view wrapper (token_id, owner_id, metadata)
- `RoditContractMetadata` with embedded JSON-LD context `DID_WBA_JSON_LD`
- `ContractStatus`: `Active | Paused | Upgrading`
- `ContractStats`: `created_at`, `last_updated_at`, `total_supply`

### Storage Layout

**In `src/lib.rs`**:
- `tokens_by_id: LookupMap<String, Token>`
- `token_metadata_by_id: UnorderedMap<String, TokenMetadata>`
- `tokens_per_owner: LookupMap<AccountId, Vector<String>>` (ordered per owner)
- `authorized_signers: UnorderedSet<Vec<u8>>`
- `upgrade_config: upgrade::ContractUpgrade`
- `mint_rate_limits: LookupMap<AccountId, Vec<u64>>`

### Code Layout

- **`src/lib.rs`**: Main contract, state, endpoints, and views
- **`src/events.rs`**: NEP-297-style event emitters
- **`src/storage.rs`**: Storage and fee handling (`handle_account_fees_and_storage()`)
- **`src/token_validation.rs`**: Metadata validation for minting
- **`src/upgrade.rs`**: Time-locked upgrade configuration and helpers

### Contract Constants

- `RODIT_METADATA_SPEC = "RODiTCorp-near.org-20251027"`
- Issuer URL: `"20251027.rodit.org"`

---

## Token Metadata Guide

### TokenMetadata Structure

All fields are strings on-chain for robust, uniform serialization:

- **`openapijson_url`**: URL to the OpenAPI (or equivalent) JSON describing the signing/API service
- **`not_after`**: Expiration date in `YYYY-MM-DD` (use `1970-01-01` to indicate no limit)
- **`not_before`**: Activation date in `YYYY-MM-DD`
- **`max_requests`**: Integer as string (0 = unlimited)
- **`maxrq_window`**: Integer as string representing the rate-window seconds (0 = unlimited window)
- **`webhook_url`**: HTTPS endpoint to receive event callbacks
- **`webhook_cidr`**: CIDR(s) allowed to deliver webhooks
- **`userselected_dn`**: Optional user-specified display name / DN
- **`allowed_cidr`**: CIDR(s) allowed for runtime usage (environment-bound)
- **`allowed_iso3166list`**: JSON string, e.g. `{"allow":["WLD"]}` indicating country policy
- **`jwt_duration`**: Integer as string; JWT validity seconds (0 = unlimited)
- **`permissioned_routes`**: JSON string describing entity/method permissions
- **`subjectuniqueidentifier_url`**: URL pointing to a stable identity/subject descriptor for the token's subject
- **`serviceprovider_id`**: An internal identifier string for the issuing service
- **`serviceprovider_signature`**: Issuer's signature over fee/issuance data

### Token Profiles

#### 1) Root RODiT (mint root)
- **Environment**: Private Server / Private network
- **Purpose**: Top-level authority for a service provider

**Key Defaults**:
- `not_after`: `1970-01-01` (no limit)
- `max_requests`: `0` (no limit)
- `allowed_cidr`: `0.0.0.0/0` for unconstrained lab testing
- `jwt_duration`: `0` (no limit)
- `serviceprovider_id`: `bc=near.org;sc=roditcorp-com.near;id=<token_id>`

#### 2) Server RODiT (mint server)
- **Environment**: Private network
- **Purpose**: Server-side token used to authorize issuance/operations for client tokens

**Key Defaults**:
- `not_after`: `1970-01-01` (no limit)
- `jwt_duration`: `3600`
- Inherits `serviceprovider_id` from root

#### 3) Client RODiT (mint client)
- **Environment**: Public Internet
- **Purpose**: End-client/API-consumer token tied to actual API routing and limits

**Key Defaults**:
- `max_requests`: Numeric as string (has a cost)
- `maxrq_window`: Numeric as string (has a cost)
- `jwt_duration`: `3600` (policy-driven)
- `webhook_url`: `https://not-set.example.com/webhook` if unused

### JSON Examples

#### Root Example
```json
{
  "openapijson_url": "https://root.internal.example/api-docs",
  "not_after": "1970-01-01",
  "not_before": "2025-08-29",
  "max_requests": "0",
  "maxrq_window": "0",
  "webhook_url": "https://not-set.example.com/webhook",
  "webhook_cidr": "0.0.0.0/0",
  "userselected_dn": "",
  "allowed_cidr": "0.0.0.0/0",
  "allowed_iso3166list": "{\"allow\":[\"WLD\"]}",
  "jwt_duration": "0",
  "permissioned_routes": "{\"entities\":{\"name\":\"thing\",\"methods\":{\"/crud/onemethod\":\"+0\",\"/crud/anothermethod\":\"+0\"}}}",
  "subjectuniqueidentifier_url": "https://root.internal.example/subject",
  "serviceprovider_id": "bc=near.org;sc=roditcorp-com.near;id=<ROOT_TOKEN_ID>",
  "serviceprovider_signature": "<signature>"
}
```

#### Client Example
```json
{
  "openapijson_url": "https://api.public.example/api-docs",
  "not_after": "1970-01-01",
  "not_before": "2025-08-29",
  "max_requests": "100000",
  "maxrq_window": "86400",
  "webhook_url": "https://not-set.example.com/webhook",
  "webhook_cidr": "203.0.113.0/24",
  "userselected_dn": "example-client",
  "allowed_cidr": "203.0.113.0/24",
  "allowed_iso3166list": "{\"allow\":[\"WLD\"]}",
  "jwt_duration": "3600",
  "permissioned_routes": "{\"entities\":{\"name\":\"thing\",\"methods\":{\"/crud/onemethod\":\"+0\",\"/crud/anothermethod\":\"+0\"}}}",
  "subjectuniqueidentifier_url": "https://subjects.example/clients/123",
  "serviceprovider_id": "bc=near.org;sc=roditcorp-com.near;id=<ROOT_OR_SERVER_TOKEN_ID>",
  "serviceprovider_signature": "<signature>"
}
```

### Operational Layers

- **Portal Sanctum FE**: Root profile inputs (operator UI), authenticates to Signroot
  - URL: https://testnet-serverfe.cableguard.net:6443/
- **Signroot**: Root RODiT ("mint root"), produces serviceprovider_id and signature
  - URL: https://dev-api.cableguard.net:8443
- **Server FE**: Server RODiT ("mint server"), authenticates to Sanctum
  - URL: https://testnet-serverfe.cableguard.net:2443/
- **Signserver**: Server RODiT issuance (backend signer)
  - URL: https://dev-api.cableguard.net:8443
- **Client FE**: Client RODiT ("mint client"), authenticates to Server
  - URL: mint.APIURL:4443
- **Signclient**: Client RODiT issuance (backend signer), sanitizes permissioned_routes
  - URL: sign.APIURL:8443
- **Signportal**: Client onboarding via Portal
  - URL: https://testnet-clientfe.cableguard.net:6443/

---

## Security Features

### Security Fixes Applied

#### ✅ Signature Binding to Parameters (CRITICAL)
- Fee signature is now bound to function parameters
- Prevents replay attacks where a valid signature for one token could be used to mint a different token
- Verifies `token_id`, `mintingfeeaccount`, and `owneraccount_id` match before signature verification

#### ✅ 1 Yocto Guards (HIGH)
- All state-changing functions now require 1 yocto deposit
- Prevents misuse with function-call access keys
- Applied to: transfer, burn, recover, signer management, fee management, pause/resume

#### ✅ Rate-Limit Storage Leak Fixed (HIGH)
- Changed from `Vector<u64>` to `Vec<u64>` to eliminate storage leaks
- Eliminates orphaned storage and reduces storage costs per account

#### ✅ Self-Transfer Removed (MEDIUM)
- Removed redundant transfer of contract fees to itself
- Saves ~2.5 Tgas per mint operation

#### ✅ JSON-LD Context Fixed (MEDIUM)
- Removed JavaScript-style comments from `DID_WBA_JSON_LD` constant
- Now parseable by standard JSON parsers

#### ✅ Configuration Introspection Added (MEDIUM)
- New `get_config()` view function
- Returns contract account ID, owner, status, version, signer count, and fee configuration
- Helps prevent misconfiguration issues (e.g., adding signers to wrong contract)

### Security Improvements

#### ✅ Upgrade Delay Enhancement (HIGH)
- Increased default upgrade delay from 30 seconds to **24 hours**
- Bounds: minimum 1 hour, maximum 7 days
- Provides users adequate time to review and respond to contract upgrades

#### ✅ Conditional Debug Logging (MEDIUM-HIGH)
- Debug logs wrapped in `#[cfg(debug_assertions)]` blocks
- Completely removed from production releases
- Significant gas cost reduction

#### ✅ Configurable Fee System (MEDIUM)
- **ContractFees struct**: Stores configurable fee values
- **Fee management functions**:
  - `set_initialize_fee()`: Update initialization fee (0.00001 - 1 NEAR)
  - `set_contract_fee_percentage()`: Update contract fee (0% - 10%)
  - `set_storage_cost_per_byte()`: Update storage costs (0.000001 - 0.0001 NEAR)
  - `get_fees()`: View current fee configuration

#### ✅ Rate Limiting System (HIGH)
- **Rate limit window**: 1 hour (3600 seconds)
- **Maximum mints per window**: 10 mints per account
- **Automatic cleanup**: Old timestamps are removed from tracking
- **View function**: `get_remaining_mints()` to check available mints
- Prevents spam attacks and abuse

#### ✅ Storage Cost Management (MEDIUM)
- **Automatic storage calculation**: Storage costs calculated from actual usage during minting
- **Included in minting fee**: No pre-deposit required
- **Direct refunds on burn**: Storage refunded directly to the user when tokens are burned
- **Transparent tracking**: Storage usage is logged

#### ✅ Enhanced Input Validation (MEDIUM)
- **URL Validation**: Enforces HTTPS-only, validates domain structure
- **Date Validation**: Validates YYYY-MM-DD format, checks year/month/day ranges
- **CIDR Validation**: Validates CIDR notation format, checks IP octet ranges
- **Numeric Validation**: Prevents leading zeros, ensures valid u64 range

---

## API Reference

### Fee Management Functions

#### Set Initialize Fee
```bash
near call <contract_id> set_initialize_fee '{"new_fee": "100000000000000000000"}' --accountId <owner_account>
```
**Range**: 0.00001 NEAR to 1 NEAR (in yoctoNEAR)

#### Set Contract Fee Percentage
```bash
near call <contract_id> set_contract_fee_percentage '{"new_percentage": 2}' --accountId <owner_account>
```
**Range**: 0% to 10%

#### Set Storage Cost Per Byte
```bash
near call <contract_id> set_storage_cost_per_byte '{"new_cost": "10000000000000000000"}' --accountId <owner_account>
```
**Range**: 0.000001 NEAR to 0.0001 NEAR (in yoctoNEAR)

#### View Current Fees
```bash
near view <contract_id> get_fees
```

### Rate Limiting Functions

#### Check Remaining Mints
```bash
near view <contract_id> get_remaining_mints '{"account_id": "user.testnet"}'
```
**Returns**: Number of mints remaining in current 1-hour window (max 10)

**Rate Limit Details**:
- **Window**: 1 hour (3600 seconds)
- **Max mints per window**: 10
- **Automatic**: Rate limit is checked automatically during minting

### Upgrade Management Functions

#### Propose Upgrade
```bash
near call <contract_id> propose_upgrade --accountId <owner_account>
```
**Note**: Starts 24-hour delay period

#### Check Upgrade Status
```bash
near view <contract_id> get_upgrade_status
```
**Returns**: Remaining seconds until upgrade can be finalized (or null if no upgrade pending)

#### Cancel Upgrade
```bash
near call <contract_id> cancel_upgrade --accountId <owner_account>
```

#### Finalize Upgrade
```bash
near call <contract_id> finalize_upgrade --accountId <owner_account>
```
**Note**: Can only be called after 24-hour delay

#### Set Upgrade Delay
```bash
near call <contract_id> set_upgrade_delay '{"new_delay": 172800}' --accountId <owner_account>
```
**Range**: 3600 seconds (1 hour) to 604800 seconds (7 days)

### Query Functions

#### Get Contract Status
```bash
near view <contract_id> get_contract_status
```
**Returns**: `Active`, `Paused`, or `Upgrading`

#### Get Contract Stats
```bash
near view <contract_id> get_contract_stats
```
**Returns**: Creation time, last update time, and total supply

#### View Authorized Signers
```bash
near view <contract_id> view_authorized_signers
```
**Returns**: Array of public key hex strings

#### Get Configuration
```bash
near view <contract_id> get_config
```
**Returns**: Contract account ID, owner, status, version, signer count, and fee configuration

### Token Operations

#### Mint Token
```bash
near call <contract_id> rodit_mint '{"token_id":"<token_id>","metadata":{...},"fee_data_json":"<fee_json>","fee_signature_base64url":"<signature>","mintingfee_account":"<account>","owneraccount_id":"<owner>"}' --accountId <account> --amount <fee>
```

#### Transfer Token
```bash
near call <contract_id> rodit_transfer '{"receiver_id":"<receiver>.testnet","token_id":"<token_id>","memo":null}' --accountId <owner_account> --depositYocto 1
```

#### Burn Token
```bash
near call <contract_id> rodit_burn '{"token_id":"<token_id>"}' --accountId <owner_account> --depositYocto 1
```

#### View Token
```bash
near view <contract_id> rodit_token '{"token_id":"<token_id>"}'
```

#### View Tokens for Owner
```bash
near view <contract_id> rodit_tokens_for_owner '{"account_id":"<account_id>","from_index":"0","limit":10}'
```

#### View All Tokens
```bash
near view <contract_id> rodit_tokens '{"from_index":"0","limit":10}'
```

#### View Metadata JSON-LD
```bash
near view <contract_id> rodit_metadata_jsonld
```

### Event Schema (NEP-297 Style)

All events use this envelope:

```json
{
  "standard": "PENDING nepXXX",
  "version": "RODiTCorp-near.org-20251027",
  "event": "<event_name>",
  "data": [ { /* event-specific object */ } ]
}
```

**Event Types**:
- `rodit_mint`: Token minted
- `rodit_transfer`: Token transferred
- `rodit_burn`: Token burned
- `rodit_recover`: Token recovered
- `rodit_storage_payment`: Storage payment made
- `rodit_contract_fee`: Contract fee collected
- `rodit_provider_fee`: Provider fee collected
- `rodit_signer_added`: Authorized signer added
- `rodit_signer_removed`: Authorized signer removed
- `rodit_status_change`: Contract status changed

### Gas Cost Estimates

| Operation | Estimated Gas | Notes |
|-----------|--------------|-------|
| `rodit_mint` (with rate limit) | ~50-70 TGas | Includes rate limit check and storage |
| `rodit_burn` | ~10-15 TGas | Includes storage refund |
| `set_initialize_fee` | ~3-5 TGas | Owner-only, simple update |
| `get_remaining_mints` | <1 TGas | View function |
| `get_fees` | <1 TGas | View function |

**Note**: Gas costs in production (release mode) are lower due to removed debug logging.

---

## Deployment Guide

### Fresh Testnet Account Deployment

1. **Build the contract WASM**:
   ```bash
   cargo near build --release
   ```

2. **Deploy code to testnet**:
   ```bash
   near deploy --accountId roditcorp-com.near --wasmFile target/wasm32-unknown-unknown/release/rodit_contract.wasm
   ```

3. **Initialize the contract**:
   ```bash
   near call roditcorp-com.near init '{"owner_id":"roditcorp-com.near","metadata":null}' --accountId roditcorp-com.near
   ```

### Notes

When CONTRACT_NAME=roditcorp-com.near
Then replacing - with . we get 
pub const CONTRACT_NAME: &str = "20251027.rodit.org";
Where rodit.org is the controlling domain for the contract.

### Deployment Checklist

- [ ] Compile contract in release mode (debug logs disabled)
- [ ] Verify upgrade delay is set to 24 hours
- [ ] Configure appropriate fee values for your use case
- [ ] Add authorized signers for fee verification
- [ ] Test all rate limiting scenarios
- [ ] Verify storage refunds work correctly on burn
- [ ] Run full test suite
- [ ] Deploy to testnet first
- [ ] Monitor for any issues before mainnet deployment

### Migration from Previous Version

If upgrading from an older contract version:

1. **Automatic Migration**: The `upgrade()` function handles state migration
2. **New Fields**: All new fields are initialized with safe defaults
3. **Backward Compatible**: Existing functions work as before
4. **New Features**: Available immediately after upgrade

**Post-Upgrade Checklist**:
- [ ] Verify fees are set correctly: `get_fees`
- [ ] Check upgrade delay: `get_upgrade_status`
- [ ] Test rate limiting with a test mint
- [ ] Verify storage refunds work correctly on burn

---

## Troubleshooting

### "Rate limit exceeded" Error
**Solution**: Wait for the rate limit window to reset (up to 1 hour) or check remaining mints with `get_remaining_mints`.

### "Upgrade delay period has not passed" Error
**Solution**: Wait for the full 24-hour delay period before calling `finalize_upgrade`.

### "Only the contract owner can call this function" Error
**Solution**: Fee management and upgrade functions can only be called by the contract owner account.

### "No authorized signers configured" Error
**Solution**: Ensure you're adding signers to the correct contract that the frontend actually calls. Check the contract address in your configuration files.

---

## Licensing & Compliance

- All rights reserved.
- For trials/evaluation, contact: **rodit@rodit.org**

---

## Additional Resources

- **Security Documentation**: All security fixes and improvements documented above
- **Contract Source**: Review `src/lib.rs` for implementation details
- **Validation Logic**: See `src/token_validation.rs` for input validation
- **Event Logging**: See `src/events.rs` for NEP-297 event implementation
- **Storage Management**: See `src/storage.rs` for fee and storage handling
- **Upgrade System**: See `src/upgrade.rs` for time-locked upgrade mechanism

---

## Tips for Developers

1. **Testing**: Always test on testnet before mainnet deployment
2. **Monitoring**: Set up monitoring for rate limit violations
3. **Storage**: Storage costs are automatically handled in minting fees
4. **Fees**: Start with default fees and adjust based on usage patterns
5. **Upgrades**: Communicate upgrade proposals to users in advance
6. **Configuration**: Use `get_config()` to verify correct contract configuration

---

**Last Updated**: 2025-10-02
