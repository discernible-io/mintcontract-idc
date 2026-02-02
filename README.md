![discernible logo banner](./discernible-banner.png)

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

RODiT (Rich Online Digital Token) is a NEAR smart contract that manages API access tokens with comprehensive policy metadata. The Discernible DEV API forge creates sets of RODiT tokens with all the configuration and subscription information necessary to set up Discernible TUN API calls.

Authentication between API clients and server uses Public Key Cryptography (PKC) with a twist: ownership of the RODiTs is double-checked with the NEAR Protocol in real time, and the PKC pair used is the key pair of the RODIT token itself.

Read more: https://vaceituno.medium.com/unleashing-the-power-of-public-key-cryptography-with-non-fungible-tokens-513286d47524

### What is RODiT?

A production-ready NEAR smart contract for managing API-access tokens with strong metadata semantics, security features, and upgrade discipline.

**Core Features**:
- **Token Minting**: Create API access tokens with comprehensive metadata including rate limits, CIDR restrictions, JWT duration, and permissioned routes
- **Token Transfer**: Transfer tokens between NEAR accounts with event logging
- **Token Burning**: Destroy tokens with automatic storage refunds
- **Fee Management**: Configurable initialization fees, contract fee percentages, and storage costs
- **Rate Limiting**: Prevent spam with 10 mints per hour per account
- **Signature Verification**: Ed25519 signature verification for fee authorization
- **Time-Locked Upgrades**: 24-hour delay mechanism for secure contract upgrades
- **Storage Management**: Automatic tracking and refunding of storage costs
- **Event Logging**: NEP-297-style standardized event emission
- **JSON-LD Metadata**: Semantic interoperability with DID:wba vocabulary

**Security Features**:
- Checks-effects-interactions pattern to prevent reentrancy attacks
- Arithmetic overflow protection with checked operations
- Rate limiting to prevent spam and DoS attacks
- Time-delayed contract upgrades for security review periods
- Comprehensive input validation on all metadata fields
- Owner-only access control for administrative functions
- 1 yoctoNEAR deposit requirement on state-changing functions to prevent function-call access key misuse

---

## Quick Start

### Prerequisites

**Required Tools**:
- **NEAR CLI**: Install the Rust-based NEAR CLI
  ```bash
  cargo install near-cli-rs
  ```
- **Rust Toolchain**: Required for building the contract
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  rustup target add wasm32-unknown-unknown
  ```
- **NEAR Account**: You need a NEAR account with sufficient balance
  - Testnet: Create at https://testnet.mynearwallet.com/
  - Mainnet: Create at https://app.mynearwallet.com/

**Account Balance Requirements**:
- **Testnet**: ~1-2 NEAR for contract deployment and storage
- **Mainnet**: ~1-2 NEAR for contract deployment and storage

### Build the Contract

```bash
# Clone the repository
git clone <repository-url>
cd mintrscontractapi-rodit

# Build the contract (this creates the WASM file)
cargo near build non-reproducible-wasm --no-abi
```

The compiled contract will be at: `./target/near/rodit_near.wasm`

---

## Deployment Guide

### Testnet Deployment

#### Option 1: Using the Deploy Script (Recommended)

The `deploy.sh` script handles initial deployment and upgrades automatically:

```bash
# Deploy to testnet with default RPC
./deploy.sh your-account.testnet testnet

# Or use FastNEAR RPC for better performance
./deploy.sh your-account.testnet testnet-fastnear
```

**What the script does**:
1. Checks Rust environment and installs `wasm32-unknown-unknown` if needed
2. Builds the contract with `cargo near build`
3. Checks if contract is already initialized
4. If not initialized:
   - Deploys the WASM code
   - Calls `init()` to initialize the contract
5. If already initialized (upgrade flow):
   - Proposes upgrade
   - Waits for upgrade delay period (30 seconds for testnet)
   - Finalizes upgrade
   - Deploys new contract code
   - Resumes contract

#### Option 2: Manual Deployment

**Step 1: Deploy the contract code**
```bash
near contract deploy your-account.testnet \
  use-file ./target/near/rodit_near.wasm \
  without-init-call \
  network-config testnet \
  sign-with-legacy-keychain \
  send
