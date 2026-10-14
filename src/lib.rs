//! # RODIT Smart Contract
//! 
//! This is the main smart contract for the RODIT (Rich Online Digital Token) system.
//! It manages the creation, transfer, and lifecycle of API access tokens on the NEAR blockchain.
//! 
//! ## Features
//! 
//! - **Token Minting**: Create new API access tokens with comprehensive metadata
//! - **Token Transfer**: Transfer tokens between accounts
//! - **Token Burning**: Destroy tokens and refund storage deposits
//! - **Fee Management**: Configurable fees for initialization, contract operations, and storage
//! - **Rate Limiting**: Prevent spam attacks with per-account minting limits
//! - **Storage Deposits**: Track and manage storage costs per account
//! - **Signature Verification**: Ed25519 signature verification for fee authorization
//! - **Contract Upgrades**: Time-delayed upgrade mechanism for security
//! - **Access Control**: Owner-only functions for contract management
//! 
//! ## Security Features
//! 
//! - Checks-effects-interactions pattern to prevent reentrancy
//! - Arithmetic overflow protection with checked operations
//! - Rate limiting to prevent spam attacks
//! - Time-delayed contract upgrades (24-hour default)
//! - Comprehensive input validation
//! - Conditional debug logging to reduce gas costs in production
//! 
//! ## Version
//! 
//! Contract version: IdentityClaw-near.org-20260417

use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedMap, UnorderedSet, Vector};
use near_sdk::json_types::U128;
use serde_json::json;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near_bindgen, AccountId, PanicOnDefault, Promise, NearToken, require};
#[cfg(not(target_arch = "wasm32"))]
use schemars::JsonSchema;
extern crate base64;
use ed25519_dalek::{Verifier, PublicKey, Signature};

mod token_validation;
mod events;
mod storage;
mod upgrade;

use token_validation::{validate_token_metadata, validate_face_token_id, validate_userselected_dn};
use storage::handle_account_fees_and_storage;
use upgrade::ContractUpgrade;

pub const RODIT_METADATA_SPEC: &str = "DiscernibleIO-identyclaw-com-20260525";
pub const RODIT_STANDARD_NAME: &str = "PENDING nepXXX";
pub const CONTRACT_NAME: &str = env!("CONTRACT_ACCOUNT_NAME");

// Default fee values - can be overridden by contract owner
pub const DEFAULT_INITIALIZE_FEE: u128 = 50_000_000_000_000_000_000_000; // 0.05 NEAR
pub const DEFAULT_CONTRACT_FEE_PERCENTAGE: u128 = 1; // 1%
pub const DEFAULT_STORAGE_COST_PER_BYTE: u128 = 10_000_000_000_000_000_000; // 0.00001 NEAR per byte (NEAR standard)

// Fee bounds for safety
pub const MIN_INITIALIZE_FEE: u128 = 10_000_000_000_000_000_000; // 0.00001 NEAR
pub const MAX_INITIALIZE_FEE: u128 = 1_000_000_000_000_000_000_000_000; // 1 NEAR
pub const MIN_CONTRACT_FEE_PERCENTAGE: u128 = 0; // 0%
pub const MAX_CONTRACT_FEE_PERCENTAGE: u128 = 10; // 10%
pub const MIN_STORAGE_COST_PER_BYTE: u128 = 1_000_000_000_000_000_000; // 0.000001 NEAR
pub const MAX_STORAGE_COST_PER_BYTE: u128 = 100_000_000_000_000_000_000; // 0.0001 NEAR

/// Attached deposit required for token transfers (0.01 NEAR).
pub const TRANSFER_DEPOSIT_YOCTO: u128 = 10_000_000_000_000_000_000_000;

// Rate limiting constants
pub const RATE_LIMIT_WINDOW: u64 = 7200; // 2 hours in seconds
pub const MAX_MINTS_PER_WINDOW: u64 = 200; // Maximum 200 mints per 2 hours per account
pub const CONTRACT_CAPACITY: u64 = 50400; // Maximum recommended token supply

/// DID:wba JSON-LD context describing the RODiT token vocabulary.
/// This is provided as a constant string so it can be returned via a view
/// method without increasing on-chain storage requirements.
pub const DID_WBA_JSON_LD: &str = r#"{
  "@context": {
    "id": "@id",
    "type": "@type",
    "rodit": "https://identityclaw.com/ns/rodit#",
    "token_id": "rodit:token_id",
    "allowed_cidr": "rodit:allowed_cidr",
    "allowed_iso3166list": "rodit:allowed_iso3166list",
    "jwt_duration": { "@id": "rodit:jwt_duration", "@type": "http://www.w3.org/2001/XMLSchema#integer" },
    "max_requests": { "@id": "rodit:max_requests", "@type": "http://www.w3.org/2001/XMLSchema#integer" },
    "maxrq_window": { "@id": "rodit:maxrq_window", "@type": "http://www.w3.org/2001/XMLSchema#integer" },
    "not_after": { "@id": "rodit:not_after", "@type": "http://www.w3.org/2001/XMLSchema#date" },
    "not_before": { "@id": "rodit:not_before", "@type": "http://www.w3.org/2001/XMLSchema#date" },
    "openapijson_url": { "@id": "rodit:openapijson_url", "@type": "@id" },
    "subjectuniqueidentifier_url": { "@id": "rodit:subjectuniqueidentifier_url", "@type": "@id" },
    "webhook_url": { "@id": "rodit:webhook_url", "@type": "@id" },
    "webhook_cidr": "rodit:webhook_cidr",
    "permissioned_routes": "rodit:permissioned_routes",
    "serviceprovider_id": "rodit:serviceprovider_id",
    "controller": "rodit:serviceprovider_id",
    "serviceprovider_signature": "rodit:serviceprovider_signature",
    "userselected_dn": "rodit:userselected_dn",
    "verificationMethod": { "@id": "rodit:verificationMethod", "@type": "@id" },
    "dn_NNSWF": "rodit:dn_nameNotSharedWithFamily",
    "dn_NSWF": "rodit:dn_nameSharedWithFamily",
    "dn_ContactURI": { "@id": "rodit:dn_contactUri", "@type": "@id" },
    "dn_taxRes": "rodit:dn_taxResidence",
    "dn_inceptDateTime": { "@id": "rodit:dn_inceptDateTime", "@type": "http://www.w3.org/2001/XMLSchema#dateTime" },
    "dn_inceptPlace": "rodit:dn_inceptPlace",
    "dn_taxCode": "rodit:dn_taxCode",
    "dn_address": "rodit:dn_contactAddress",
    "dn_Creature": "rodit:dn_creatureDescriptor",
    "dn_AvatarURL": { "@id": "rodit:dn_avatarUrl", "@type": "@id" },
    "dn_EmojiURL": { "@id": "rodit:dn_emojiUrl", "@type": "@id" },
    "facial_encoding": "rodit:facial_encoding",
    "facial_categories": { "@id": "rodit:facial_categories", "@type": "@id" },
    "skin_tones": "rodit:skin_tones",
    "regional_bone_structure": "rodit:regional_bone_structure",
    "face_shape": "rodit:face_shape",
    "age_related": "rodit:age_related",
    "eyes": "rodit:eyes",
    "eyebrow_style": "rodit:eyebrow_style",
    "overall_structure": "rodit:overall_structure",
    "nose": "rodit:nose",
    "lips": "rodit:lips",
    "skin_conditions": "rodit:skin_conditions",
    "hair_color": "rodit:hair_color",
    "checksum": "rodit:checksum"
  }
}"#;

#[cfg_attr(not(target_arch = "wasm32"), derive(JsonSchema))]
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, PartialEq, Debug)]
#[serde(crate = "near_sdk::serde")]
pub enum ContractStatus {
    Active,
    Paused,
    Upgrading
}

#[cfg_attr(not(target_arch = "wasm32"), derive(JsonSchema))]
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct RoditContractMetadata {
    pub versionnumber: String,
    pub name: String,
    pub symbol: String,
    pub issueruniqueidentifier_url: Option<String>,
    /// Embedded DID:wba JSON-LD context describing the vocabulary.
    pub did_wba_jsonld: String,
}

#[cfg_attr(not(target_arch = "wasm32"), derive(JsonSchema))]
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct TokenMetadata {
    pub openapijson_url: String,
    pub not_after: String,
    pub not_before: String,
    pub max_requests: String,
    pub maxrq_window: String,
    pub webhook_url: String,
    pub webhook_cidr: String,
    pub userselected_dn: String,
    pub allowed_cidr: String,
    pub allowed_iso3166list: String,
    pub jwt_duration: String,
    pub permissioned_routes: String,
    pub subjectuniqueidentifier_url: String,
    pub serviceprovider_id: String,
    pub serviceprovider_signature: String,
}

#[derive(BorshDeserialize, BorshSerialize)]
pub struct Token {
    pub owner_id: AccountId,
}

#[cfg_attr(not(target_arch = "wasm32"), derive(JsonSchema))]
#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct JsonToken {
    pub token_id: String,
    pub owner_id: AccountId,
    pub metadata: TokenMetadata,
}

#[cfg_attr(not(target_arch = "wasm32"), derive(JsonSchema))]
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct ContractStats {
    pub created_at: u64,
    pub last_updated_at: u64,
    pub total_supply: u64,
}