```

**Step 2: Initialize the contract**
```bash
near call your-account.testnet init \
  '{"owner_id":"your-account.testnet","metadata":null}' \
  --use-account your-account.testnet \
  --network-id testnet \
  --gas 100000000000000 \
  --deposit 0
```

**Step 3: Verify deployment**
```bash
near view your-account.testnet get_contract_status \
  network-config testnet now
```

---

### Mainnet Deployment

#### Option 1: Using the Deploy Script (Recommended)

**Important**: Mainnet deployment requires your account credentials in `~/.near-credentials/mainnet/`

```bash
# Deploy to mainnet using FastNEAR RPC (recommended for reliability)
./deploy.sh your-account.near mainnet-fastnear

# Or use Lava RPC
./deploy.sh your-account.near mainnet-lava

# Or use custom RPC endpoint
./deploy.sh your-account.near mainnet https://rpc.mainnet.near.org
```

**Available Mainnet RPC Endpoints**:
- `mainnet-fastnear`: https://free.rpc.fastnear.com/ (recommended)
- `mainnet-lava`: https://near.lava.build/
- Custom: You can specify any mainnet RPC URL

**Deployment Process**:
1. The script uses `sign-with-legacy-keychain` to read credentials from `~/.near-credentials/mainnet/your-account.near.json`
2. Builds the contract
3. Deploys and initializes (or upgrades if already deployed)
4. Provides transaction links to NEAR Explorer

#### Option 2: Manual Mainnet Deployment

**Step 1: Ensure you have credentials**
```bash
# Check if credentials exist
ls ~/.near-credentials/mainnet/your-account.near.json
```

**Step 2: Deploy the contract**
```bash
near contract deploy your-account.near \
  use-file ./target/near/rodit_near.wasm \
  without-init-call \
  network-config mainnet-fastnear \
  sign-with-legacy-keychain \
  send
```

**Step 3: Initialize the contract**
```bash
near call your-account.near init \
  '{"owner_id":"your-account.near","metadata":null}' \
  --use-account your-account.near \
  --network-id mainnet-fastnear \
  --gas 100000000000000 \
  --deposit 0
```

**Step 4: Verify deployment**
```bash
near view your-account.near get_contract_status \
  network-config mainnet-fastnear now

# Check contract configuration
near view your-account.near get_config \
  network-config mainnet-fastnear now
```

---

### Post-Deployment Configuration

#### 1. Add Authorized Signers

For fee signature verification, add authorized public keys:

```bash
# Add a signer (public key must be 64-character lowercase hex)
near call your-account.near add_authorized_signer \
  '{"public_key_hex":"your_64_char_hex_public_key"}' \
  --use-account your-account.near \
  --network-id mainnet-fastnear \
  --gas 100000000000000 \
  --deposit 0.000000000000000000000001
```

#### 2. Configure Fees (Optional)

```bash
# Set initialization fee (in yoctoNEAR)
near call your-account.near set_initialize_fee \
  '{"new_fee":"100000000000000000000"}' \
  --use-account your-account.near \
  --network-id mainnet-fastnear \
  --gas 100000000000000 \
  --deposit 0.000000000000000000000001

# Set contract fee percentage (0-10%)
near call your-account.near set_contract_fee_percentage \
  '{"new_percentage":1}' \
  --use-account your-account.near \
  --network-id mainnet-fastnear \
  --gas 100000000000000 \
  --deposit 0.000000000000000000000001
```

#### 3. Verify Configuration

```bash
# View all fees
near view your-account.near get_fees \
  network-config mainnet-fastnear now

# View complete configuration
near view your-account.near get_config \
  network-config mainnet-fastnear now
```

---

### Upgrading an Existing Contract

The upgrade process uses a time-locked mechanism for security:

**Using the deploy script** (handles everything automatically):
```bash
./deploy.sh your-account.near mainnet-fastnear
```

**Manual upgrade process**:

```bash
# Step 1: Propose upgrade
near call your-account.near propose_upgrade '{}' \
  --use-account your-account.near \
  --network-id mainnet-fastnear \
  --gas 100000000000000 \
  --deposit 0

# Step 2: Wait for upgrade delay (24 hours on mainnet)
# Check remaining time:
near view your-account.near get_upgrade_status \
  network-config mainnet-fastnear now