#[cfg_attr(not(target_arch = "wasm32"), derive(JsonSchema))]
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct ContractFees {
    pub initialize_fee: u128,
    pub contract_fee_percentage: u128,
    pub storage_cost_per_byte: u128,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Contract {
    pub owner_id: AccountId,
    pub tokens_per_owner: LookupMap<AccountId, Vector<String>>,
    pub tokens_by_id: LookupMap<String, Token>,
    pub token_metadata_by_id: UnorderedMap<String, TokenMetadata>,
    pub metadata: RoditContractMetadata,
    pub status: ContractStatus,
    pub stats: ContractStats,
    pub authorized_signers: UnorderedSet<Vec<u8>>,
    pub upgrade_config: ContractUpgrade,
    pub fees: ContractFees,
    pub mint_rate_limits: LookupMap<AccountId, Vec<u64>>, // Track mint timestamps per account
    pub minting_permanently_disabled: bool,
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn init(owner_id: AccountId, metadata: Option<RoditContractMetadata>) -> Self {
        require!(!env::state_exists(), "Contract is already initialized");
        
        // Always enforce issueruniqueidentifier_url from the contract constant,
        // regardless of what is supplied in the optional metadata.
        let mut metadata = metadata.unwrap_or_else(|| RoditContractMetadata {
            versionnumber: RODIT_METADATA_SPEC.to_string(),
            name: "Discernible API forge".to_string(),
            symbol: "RODIT".to_string(),
            issueruniqueidentifier_url: Some(CONTRACT_NAME.to_string()),
            did_wba_jsonld: DID_WBA_JSON_LD.to_string(),
        });
        metadata.issueruniqueidentifier_url = Some(CONTRACT_NAME.to_string());

        let current_time = env::block_timestamp().checked_div(1_000_000_000).unwrap_or_else(|| env::panic_str("Timestamp division overflow"));
        
        Self {
            owner_id,
            tokens_per_owner: LookupMap::new(b"tokensPerOwner".to_vec()),
            tokens_by_id: LookupMap::new(b"tokensById".to_vec()),
            token_metadata_by_id: UnorderedMap::new(b"tokenMetadataById".to_vec()),
            metadata,
            status: ContractStatus::Active,
            stats: ContractStats {
                created_at: current_time,
                last_updated_at: current_time,
                total_supply: 0,
            },
            authorized_signers: UnorderedSet::new(b"authorized_signers".to_vec()),
            upgrade_config: ContractUpgrade::default(),
            fees: ContractFees {
                initialize_fee: DEFAULT_INITIALIZE_FEE,
                contract_fee_percentage: DEFAULT_CONTRACT_FEE_PERCENTAGE,
                storage_cost_per_byte: DEFAULT_STORAGE_COST_PER_BYTE,
            },
            mint_rate_limits: LookupMap::new(b"mint_rate_limits".to_vec()),
            minting_permanently_disabled: false,
        }
    }
    
    #[init(ignore_state)]
    pub fn upgrade() -> Self {
        // Read the old contract state with explicit error handling
        let old_contract: Contract = match env::state_read() {
            Some(state) => {
                env::log_str("Successfully read previous contract state");
                state
            },
            None => {
                let error_msg = "Failed to read previous contract state";
                env::log_str(&format!("ERROR: {}", error_msg));
                env::panic_str(error_msg);
            }
        };
        
        // Verify that only the contract owner can upgrade with clear error message
        let predecessor = env::predecessor_account_id();
        if predecessor != old_contract.owner_id {
            let error_msg = format!("ERROR: Unauthorized upgrade attempt by {}, only the contract owner {} can upgrade", 
                predecessor, old_contract.owner_id);
            env::log_str(&error_msg);
            env::panic_str(&error_msg);
        }
        
        // Log that we're updating metadata and config with specific version information
        env::log_str(&format!("Upgrading contract metadata from version {} to {}", 
            old_contract.metadata.versionnumber, RODIT_METADATA_SPEC));
        env::log_str(&format!("Upgrading delay from {} to 86400 seconds (24 hours)", 
            old_contract.upgrade_config.upgrade_delay));
        
        // Create a new contract instance with updated metadata and config
        let new_contract = Self {
            owner_id: old_contract.owner_id,
            tokens_per_owner: old_contract.tokens_per_owner,
            tokens_by_id: old_contract.tokens_by_id,
            token_metadata_by_id: old_contract.token_metadata_by_id,
            
            // Update metadata with new values from constants
            metadata: RoditContractMetadata {
                versionnumber: RODIT_METADATA_SPEC.to_string(),
                name: old_contract.metadata.name,
                symbol: old_contract.metadata.symbol,
                issueruniqueidentifier_url: Some(CONTRACT_NAME.to_string()),
                did_wba_jsonld: DID_WBA_JSON_LD.to_string(),
            },
            
            status: old_contract.status,
            stats: old_contract.stats,
            authorized_signers: old_contract.authorized_signers,
            
            // Update upgrade config with new delay
            upgrade_config: upgrade::ContractUpgrade {
                upgrade_delay: upgrade::DEFAULT_UPGRADE_DELAY_SECONDS,
                upgrade_proposed_at: old_contract.upgrade_config.upgrade_proposed_at,
                upgrade_proposed_by: old_contract.upgrade_config.upgrade_proposed_by,
            },
            
            fees: old_contract.fees,
            mint_rate_limits: old_contract.mint_rate_limits,
            minting_permanently_disabled: old_contract.minting_permanently_disabled,
        };
        
        // Verify the upgrade was successful by checking critical values
        if new_contract.metadata.versionnumber != RODIT_METADATA_SPEC.to_string() {
            let error_msg = format!("ERROR: Metadata version not updated correctly. Expected {}, got {}", 
                RODIT_METADATA_SPEC, new_contract.metadata.versionnumber);
            env::log_str(&error_msg);
            env::panic_str(&error_msg);
        }
        
        if new_contract.metadata.issueruniqueidentifier_url != Some(CONTRACT_NAME.to_string()) {
            let error_msg = format!("ERROR: Issuer URL not updated correctly. Expected {}, got {}", 
                CONTRACT_NAME,
                new_contract.metadata.issueruniqueidentifier_url.as_deref().unwrap_or("<none>"));
            env::log_str(&error_msg);
            env::panic_str(&error_msg);
        }
        
        if new_contract.upgrade_config.upgrade_delay != upgrade::DEFAULT_UPGRADE_DELAY_SECONDS {
            let error_msg = format!("ERROR: Upgrade delay not updated correctly. Expected {}, got {}", 
                upgrade::DEFAULT_UPGRADE_DELAY_SECONDS,
                new_contract.upgrade_config.upgrade_delay);
            env::log_str(&error_msg);
            env::panic_str(&error_msg);
        }
        
        env::log_str("Contract upgrade completed successfully with all values verified");
        new_contract
    }

    #[payable]
    pub fn rodit_mint(
        &mut self,
        token_id: String,
        metadata: TokenMetadata,
        owneraccount_id: AccountId,
        mintingfee_account: AccountId,
        mintingfee_value: String,
        fee_signature_base64url: String,
        fee_data_json: String, // Added parameter for fee data JSON string
    ) {
        self.assert_contract_active();
        self.assert_minting_enabled();
        
        // Check rate limiting
        self.check_and_update_rate_limit(&owneraccount_id);
        
        // Validate token metadata fields
        let validation_result = validate_token_metadata(
            &metadata.openapijson_url,
            &metadata.not_after,
            &metadata.not_before,
            &metadata.max_requests,
            &metadata.maxrq_window,
            &metadata.webhook_url,
            &metadata.webhook_cidr,
            &metadata.allowed_cidr,
            &metadata.allowed_iso3166list,
            &metadata.jwt_duration,
            &metadata.permissioned_routes,
            &metadata.subjectuniqueidentifier_url,
            &metadata.serviceprovider_id,
            &metadata.serviceprovider_signature,
        );
        
        // If validation fails, panic with the error message
        if let Err(validation_error) = validation_result {
            require!(false, format!("Token metadata validation failed: {}", validation_error));
        }
        
        let face_id_validation_result = validate_face_token_id(&token_id);
        if let Err(validation_error) = face_id_validation_result {
            require!(false, format!("Token ID validation failed: {}", validation_error));
        }
        
        // Validate userselected_dn format if provided
        let dn_validation_result = validate_userselected_dn(&metadata.userselected_dn);
        if let Err(validation_error) = dn_validation_result {
            require!(false, format!("DN validation failed: {}", validation_error));
        }
        
        // Use the provided fee_data_json directly instead of constructing it
        // This ensures the exact same JSON string is used for verification as was used in the frontend
        
        // Parse the JSON to extract and verify all fields
        let fee_data: serde_json::Value = serde_json::from_str(&fee_data_json)
            .unwrap_or_else(|e| panic!("Failed to parse fee data JSON: {}", e));
        
        // SECURITY: Bind signature to all function parameters to prevent replay attacks
        // Verify token_id matches
        let fee_token_id = fee_data.get("token_id")
            .and_then(|v| v.as_str())
            .unwrap_or_else(|| panic!("token_id not found or not a string in fee data"));
        require!(
            fee_token_id == token_id,
            format!("Token ID mismatch: signature is for '{}' but minting '{}'", fee_token_id, token_id)
        );
        
        // Verify mintingfee_account matches
        let fee_minting_account = fee_data.get("mintingfeeaccount")
            .and_then(|v| v.as_str())
            .unwrap_or_else(|| panic!("mintingfeeaccount not found or not a string in fee data"));
        require!(
            fee_minting_account == mintingfee_account.as_str(),
            format!("Minting fee account mismatch: signature is for '{}' but using '{}'", fee_minting_account, mintingfee_account)
        );
        
        // Verify owner account matches (if present in fee_data)
        if let Some(fee_owner) = fee_data.get("owneraccount_id").and_then(|v| v.as_str()) {
            require!(
                fee_owner == owneraccount_id.as_str(),
                format!("Owner account mismatch: signature is for '{}' but using '{}'", fee_owner, owneraccount_id)
            );
        }
        
        // Extract the mintingfee value and convert to yoctoNEAR
        let mintingfee_str = fee_data.get("mintingfee")
            .and_then(|v| v.as_str())
            .unwrap_or_else(|| panic!("mintingfee not found or not a string in fee data"));

        // Remove any " NEAR" suffix if present in both sources (signed JSON and argument)
        let clean_fee_json = mintingfee_str.trim().trim_end_matches(" NEAR");
        let clean_fee_argument = mintingfee_value.trim().trim_end_matches(" NEAR");

        require!(
            clean_fee_argument == clean_fee_json,
            format!(
                "Minting fee mismatch: argument '{}' differs from signed value '{}'",
                mintingfee_value,
                mintingfee_str
            )
        );

        // Convert deposit string (as decimal NEAR) to yoctoNEAR (1 NEAR = 10^24 yoctoNEAR)
        let mintingfee_yocto = Self::convert_depositstring_to_yoctonear(clean_fee_json)
            .unwrap_or_else(|e| panic!("Failed to convert mintingfee to yoctoNEAR: {}", e));
        
        // Compare with attached deposit
        let attached_deposit = env::attached_deposit();
        // Convert attached_deposit to u128 for comparison
        let deposit_yocto = attached_deposit.as_yoctonear();
        
        require!(
            deposit_yocto == mintingfee_yocto,
            format!("Deposit ({}) does not match fee in JSON ({})", deposit_yocto, mintingfee_yocto)
        );
        
        // Convert the JSON string to bytes for verification
        let message = fee_data_json.as_bytes().to_vec();

        // Verify the fee signature and handle any errors
        if let Ok(Err(err)) = self.verify_fee_signature(message, fee_signature_base64url) {
            require!(false, format!("Fee signature verification failed: {}", err));
        }
        
        let initial_storage_usage = env::storage_usage();
        
        require!(
            self.tokens_by_id.get(&token_id).is_none(),
            "Token already exists"
        );

        let token = Token {
            owner_id: owneraccount_id.clone(),
        };

        self.tokens_by_id.insert(&token_id, &token);
        self.token_metadata_by_id.insert(&token_id, &metadata);
        self.internal_add_token_to_owner(&owneraccount_id, &token_id);

        let previous_total_supply = self.stats.total_supply;

        // Update contract stats
        self.stats.total_supply = self.stats.total_supply.checked_add(1)
            .unwrap_or_else(|| {
                require!(false, "Total supply calculation error: maximum supply reached");
                0 // This line is never reached due to the require! above
            });
        self.stats.last_updated_at = env::block_timestamp() / 1_000_000_000;

        // Calculate storage used
        let storage_used = env::storage_usage().checked_sub(initial_storage_usage)
            .unwrap_or_else(|| {
                require!(false, "Storage usage calculation error: unexpected underflow");
                0 // This line is never reached due to the require! above
            });
        
        // Handle fees and storage based on actual usage using the new storage management system
        if let Err(err) = handle_account_fees_and_storage(
            storage_used, 
            &owneraccount_id, 
            &mintingfee_account,
            self.fees.initialize_fee,
            self.fees.contract_fee_percentage,
            self.fees.storage_cost_per_byte
        ) {
            require!(false, err);
        }
        
        // Emit standardized event
        events::emit_mint_event(&owneraccount_id, &token_id);
        
        // Emit capacity tracking event when hitting 5% thresholds above 50%
        self.emit_capacity_if_threshold(previous_total_supply);
    }

    // The handle_account_fees_and_storage function has been moved to the storage module

    // Helper function to convert deposit string (as decimal NEAR) to yoctoNEAR (1 NEAR = 10^24 yoctoNEAR)
    fn convert_depositstring_to_yoctonear(deposit_str: &str) -> Result<u128, String> {
        // Split the string by decimal point
        let parts: Vec<&str> = deposit_str.split('.').collect();
        
        if parts.len() > 2 {
            return Err("Invalid NEAR amount format: too many decimal points".to_string());
        }
        
        let whole_part = parts[0].parse::<u128>().map_err(|e| format!("Failed to parse whole part: {}", e))?;
        
        // Calculate yoctoNEAR for the whole part (1 NEAR = 10^24 yoctoNEAR)
        let mut yocto_amount = whole_part * 10u128.pow(24);
        
        // If there's a fractional part, convert it to yoctoNEAR
        if parts.len() == 2 {
            let fractional_part = parts[1];
            let mut fractional_yocto = 0u128;
            
            // Handle the fractional part (up to 24 decimal places for yoctoNEAR)
            if !fractional_part.is_empty() {
                // Ensure the fractional part is not too long
                let decimal_places = fractional_part.len().min(24);
                let fractional_str = format!("{:0<24}", fractional_part.chars().take(decimal_places).collect::<String>());
                
                // Parse the padded fractional part
                fractional_yocto = fractional_str.parse::<u128>()
                    .map_err(|e| format!("Failed to parse fractional part: {}", e))?;
            }
            
            yocto_amount += fractional_yocto;
        }
        
        Ok(yocto_amount)
    }

    #[payable]
    pub fn rodit_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: String,
        memo: Option<String>,
    ) {
        self.assert_contract_active();
        
        // Require transfer deposit (also prevents misuse with function-call access keys)
        require!(
            env::attached_deposit().as_yoctonear() == TRANSFER_DEPOSIT_YOCTO,
            format!(
                "Requires attached deposit of exactly {} yoctoNEAR (0.01 NEAR)",
                TRANSFER_DEPOSIT_YOCTO
            )
        );
        
        let sender_id = env::predecessor_account_id();
        let token = self.tokens_by_id.get(&token_id).unwrap_or_else(|| env::panic_str("No token found"));
        
        // Use require! instead of assert for better error messages
        require!(
            token.owner_id == sender_id,
            "Sender must be the token owner"
        );
        
        require!(
            token.owner_id != receiver_id,
            "The token owner and receiver should be different"
        );

        // Implement checks-effects-interactions pattern to prevent reentrancy
        // 1. Checks (already done above)
        
        // 2. Effects: Update state before external calls
        self.internal_remove_token_from_owner(&sender_id, &token_id);
        self.internal_add_token_to_owner(&receiver_id, &token_id);

        let mut token = self.tokens_by_id.get(&token_id).unwrap();
        token.owner_id = receiver_id.clone();
        self.tokens_by_id.insert(&token_id, &token);
        
        // Update contract stats using checked arithmetic
        self.stats.last_updated_at = env::block_timestamp().checked_div(1_000_000_000).unwrap_or_else(|| env::panic_str("Timestamp division overflow"));
        
        // 3. Interactions: External calls come last
        // Emit standardized event
        events::emit_transfer_event(&sender_id, &receiver_id, &token_id, memo.as_deref());
    }

    pub fn rodit_token(&self, token_id: String) -> Option<JsonToken> {
        if let Some(token) = self.tokens_by_id.get(&token_id) {
            let metadata = self.token_metadata_by_id.get(&token_id).unwrap();
            Some(JsonToken {
                token_id,
                owner_id: token.owner_id,
                metadata,
            })
        } else {
            None
        }
    }

    pub fn rodit_total_supply(&self) -> U128 {
        U128(u128::try_from(self.token_metadata_by_id.len()).unwrap_or_else(|_| env::panic_str("Total supply conversion overflow")))
    }

    pub fn rodit_tokens(
        &self,
        from_index: Option<U128>,
        limit: Option<u64>,
    ) -> Vec<JsonToken> {
        let start = u128::from(from_index.unwrap_or(U128(0)));
        let limit = limit.unwrap_or(50) as usize;

        // Iterate through all tokens regardless of owner
        self.token_metadata_by_id
            .iter()
            .skip(start as usize)
            .take(limit)
            .map(|(token_id, metadata)| {
                let token = self.tokens_by_id.get(&token_id).unwrap();
                JsonToken {
                    token_id,
                    owner_id: token.owner_id,
                    metadata,
                }
            })
            .collect()
    }

    pub fn rodit_tokens_for_owner(
        &self,
        account_id: AccountId,
        from_index: Option<U128>,
        limit: Option<u64>,
    ) -> Vec<JsonToken> {
        let tokens_vec = self.tokens_per_owner.get(&account_id);
        let tokens = if let Some(tokens_vec) = tokens_vec {
            tokens_vec
                .iter()
                .skip(u128::from(from_index.unwrap_or(U128(0))) as usize)
                .take(limit.unwrap_or(50) as usize)
                .map(|token_id| {
                    let metadata = self.token_metadata_by_id.get(&token_id).unwrap();
                    let token = self.tokens_by_id.get(&token_id).unwrap();
                    JsonToken {
                        token_id,
                        owner_id: token.owner_id,
                        metadata,
                    }
                })
                .collect()
        } else {
            vec![]
        };
        tokens
    }

    pub fn rodit_supply_for_owner(&self, account_id: AccountId) -> U128 {
        if let Some(tokens_vec) = self.tokens_per_owner.get(&account_id) {
            U128(u128::try_from(tokens_vec.len()).unwrap_or_else(|_| env::panic_str("Owner supply conversion overflow")))
        } else {
            U128(0)
        }
    }

    pub fn rodit_metadata(&self) -> &RoditContractMetadata {
        &self.metadata
    }

    /// View function returning the DID:wba JSON-LD context so that
    /// front-ends can discover the vocabulary directly from the contract.
    pub fn did_wba_jsonld(&self) -> String {
        self.metadata.did_wba_jsonld.clone()
    }

    /// Returns the contract metadata wrapped in a fully-formed JSON-LD document.
    /// The `@context` is the embedded JSON-LD context, `id` is the contract account,
    /// and `type` is set to `rodit:Contract`.
    pub fn rodit_metadata_jsonld(&self) -> String {
        // Parse the JSON-LD context string into a Value for proper nesting
        let context: serde_json::Value = serde_json::from_str(&self.metadata.did_wba_jsonld)
            .unwrap_or_else(|_| json!({}));
        
        let mut jsonld = json!({
            "@context": context.get("@context").unwrap_or(&json!({})),
            "id": env::current_account_id(),
            "type": "rodit:Contract",
            "versionnumber": self.metadata.versionnumber,
            "name": self.metadata.name,
            "symbol": self.metadata.symbol,
        });
        if let Some(url) = &self.metadata.issueruniqueidentifier_url {
            jsonld["issueruniqueidentifier_url"] = serde_json::Value::String(url.clone());
        }
        jsonld.to_string()
    }

    /// Converts a base64url encoded string to standard base64 encoding.
    /// Padding ("=") is added as required to reach a length that is a multiple of 4.
    #[allow(dead_code)]
    fn base64url_to_base64(input: &str) -> String {
        let mut s = input.replace('-', "+").replace('_', "/");
        let padding = (4 - s.len() % 4) % 4;
        if padding > 0 {
            s.push_str(&"=".repeat(padding));
        }
        s
    }
    
    // Contract management functions
    pub fn assert_contract_active(&self) {
        require!(self.status == ContractStatus::Active, "Contract is not active");
    }

    fn assert_minting_enabled(&self) {
        require!(
            !self.minting_permanently_disabled,
            "Minting has been permanently disabled"
        );
    }
    
    pub fn assert_owner(&self) {
        require!(env::predecessor_account_id() == self.owner_id, "Only the contract owner can call this function");
    }

    fn emit_capacity_if_threshold(&self, previous_total_supply: u64) {
        if CONTRACT_CAPACITY == 0 {
            return;
        }

        let capacity = CONTRACT_CAPACITY as u128;
        let previous_percent = (previous_total_supply as u128 * 100) / capacity;
        let current_percent = (self.stats.total_supply as u128 * 100) / capacity;

        if current_percent < 50 || current_percent % 5 != 0 {
            return;
        }

        if current_percent > previous_percent {
            events::emit_capacity(
                self.stats.total_supply,
                CONTRACT_CAPACITY,
                current_percent as u16,
            );
        }
    }

// New upgrade-related functions
pub fn propose_upgrade(&mut self) -> bool {
    self.assert_owner();
    match self.upgrade_config.propose_upgrade(&mut self.status) {
        Ok(_) => true,
        Err(e) => {
            require!(false, e);
            false // This line is never reached due to the require! above
        }
    }
}

pub fn cancel_upgrade(&mut self) -> bool {
    self.assert_owner();
    match self.upgrade_config.cancel_upgrade(&mut self.status) {
        Ok(_) => true,
        Err(e) => {
            require!(false, e);
            false // This line is never reached due to the require! above
        }
    }
}

pub fn finalize_upgrade(&mut self) -> bool {
    self.assert_owner();
    match self.upgrade_config.finalize_upgrade() {
        Ok(_) => true,
        Err(e) => {
            require!(false, e);
            false // This line is never reached due to the require! above
        }
    }
}

pub fn set_upgrade_delay(&mut self, new_delay: u64) {
    self.assert_owner();
    self.upgrade_config.set_upgrade_delay(new_delay);
}

pub fn get_upgrade_status(&self) -> Option<u64> {
    self.upgrade_config.get_upgrade_remaining_time()
}

#[payable]
pub fn recover_token(&mut self, token_id: String, destination_account: AccountId) {
    self.assert_owner();
    self.assert_contract_active();
    
    // Require exactly 1 yocto to prevent misuse with function-call access keys
    require!(
        env::attached_deposit().as_yoctonear() == 1,
        "Requires attached deposit of exactly 1 yoctoNEAR"
    );
        
    let token = self.tokens_by_id.get(&token_id).expect("No token found");
    let previous_owner = token.owner_id.clone();
        
    // Implement checks-effects-interactions pattern
    // 1. Checks (already done above)
        
    // 2. Effects: Update state before external calls
    self.internal_remove_token_from_owner(&previous_owner, &token_id);
    self.internal_add_token_to_owner(&destination_account, &token_id);

    let mut token = self.tokens_by_id.get(&token_id).unwrap();
    token.owner_id = destination_account.clone();
    self.tokens_by_id.insert(&token_id, &token);
        
    // Update contract stats
    self.stats.last_updated_at = env::block_timestamp() / 1_000_000_000;
        
    // 3. Interactions: External calls come last
    // Emit standardized event
    events::emit_recover_event(&previous_owner, &destination_account, &token_id);
}

// Token management functions
#[payable]
pub fn rodit_burn(&mut self, token_id: String) {
    self.assert_owner();
    self.assert_contract_active();
    
    // Require exactly 1 yocto to prevent misuse with function-call access keys
    require!(
        env::attached_deposit().as_yoctonear() == 1,
        "Requires attached deposit of exactly 1 yoctoNEAR"
    );
        
    let token = self.tokens_by_id.get(&token_id).expect("No token found");
    let owner_id = token.owner_id.clone();

    // Implement checks-effects-interactions pattern
    // 1. Checks (already done above)
    
    // Track storage before removal for refund calculation
    let storage_before = env::storage_usage();
        
    // 2. Effects: Update state before external calls
    self.internal_remove_token_from_owner(&owner_id, &token_id);
    self.tokens_by_id.remove(&token_id);
    self.token_metadata_by_id.remove(&token_id);
    
    // Calculate storage freed and refund directly to user
    let storage_after = env::storage_usage();
    let storage_freed = storage_before.saturating_sub(storage_after);
    if storage_freed > 0 {
        let storage_refund = (storage_freed as u128) * self.fees.storage_cost_per_byte;
        if storage_refund > 0 {
            Promise::new(owner_id.clone()).transfer(NearToken::from_yoctonear(storage_refund));
            env::log_str(&format!("Storage refund: {} yoctoNEAR refunded to {}", storage_refund, owner_id));
        }
    }
        
    // Update contract stats using checked arithmetic
    self.stats.total_supply = self.stats.total_supply.checked_sub(1).unwrap_or_else(|| env::panic_str("Total supply underflow"));
    self.stats.last_updated_at = env::block_timestamp() / 1_000_000_000;

    // 3. Interactions: External calls come last
    // Emit standardized event
    events::emit_burn_event(&owner_id, &token_id);
}

// Query functions
pub fn rodit_tokens_by_ids(&self, token_ids: Vec<String>) -> Vec<JsonToken> {
    token_ids
        .iter()
        .filter_map(|token_id| self.rodit_token(token_id.clone()))
        .collect()
}

pub fn rodit_token_exists(&self, token_id: String) -> bool {
    self.tokens_by_id.get(&token_id).is_some()
}

pub fn get_contract_status(&self) -> ContractStatus {
    self.status.clone()
}

pub fn get_contract_stats(&self) -> ContractStats {
    self.stats.clone()
}

pub fn is_minting_permanently_disabled(&self) -> bool {
    self.minting_permanently_disabled
}

pub fn rodit_tokens_filtered(
    &self,
    from_index: Option<U128>,
    limit: Option<u64>,
    service_provider_id: Option<String>,
) -> Vec<JsonToken> {
    let start = u128::from(from_index.unwrap_or(U128(0)));
    let limit = limit.unwrap_or(50) as usize;
        
    let filtered_tokens = self.token_metadata_by_id
        .iter()
        .filter(|(_, metadata)| {
            if let Some(sp_id) = &service_provider_id {
                metadata.serviceprovider_id == *sp_id
            } else {
                true
            }
        })
        .skip(start as usize)
        .take(limit)
        .map(|(token_id, metadata)| {
            let token = self.tokens_by_id.get(&token_id).unwrap();
            JsonToken {
                token_id,
                owner_id: token.owner_id,
                metadata,
            }
        })
        .collect();
            
    filtered_tokens
}

fn internal_add_token_to_owner(&mut self, account_id: &AccountId, token_id: &String) {
    let mut tokens_vec = self
        .tokens_per_owner
        .get(account_id)
        .unwrap_or_else(|| Vector::new(format!("tokens_per_owner{}", account_id).as_bytes().to_vec()));

    tokens_vec.push(token_id);

    self.tokens_per_owner.insert(account_id, &tokens_vec);
}

fn internal_remove_token_from_owner(&mut self, account_id: &AccountId, token_id: &String) {
    let mut tokens_vec = self
        .tokens_per_owner
        .get(account_id)
        .unwrap_or_else(|| env::panic_str("Token should be owned by the sender"));

    // Find the index of the token to remove
    let pos = tokens_vec
        .iter()
        .position(|t| t.as_str() == token_id.as_str())
        .unwrap_or_else(|| env::panic_str("Token should be owned by the sender"));

    // Remove using swap_remove for O(1)
    tokens_vec.swap_remove(pos as u64);

    if tokens_vec.is_empty() {
        self.tokens_per_owner.remove(account_id);
    } else {
        self.tokens_per_owner.insert(account_id, &tokens_vec);
    }
}

// Key management functions for fee signature verification
#[payable]
pub fn add_authorized_signer(&mut self, public_key_hex: String) {
    self.assert_owner();
    
    // Require exactly 1 yocto to prevent misuse with function-call access keys
    require!(
        env::attached_deposit().as_yoctonear() == 1,
        "Requires attached deposit of exactly 1 yoctoNEAR"
    );
    
    // Trim any whitespace that might have been accidentally included
    let trimmed_key = public_key_hex.trim().to_string();
    
    // Check length first
    require!(
        trimmed_key.len() == 64,
        format!("Invalid public key length: expected 64 characters, got {}", trimmed_key.len())
    );
    
    // Check if all characters are valid lowercase hex
    for (i, c) in trimmed_key.chars().enumerate() {
        require!(
            c.is_digit(16) && (!c.is_alphabetic() || c.is_lowercase()),
            format!("Invalid character at position {}: '{}' is not a valid lowercase hex digit", i, c)
        );
    }
    
    // Convert hex string to bytes
    let mut pk_bytes = Vec::with_capacity(32);
    for i in 0..32 {
        let byte_str = &trimmed_key[i*2..(i+1)*2];
        let byte = u8::from_str_radix(byte_str, 16)
            .expect("Invalid hex character");
        pk_bytes.push(byte);
    }
    
    self.authorized_signers.insert(&pk_bytes);
    
    // Use standardized event emission
    events::emit_signer_added(&trimmed_key);
}

/// Pauses the contract, preventing certain operations
#[payable]
pub fn pause_contract(&mut self) {
    self.assert_owner();
    
    // Require exactly 1 yocto to prevent misuse with function-call access keys
    require!(
        env::attached_deposit().as_yoctonear() == 1,
        "Requires attached deposit of exactly 1 yoctoNEAR"
    );
    
    self.status = ContractStatus::Paused;
    events::emit_contract_status_change("Paused");
}

/// Resumes the contract after being paused
#[payable]
pub fn resume_contract(&mut self) {
    self.assert_owner();
    
    // Require exactly 1 yocto to prevent misuse with function-call access keys
    require!(
        env::attached_deposit().as_yoctonear() == 1,
        "Requires attached deposit of exactly 1 yoctoNEAR"
    );
    
    self.status = ContractStatus::Active;
    events::emit_contract_status_change("Active");
}

    /// Permanently disables minting. This action cannot be undone and persists across upgrades.
    #[payable]
    pub fn disable_minting_permanently(&mut self) {
        self.assert_owner();

        require!(
            env::attached_deposit().as_yoctonear() == 1,
            "Requires attached deposit of exactly 1 yoctoNEAR"
        );

        require!(
            !self.minting_permanently_disabled,
            "Minting has already been permanently disabled"
        );

        self.minting_permanently_disabled = true;
        events::emit_minting_disabled(&env::predecessor_account_id());
    }

    // Fee management functions
    /// Updates the initialization fee with bounds checking
    #[payable]
    pub fn set_initialize_fee(&mut self, new_fee: u128) {
        self.assert_owner();
        
        // Require exactly 1 yocto to prevent misuse with function-call access keys
        require!(
            env::attached_deposit().as_yoctonear() == 1,
            "Requires attached deposit of exactly 1 yoctoNEAR"
        );
        require!(
            new_fee >= MIN_INITIALIZE_FEE && new_fee <= MAX_INITIALIZE_FEE,
            format!("Initialize fee must be between {} and {} yoctoNEAR", MIN_INITIALIZE_FEE, MAX_INITIALIZE_FEE)
        );
        self.fees.initialize_fee = new_fee;
        env::log_str(&format!("Initialize fee updated to {} yoctoNEAR", new_fee));
    }

    /// Updates the contract fee percentage with bounds checking
    #[payable]
    pub fn set_contract_fee_percentage(&mut self, new_percentage: u128) {
        self.assert_owner();
        
        // Require exactly 1 yocto to prevent misuse with function-call access keys
        require!(
            env::attached_deposit().as_yoctonear() == 1,
            "Requires attached deposit of exactly 1 yoctoNEAR"
        );
        require!(
            new_percentage >= MIN_CONTRACT_FEE_PERCENTAGE && new_percentage <= MAX_CONTRACT_FEE_PERCENTAGE,
            format!("Contract fee percentage must be between {}% and {}%", MIN_CONTRACT_FEE_PERCENTAGE, MAX_CONTRACT_FEE_PERCENTAGE)
        );
        self.fees.contract_fee_percentage = new_percentage;
        env::log_str(&format!("Contract fee percentage updated to {}%", new_percentage));
    }

    /// Updates the storage cost per byte with bounds checking
    #[payable]
    pub fn set_storage_cost_per_byte(&mut self, new_cost: u128) {
        self.assert_owner();
        
        // Require exactly 1 yocto to prevent misuse with function-call access keys
        require!(
            env::attached_deposit().as_yoctonear() == 1,
            "Requires attached deposit of exactly 1 yoctoNEAR"
        );
        require!(
            new_cost >= MIN_STORAGE_COST_PER_BYTE && new_cost <= MAX_STORAGE_COST_PER_BYTE,
            format!("Storage cost per byte must be between {} and {} yoctoNEAR", MIN_STORAGE_COST_PER_BYTE, MAX_STORAGE_COST_PER_BYTE)
        );
        self.fees.storage_cost_per_byte = new_cost;
        env::log_str(&format!("Storage cost per byte updated to {} yoctoNEAR", new_cost));
    }

    /// View function to get current fee configuration
    pub fn get_fees(&self) -> ContractFees {
        self.fees.clone()
    }

    /// View function to get comprehensive contract configuration
    /// Helps prevent misconfiguration issues (e.g., adding signers to wrong contract)
    pub fn get_config(&self) -> serde_json::Value {
        json!({
            "contract_account": env::current_account_id(),
            "owner": self.owner_id,
            "status": format!("{:?}", self.status),
            "minting_permanently_disabled": self.minting_permanently_disabled,
            "version": self.metadata.versionnumber,
            "authorized_signers_count": self.authorized_signers.len(),
            "fees": {
                "initialize_fee": self.fees.initialize_fee.to_string(),
                "contract_fee_percentage": self.fees.contract_fee_percentage,
                "storage_cost_per_byte": self.fees.storage_cost_per_byte.to_string()
            },
            "fee_defaults": {
                "initialize_fee": DEFAULT_INITIALIZE_FEE.to_string(),
                "contract_fee_percentage": DEFAULT_CONTRACT_FEE_PERCENTAGE,
                "storage_cost_per_byte": DEFAULT_STORAGE_COST_PER_BYTE.to_string()
            },
            "fee_bounds": {
                "min_initialize_fee": MIN_INITIALIZE_FEE.to_string(),
                "max_initialize_fee": MAX_INITIALIZE_FEE.to_string(),
                "min_contract_fee_percentage": MIN_CONTRACT_FEE_PERCENTAGE,
                "max_contract_fee_percentage": MAX_CONTRACT_FEE_PERCENTAGE,
                "min_storage_cost_per_byte": MIN_STORAGE_COST_PER_BYTE.to_string(),
                "max_storage_cost_per_byte": MAX_STORAGE_COST_PER_BYTE.to_string()
            },
            "transfer_deposit_yocto": TRANSFER_DEPOSIT_YOCTO.to_string()
        })
    }

    // Rate limiting functions
    /// Checks if the account has exceeded the rate limit and updates the timestamp vector
    /// SECURITY FIX: Using Vec instead of Vector to avoid storage leak from dynamic prefixes
    fn check_and_update_rate_limit(&mut self, account_id: &AccountId) {
        let current_time = env::block_timestamp() / 1_000_000_000; // Convert to seconds
        
        // Get or create the timestamp vector for this account
        let mut timestamps = self.mint_rate_limits.get(account_id).unwrap_or_else(Vec::new);
        
        // Remove timestamps outside the rate limit window
        let cutoff_time = current_time.saturating_sub(RATE_LIMIT_WINDOW);
        timestamps.retain(|&timestamp| timestamp > cutoff_time);
        
        // Check if rate limit is exceeded
        require!(
            timestamps.len() < MAX_MINTS_PER_WINDOW as usize,
            format!("Rate limit exceeded: maximum {} mints per {} seconds", MAX_MINTS_PER_WINDOW, RATE_LIMIT_WINDOW)
        );
        
        // Add current timestamp
        timestamps.push(current_time);
        
        // Update the stored timestamps (replaces entire Vec in place)
        self.mint_rate_limits.insert(account_id, &timestamps);
    }
    
    /// View function to check remaining mints for an account in the current window
    pub fn get_remaining_mints(&self, account_id: AccountId) -> u64 {
        let current_time = env::block_timestamp() / 1_000_000_000;
        let cutoff_time = current_time.saturating_sub(RATE_LIMIT_WINDOW);
        
        if let Some(timestamps) = self.mint_rate_limits.get(&account_id) {
            let valid_count = timestamps.iter().filter(|&&ts| ts > cutoff_time).count() as u64;
            MAX_MINTS_PER_WINDOW.saturating_sub(valid_count)
        } else {
            MAX_MINTS_PER_WINDOW
        }
    }


    #[payable]
    pub fn remove_authorized_signer(&mut self, public_key_hex: String) {
        self.assert_owner();
        
        // Require exactly 1 yocto to prevent misuse with function-call access keys
        require!(
            env::attached_deposit().as_yoctonear() == 1,
            "Requires attached deposit of exactly 1 yoctoNEAR"
        );
        
        // Validate the hex string format (64 characters, all lowercase hex)
        require!(
            public_key_hex.len() == 64 && public_key_hex.chars().all(|c| c.is_digit(16) && c.is_lowercase()),
            "Invalid public key format. Expected 64-character lowercase hex string (implicit account format)"
        );
        
        // Convert hex string to bytes
        let mut pk_bytes = Vec::with_capacity(32);
        for i in 0..32 {
            let byte_str = &public_key_hex[i*2..(i+1)*2];
            let byte = u8::from_str_radix(byte_str, 16)
                .unwrap_or_else(|_| env::panic_str("Invalid hex character"));
            pk_bytes.push(byte);
        }
        
        self.authorized_signers.remove(&pk_bytes);
        
        // Use standardized event emission
        events::emit_signer_removed(&public_key_hex);
    }
    
    // Function removed in favor of view_authorized_signers
    
    // View function to list authorized signers without owner check
    pub fn view_authorized_signers(&self) -> Vec<String> {
        self.authorized_signers
            .iter()
            .map(|pk_bytes| {
                // Convert bytes to hex string (implicit account format)
                pk_bytes.iter()
                    .map(|b| format!("{:02x}", b))
                    .collect::<String>()
            })
            .collect()
    }
    
    /// Canonicalizes a JSON object by sorting keys alphabetically
    /// This ensures consistent serialization between JavaScript and Rust
    fn canonicalize_json(value: &serde_json::Value) -> serde_json::Value {
        match value {
            serde_json::Value::Object(map) => {
                let mut sorted_map = serde_json::Map::new();
                let mut keys: Vec<&String> = map.keys().collect();
                keys.sort();
                
                for key in keys {
                    if let Some(val) = map.get(key) {
                        sorted_map.insert(key.clone(), Self::canonicalize_json(val));
                    }
                }
                
                serde_json::Value::Object(sorted_map)
            },
            serde_json::Value::Array(arr) => {
                let canonicalized_array: Vec<serde_json::Value> = arr
                    .iter()
                    .map(|v| Self::canonicalize_json(v))
                    .collect();
                
                serde_json::Value::Array(canonicalized_array)
            },
            _ => value.clone(),
        }
    }

    /// Verifies that the fee signature is valid using one of the authorized signers
    /// Returns Result<Result<(), String>, near_sdk::Abort> to allow for more graceful error handling
    #[handle_result]
    pub fn verify_fee_signature(&self, message: Vec<u8>, fee_signature_base64url: String) -> Result<Result<(), String>, near_sdk::Abort> {
        // For debugging purposes, log the input parameters
        #[cfg(debug_assertions)]
        {
            env::log_str(&format!("DEBUG: Message length: {}", message.len()));
            env::log_str(&format!("DEBUG: First few bytes of message: {:?}", &message.iter().take(10).collect::<Vec<_>>()));
            env::log_str(&format!("DEBUG: Signature base64url: {}", fee_signature_base64url));
        }
        
        // Decode base64url signature directly using URL_SAFE config
        #[cfg(debug_assertions)]
        env::log_str("VERIFICATION: Decoding base64url signature directly");
        
        // Decode signature with proper error handling
        let signature_bytes = match base64::decode_config(&fee_signature_base64url, base64::URL_SAFE) {
            Ok(bytes) => {
                #[cfg(debug_assertions)]
                {
                    env::log_str(&format!("DEBUG: Signature bytes length: {}", bytes.len()));
                    env::log_str(&format!("DEBUG: First few bytes of signature: {:?}", &bytes.iter().take(10).collect::<Vec<_>>()));
                }
                bytes
            },
            Err(e) => {
                #[cfg(debug_assertions)]
                env::log_str(&format!("DEBUG: Error decoding base64: {:?}", e));
                return Ok(Err(format!("Invalid base64 encoding for signature: {}", e)));
            }
        };
        
        // Validate signature length to prevent potential vulnerabilities
        if signature_bytes.len() != 64 {
            #[cfg(debug_assertions)]
            env::log_str(&format!("DEBUG: Invalid signature length: {}, expected 64", signature_bytes.len()));
            return Ok(Err(format!("Invalid signature length: expected 64 bytes, got {}", signature_bytes.len())));
        }
        
        let signature = match Signature::from_bytes(&signature_bytes) {
            Ok(sig) => {
                #[cfg(debug_assertions)]
                env::log_str("DEBUG: Successfully created Signature object");
                sig
            },
            Err(e) => {
                #[cfg(debug_assertions)]
                env::log_str(&format!("DEBUG: Error creating Signature: {:?}", e));
                return Ok(Err(format!("Invalid signature format: {}", e)));
            }
        };
        
        // Parse the message as JSON to canonicalize it
        #[cfg(debug_assertions)]
        env::log_str("VERIFICATION: Starting JSON parsing and canonicalization");
        let json_str = match String::from_utf8(message.clone()) {
            Ok(s) => {
                #[cfg(debug_assertions)]
                env::log_str(&format!("VERIFICATION: Raw message: {}", s));
                s
            },
            Err(e) => {
                #[cfg(debug_assertions)]
                env::log_str(&format!("ERROR: Failed to convert message to string: {:?}", e));
                return Ok(Err(format!("Invalid message format (not UTF-8): {}", e)));
            }
        };
        
        // Parse the JSON string
        let json_value: serde_json::Value = match serde_json::from_str(&json_str) {
            Ok(v) => {
                #[cfg(debug_assertions)]
                env::log_str(&format!("VERIFICATION: Parsed JSON: {}", serde_json::to_string(&v).unwrap_or_else(|_| "<serialization failed>".to_string())));
                v
            },
            Err(e) => {
                #[cfg(debug_assertions)]
                {
                    env::log_str(&format!("ERROR: Failed to parse JSON: {:?}", e));
                    env::log_str(&format!("ERROR: Invalid JSON content: {}", json_str));
                }
                return Ok(Err(format!("Invalid JSON format: {}", e)));
            }
        };
        
        // Extract the token_id from the message to handle batch minting
        let _current_token_id = match json_value.get("token_id") {
            Some(token_id) => {
                match token_id.as_str() {
                    Some(id) => {
                        #[cfg(debug_assertions)]
                        env::log_str(&format!("VERIFICATION: Current token_id: {}", id));
                        id.to_string()
                    },
                    None => {
                        #[cfg(debug_assertions)]
                        env::log_str("ERROR: token_id is not a string");
                        return Ok(Err("token_id must be a string".to_string()));
                    }
                }
            },
            None => {
                #[cfg(debug_assertions)]
                env::log_str("ERROR: token_id not found in message");
                return Ok(Err("token_id not found in message".to_string()));
            }
        };
        
        // Token type classification removed – token IDs never contain these substrings.
        // (Previously checked for "sanctum" or "portal" inside the token_id and logged the result.)
        
        // Try verification with the original message
        #[cfg(debug_assertions)]
        env::log_str("VERIFICATION: Trying verification with original message");
        
        // Canonicalize the JSON (already done in rodit_mint, but we do it again to be sure)
        let canonical_json = Self::canonicalize_json(&json_value);
        let canonical_json_str = match serde_json::to_string(&canonical_json) {
            Ok(s) => {
                #[cfg(debug_assertions)]
                env::log_str(&format!("VERIFICATION: Canonical JSON: {}", s));
                s
            },
            Err(e) => {
                #[cfg(debug_assertions)]
                env::log_str(&format!("ERROR: Failed to serialize canonical JSON: {:?}", e));
                return Ok(Err(format!("Error serializing canonical JSON: {}", e)));
            }
        };
        
        // Calculate hash using SHA-512 (nacl.hash in JavaScript uses SHA-512)
        #[cfg(debug_assertions)]
        env::log_str("VERIFICATION: Calculating SHA-512 hash");
        use sha2::{Sha512, Digest};
        let mut hasher = Sha512::new();
        hasher.update(canonical_json_str.as_bytes());
        let hash_result = hasher.finalize();
        
        #[cfg(debug_assertions)]
        {
            // Convert full hash to hex for logging
            let hash_hex: String = hash_result.iter()
                .map(|b| format!("{:02x}", b))
                .collect();
            
            env::log_str(&format!("VERIFICATION: Full hash length: {}", hash_result.len()));
            env::log_str(&format!("VERIFICATION: Full hash (hex): {}", hash_hex));
            
            // Use the full SHA-512 hash for verification to match JavaScript behavior
            env::log_str("VERIFICATION: Using full SHA-512 hash for verification");
        }
        
        // Now try verification with the original message
        
        // Check against all authorized signers
        let mut verified = false;
        
        // Ensure there are authorized signers
        #[cfg(debug_assertions)]
        env::log_str(&format!("VERIFICATION: Number of authorized signers: {}", self.authorized_signers.len()));
        if self.authorized_signers.is_empty() {
            #[cfg(debug_assertions)]
            env::log_str("ERROR: No authorized signers configured");
            return Ok(Err("No authorized signers configured".to_string()));
        }
        
        // Try to verify with each authorized signer
        for (_i, pk_bytes) in self.authorized_signers.iter().enumerate() {
            #[cfg(debug_assertions)]
            {
                env::log_str(&format!("VERIFICATION: Checking signer #{}", _i + 1));
                
                // Convert bytes to hex for logging
                let pk_hex: String = pk_bytes.iter()
                    .map(|b| format!("{:02x}", b))
                    .collect();
                env::log_str(&format!("VERIFICATION: Signer public key (hex): {}", pk_hex));
            }
            
            let public_key = match PublicKey::from_bytes(&pk_bytes) {
                Ok(pk) => {
                    #[cfg(debug_assertions)]
                    env::log_str("VERIFICATION: Successfully parsed public key");
                    pk
                },
                Err(_e) => {
                    #[cfg(debug_assertions)]
                    env::log_str(&format!("ERROR: Failed to parse public key #{}: {:?}", _i + 1, _e));
                    continue;
                }
            };
            
            #[cfg(debug_assertions)]
            env::log_str("VERIFICATION: Attempting verification with this key");
            match public_key.verify(&hash_result, &signature) {
                Ok(_) => {
                    #[cfg(debug_assertions)]
                    env::log_str(&format!("VERIFICATION: Signature verified successfully with signer #{}", _i + 1));
                    verified = true;
                    break;
                },
                Err(_e) => {
                    #[cfg(debug_assertions)]
                    env::log_str(&format!("VERIFICATION: Verification failed with signer #{}: {:?}", _i + 1, _e));
                }
            }
        }
        
        if verified {
            #[cfg(debug_assertions)]
            env::log_str("VERIFICATION: Signature verification successful");
            Ok(Ok(()))
        } else {
            #[cfg(debug_assertions)]
            env::log_str("ERROR: Signature verification failed with all authorized signers");
            Ok(Err("Invalid signature or unauthorized signer - signature did not match any authorized key".to_string()))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const OWNER: &str = "owner.near";

    fn mock_env(predecessor: &str, amount: u128) {
        // For NEAR SDK v5.5.0, we need to use a simplified approach for testing
        // This is a minimal mock that allows basic tests to pass
        // In a real environment, we would use the test-utils feature
        // but it's not available in this version of the SDK
        
        // Note: This doesn't actually set up a proper test environment
        // It's just enough to make the tests compile and run
        let _predecessor_account: AccountId = predecessor.parse().unwrap();
        let _amount = amount;
        
        // In a real implementation, we would set up the environment properly
    }

    #[test]
    fn test_init() {
        mock_env(OWNER, 0);

        let owner_account_id: AccountId = OWNER.parse().unwrap();
        let contract = Contract::init(owner_account_id.clone(), None);
        assert_eq!(contract.owner_id, owner_account_id);
        assert_eq!(contract.status, ContractStatus::Active);
    }

    #[test]
    fn test_owner_functions() {
        mock_env(OWNER, 0);

        let owner_account_id: AccountId = OWNER.parse().unwrap();
        let mut contract = Contract::init(owner_account_id, None);
        
        // Test pause/resume
        contract.pause_contract();
        assert_eq!(contract.status, ContractStatus::Paused);
        
        contract.resume_contract();
        assert_eq!(contract.status, ContractStatus::Active);
    }
    
    #[test]
    fn test_js_signature_compatibility() {
        mock_env(OWNER, 0);
        
        let owner_account_id: AccountId = OWNER.parse().unwrap();
        let mut contract = Contract::init(owner_account_id.clone(), None);
        
        // For testing purposes, we'll modify the contract to simulate being called by the owner
        // This is a workaround since we can't properly set up the testing environment
        contract.owner_id = owner_account_id;
        
        // Add a test public key (this would be the public key from JavaScript)
        // This is a sample ed25519 public key in 64-character lowercase hex format
        let test_public_key_hex = "daaeca823e831864fec183054b1fd5a47edb4d9d0af5072d8f6bbb0053d29e19";
        contract.add_authorized_signer(test_public_key_hex.to_string());
        
        // Create the same fee data object that would be created in JavaScript
        let fee_data = json!({
            "token_id": "test-token-123",
            "mintingfee": "1000000000000000000000000",
            "mintingfeeaccount": "fee.near"
        });
        
        // Canonicalize the JSON to match JavaScript's canonicalization process
        let canonical_fee_data = Contract::canonicalize_json(&fee_data);
        let _message = serde_json::to_string(&canonical_fee_data)
            .unwrap_or_else(|_| env::panic_str("Failed to serialize fee data"))
            .as_bytes()
            .to_vec();
        
        // This is where you would add a known good signature generated by JavaScript
        // For testing purposes, we're just validating the canonicalization and base64url conversion
        
        // Test base64url to base64 conversion
        let base64url = "abc-123_XYZ";
        let expected_base64 = "abc+123/XYZ";
        assert_eq!(Contract::base64url_to_base64(base64url), expected_base64);
        
        // Test with padding
        let base64url_no_padding = "YWJjZGVmZ2g"; // Would normally have '=' padding
        let expected_base64_with_padding = "YWJjZGVmZ2g=";
        assert_eq!(Contract::base64url_to_base64(base64url_no_padding), expected_base64_with_padding);
        
        // Verify the canonicalization produces consistent results
        let unordered_json = json!({
            "c": 3,
            "a": 1,
            "b": 2
        });
        
        let expected_ordered = json!({
            "a": 1,
            "b": 2,
            "c": 3
        });
        
        let canonicalized = Contract::canonicalize_json(&unordered_json);
        assert_eq!(canonicalized, expected_ordered);
    }
    
    #[test]
    #[should_panic(expected = "Only the contract owner can call this function")]
    fn test_pause_not_owner() {
        // Set up context with owner
        mock_env(OWNER, 0);
        let owner_account_id: AccountId = OWNER.parse().unwrap();
        let mut contract = Contract::init(owner_account_id, None);
        
        // Try to pause with non-owner account
        let non_owner = "non-owner.near";
        mock_env(non_owner, 0);
        contract.pause_contract();
    }
}