# Step 3: Finalize upgrade
near call your-account.near finalize_upgrade '{}' \
  --use-account your-account.near \
  --network-id mainnet-fastnear \
  --gas 100000000000000 \
  --deposit 0

# Step 4: Deploy new contract code
near contract deploy your-account.near \
  use-file ./target/near/rodit_near.wasm \
  with-init-call upgrade \
  json-args '{}' \
  prepaid-gas '30.0 Tgas' \
  attached-deposit '0 NEAR' \
  network-config mainnet-fastnear \
  sign-with-legacy-keychain \
  send

# Step 5: Resume contract
near call your-account.near resume_contract '{}' \
  --use-account your-account.near \
  --network-id mainnet-fastnear \
  --gas 100000000000000 \
  --deposit 0.000000000000000000000001
```

---

### Troubleshooting

**Issue**: `Failed to get network config`
- **Solution**: Check the network name spelling (e.g., `mainnet` not `mainnnet`)

**Issue**: `Failed to fetch access key list`
- **Solution**: Verify credentials exist in `~/.near-credentials/mainnet/your-account.near.json`
- **Solution**: Try a different RPC endpoint (e.g., `mainnet-fastnear` instead of `mainnet`)

**Issue**: `error while sending payload`
- **Solution**: RPC endpoint may be down or rate-limited, try alternative endpoints:
  - `mainnet-fastnear`
  - `mainnet-lava`
  - Custom RPC URL

**Issue**: Interactive prompts during deployment
- **Solution**: Pre-configure network connections or use existing ones like `mainnet-fastnear`
- **Solution**: The deploy script now uses `sign-with-legacy-keychain` to avoid keychain prompts

---

### Network Configuration

View available network connections:
```bash
near config show-connections
```

Add a custom network connection:
```bash
near config add-connection \
  --network-name mainnet \
  --connection-name my-mainnet \
  --rpc-url https://rpc.mainnet.near.org \
  --wallet-url https://app.mynearwallet.com/ \
  --explorer-transaction-url https://explorer.near.org/transactions/
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

The RODiT contract is structured as a modular Rust smart contract with the following components:

### File Structure

```
src/
├── lib.rs              # Main contract logic and state
├── token_validation.rs # Token metadata validation
├── events.rs           # NEP-297 event emission
├── storage.rs          # Storage cost management
└── upgrade.rs          # Time-locked upgrade mechanism
```

### Contract State (`Contract` struct)

The main contract state includes:

```rust
pub struct Contract {
    pub owner_id: AccountId,                                    // Contract owner
    pub tokens_per_owner: LookupMap<AccountId, Vector<String>>, // Owner → token IDs
    pub tokens_by_id: LookupMap<String, Token>,                 // Token ID → token
    pub token_metadata_by_id: UnorderedMap<String, TokenMetadata>, // Token ID → metadata
    pub metadata: RoditContractMetadata,                        // Contract metadata
    pub status: ContractStatus,                                 // Active/Paused/Upgrading
    pub stats: ContractStats,                                   // Supply, timestamps
    pub authorized_signers: UnorderedSet<Vec<u8>>,             // Ed25519 public keys
    pub upgrade_config: ContractUpgrade,                        // Upgrade state
    pub fees: ContractFees,                                     // Fee configuration
    pub mint_rate_limits: LookupMap<AccountId, Vec<u64>>,      // Rate limiting
}
```

### Key Constants

Defined in `src/lib.rs`:

- `RODIT_METADATA_SPEC`: `"RODiTCorp-near.org-20251027"` - Contract version
- `CONTRACT_NAME`: `"20251027.rodit.org"` - Issuer identifier
- `DEFAULT_INITIALIZE_FEE`: 0.0001 NEAR - Default initialization fee
- `DEFAULT_CONTRACT_FEE_PERCENTAGE`: 1% - Default contract fee
- `RATE_LIMIT_WINDOW`: 3600 seconds (1 hour)
- `MAX_MINTS_PER_WINDOW`: 10 mints per account per hour

### Core Data Types

**ContractStatus** (enum):
```rust
pub enum ContractStatus {
    Active,      // Normal operations
    Paused,      // Operations suspended
    Upgrading    // Upgrade in progress
}
```

**TokenMetadata** (struct):
```rust
pub struct TokenMetadata {
    pub openapijson_url: String,              // OpenAPI specification URL
    pub not_after: String,                    // Expiration date
    pub not_before: String,                   // Start date
    pub max_requests: String,                 // Request limit
    pub maxrq_window: String,                 // Time window for limits
    pub webhook_url: String,                  // Webhook endpoint
    pub webhook_cidr: String,                 // Webhook IP restrictions
    pub userselected_dn: String,              // User-selected display name
    pub allowed_cidr: String,                 // Allowed IP ranges
    pub allowed_iso3166list: String,          // Allowed countries
    pub jwt_duration: String,                 // JWT validity period
    pub permissioned_routes: String,          // JSON of allowed routes
    pub subjectuniqueidentifier_url: String,  // Subject identifier
    pub serviceprovider_id: String,           // Service provider ID
    pub serviceprovider_signature: String,    // Provider signature
}
```

### Main Functions

#### Token Lifecycle

1. **`rodit_mint()`** - Create new tokens
   - Validates metadata fields
   - Checks rate limits
   - Verifies Ed25519 signature on fee data
   - Handles storage deposits and fees
   - Emits mint event

2. **`rodit_transfer()`** - Transfer tokens
   - Requires 1 yoctoNEAR deposit
   - Validates ownership
   - Updates state atomically
   - Emits transfer event

3. **`rodit_burn()`** - Destroy tokens
   - Requires 1 yoctoNEAR deposit
   - Refunds storage costs
   - Updates supply
   - Emits burn event

#### Query Functions

- `rodit_token(token_id)` - Get single token with metadata
- `rodit_tokens(from_index, limit)` - Paginated token list
- `rodit_tokens_for_owner(account_id, from_index, limit)` - Owner's tokens
- `rodit_supply_for_owner(account_id)` - Token count per owner
- `rodit_total_supply()` - Total token count
- `rodit_metadata()` - Contract metadata
- `get_contract_status()` - Current contract status
- `get_contract_stats()` - Supply and timestamps
- `get_fees()` - Current fee configuration
- `get_config()` - Complete contract configuration

#### Administrative Functions

**Contract Management**:
- `pause_contract()` - Suspend operations (owner only)
- `resume_contract()` - Resume operations (owner only)
- `recover_token(token_id, destination)` - Recover lost tokens (owner only)

**Upgrade Management** (time-locked):
- `propose_upgrade()` - Start upgrade process (24-hour delay)
- `cancel_upgrade()` - Cancel pending upgrade
- `finalize_upgrade()` - Complete upgrade after delay
- `get_upgrade_status()` - Check remaining time
- `upgrade()` - Migration function called during deployment

**Signer Management**:
- `add_authorized_signer(public_key_hex)` - Add Ed25519 public key
- `remove_authorized_signer(public_key_hex)` - Remove public key

**Fee Management**:
- `set_initialize_fee(new_fee)` - Update initialization fee
- `set_contract_fee_percentage(new_percentage)` - Update contract fee (0-10%)
- `set_storage_cost_per_byte(new_cost)` - Update storage cost

### Security Patterns

1. **Checks-Effects-Interactions**: All state changes happen before external calls
2. **Reentrancy Protection**: State updates complete before Promise calls
3. **Arithmetic Safety**: All arithmetic uses checked operations
4. **Access Control**: Owner-only functions use `assert_owner()`
5. **Rate Limiting**: Per-account mint limits prevent spam
6. **Input Validation**: Comprehensive validation in `token_validation.rs`
7. **1 yoctoNEAR Pattern**: Prevents function-call access key misuse

### Module Breakdown

**`token_validation.rs`**:
- Validates all token metadata fields
- Checks URL formats, date formats, CIDR notation
- Validates JSON structures for permissioned routes

**`events.rs`**:
- NEP-297 compliant event emission
- Events: mint, transfer, burn, recover, signer_added, signer_removed, contract_status_change

**`storage.rs`**:
- Calculates storage costs
- Handles fee distribution
- Manages storage deposits and refunds

**`upgrade.rs`**:
- Time-locked upgrade state machine
- 24-hour delay for mainnet safety
- Prevents unauthorized upgrades

### Roles

- **Contract Owner**: Deploys, configures, and manages the contract lifecycle
- **Token Holders**: Own, transfer, and burn tokens
- **Authorized Signers**: Sign fee data for minting operations
- **Integrators**: Query contract data via view functions

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
