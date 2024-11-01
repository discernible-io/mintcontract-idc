use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedMap, UnorderedSet};
use near_sdk::json_types::U128;
use near_sdk::NearToken;
use serde_json::json;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near_bindgen, AccountId, PanicOnDefault, Promise, require};

pub const RODIT_METADATA_SPEC: &str = "RODIT-near.org-1.09.63";
pub const RODIT_STANDARD_NAME: &str = "PENDING nepXXX";
pub const STORAGE_COST: NearToken = NearToken::from_near(0.001); // 0.001 NEAR
pub const INITIALIZE_FEE: NearToken = NearToken::from_near(0.1); // 0.1 NEAR
pub const CONTRACT_FEE_PERCENTAGE: u128 = 1; // 1%

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct RoditContractMetadata {
    pub versionnumber: String,
    pub name: String,
    pub symbol: String,
    pub issueruniqueidentifierURL: Option<String>,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct TokenMetadata {
    pub not_after: Option<String>,
    pub not_before: Option<String>,
    pub max_requests: Option<String>,
    pub maxrq_window: Option<String>,
    pub webhook_url: Option<String>,
    pub webhook_cidr: Option<String>,
    pub userselected_dn: Option<String>,
    pub allowed_cidr: Option<String>,
    pub allowed_iso3166list: Option<String>,
    pub jwt_duration: Option<String>,
    pub permissioned_routes: String,
    pub subjectuniqueidentifier_url: Option<String>,
    pub serviceprovider_id: Option<String>,
    pub serviceprovider_signature: Option<String>,
}

#[derive(BorshDeserialize, BorshSerialize)]
pub struct Token {
    pub owner_id: AccountId,
    pub timestamp: u64,
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct JsonToken {
    pub token_id: String,
    pub owner_id: AccountId,
    pub metadata: TokenMetadata,
    pub timestamp: u64,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Contract {
    pub owner_id: AccountId,
    pub tokensPerOwner: LookupMap<AccountId, UnorderedSet<String>>,
    pub tokensById: LookupMap<String, Token>,
    pub tokenMetadataById: UnorderedMap<String, TokenMetadata>,
    pub metadata: RoditContractMetadata,
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new(owner_id: AccountId, metadata: Option<RoditContractMetadata>) -> Self {
        require!(!env::state_exists(), "Contract is already initialized");
        
        let metadata = metadata.unwrap_or_else(|| RoditContractMetadata {
            versionnumber: RODIT_METADATA_SPEC.to_string(),
            name: "Cableguard API forge".to_string(),
            symbol: "RODIT".to_string(),
            issueruniqueidentifierURL: Some("10963-cableguard.org".to_string()),
        });

        Self {
            owner_id,
            tokensPerOwner: LookupMap::new(b"tokensPerOwner"),
            tokensById: LookupMap::new(b"tokensById"),
            tokenMetadataById: UnorderedMap::new(b"tokenMetadataById"),
            metadata,
        }
    }

    #[payable]
    pub fn rodit_mint(
        &mut self,
        token_id: String,
        metadata: TokenMetadata,
        owneraccount_id: AccountId,
        mintingfee_account: AccountId,
    ) {
        let initial_storage_usage = env::storage_usage();
        
        require!(
            self.tokensById.get(&token_id).is_none(),
            "Token already exists"
        );

        let token = Token {
            owner_id: owneraccount_id.clone(),
            timestamp: env::block_timestamp(),
        };

        self.tokensById.insert(&token_id, &token);
        self.tokenMetadataById.insert(&token_id, &metadata);
        self.internal_add_token_to_owner(&owneraccount_id, &token_id);

        let required_storage_in_bytes = env::storage_usage() - initial_storage_usage;
        let required_cost = NearToken::from_yoctonear(
            required_storage_in_bytes as u128 * STORAGE_COST.as_yoctonear()
        );

        let attached_deposit = env::attached_deposit();
        
        require!(
            required_cost <= attached_deposit,
            format!("Must attach at least {} yoctoNEAR to cover storage", required_cost.as_yoctonear())
        );

        self.handle_fees(required_cost, attached_deposit, owneraccount_id, mintingfee_account);
        self.log_mint_event(&token_id, &token.owner_id);
    }

    #[payable]
    pub fn rodit_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: String,
        memo: Option<String>,
    ) {
        require!(
            env::attached_deposit() >= 1,
            "Requires attached deposit of at least 1 yoctoNEAR"
        );
        
        let sender_id = env::predecessor_account_id();
        let token = self.tokensById.get(&token_id).expect("No token found");
        
        require!(
            token.owner_id == sender_id,
            "Sender must be the token owner"
        );
        
        require!(
            token.owner_id != receiver_id,
            "The token owner and receiver should be different"
        );

        self.internal_transfer(
            &sender_id,
            &receiver_id,
            &token_id,
            memo.as_deref(),
        );
    }

    pub fn rodit_tokens(&self, token_id: String) -> Option<JsonToken> {
        self.tokensById.get(&token_id).map(|token| {
            let metadata = self.tokenMetadataById.get(&token_id).unwrap();
            JsonToken {
                token_id,
                owner_id: token.owner_id,
                metadata,
                timestamp: token.timestamp,
            }
        })
    }

    pub fn get_contract_fee_percentage(&self) -> u128 {
        CONTRACT_FEE_PERCENTAGE
    }

    pub fn get_initialize_fee(&self) -> NearToken {
        INITIALIZE_FEE
    }

    fn log_mint_event(&self, token_id: &str, owner_id: &AccountId) {
        env::log_str(
            &json!({
                "standard": RODIT_STANDARD_NAME,
                "version": RODIT_METADATA_SPEC,
                "event": "rodit_mint",
                "data": [{
                    "owner_id": owner_id,
                    "token_ids": [token_id],
                    "timestamp": env::block_timestamp(),
                }]
            })
            .to_string(),
        );
    }

    fn handle_fees(
        &self,
        storage_cost: NearToken,
        attached_deposit: NearToken,
        receiver_id: AccountId,
        minting_fee_account: AccountId,
    ) {
        let contract_fee = NearToken::from_yoctonear(
            (attached_deposit.as_yoctonear()
                .saturating_sub(storage_cost.as_yoctonear())
                .saturating_sub(INITIALIZE_FEE.as_yoctonear())) / 100
        );

        let remaining_balance = NearToken::from_yoctonear(
            attached_deposit.as_yoctonear()
                .saturating_sub(storage_cost.as_yoctonear())
                .saturating_sub(contract_fee.as_yoctonear())
                .saturating_sub(INITIALIZE_FEE.as_yoctonear())
        );

        Promise::new(receiver_id).transfer(INITIALIZE_FEE);
        Promise::new(env::current_account_id()).transfer(contract_fee);

        if remaining_balance.as_yoctonear() > 0 {
            Promise::new(minting_fee_account).transfer(remaining_balance);
        }
    }

    fn internal_transfer(
        &mut self,
        sender_id: &AccountId,
        receiver_id: &AccountId,
        token_id: &String,
        memo: Option<&str>,
    ) {
        self.internal_remove_token_from_owner(sender_id, token_id);
        self.internal_add_token_to_owner(receiver_id, token_id);

        let mut token = self.tokensById.get(token_id).unwrap();
        token.owner_id = receiver_id.clone();
        self.tokensById.insert(token_id, &token);

        env::log_str(
            &json!({
                "standard": RODIT_STANDARD_NAME,
                "version": RODIT_METADATA_SPEC,
                "event": "rodit_transfer",
                "data": [{
                    "old_owner_id": sender_id,
                    "new_owner_id": receiver_id,
                    "token_ids": [token_id],
                    "memo": memo,
                    "timestamp": env::block_timestamp(),
                }]
            })
            .to_string(),
        );
    }

    fn internal_add_token_to_owner(&mut self, account_id: &AccountId, token_id: &String) {
        let mut tokens_set = self.tokensPerOwner.get(account_id).unwrap_or_else(|| {
            UnorderedSet::new(
                format!("tokensPerOwner{}", account_id)
                    .as_bytes()
                    .to_vec(),
            )
        });
        tokens_set.insert(token_id);
        self.tokensPerOwner.insert(account_id, &tokens_set);
    }

    fn internal_remove_token_from_owner(&mut self, account_id: &AccountId, token_id: &String) {
        let mut tokens_set = self
            .tokensPerOwner
            .get(account_id)
            .expect("Token should be owned by the sender");
        tokens_set.remove(token_id);
        
        if tokens_set.is_empty() {
            self.tokensPerOwner.remove(account_id);
        } else {
            self.tokensPerOwner.insert(account_id, &tokens_set);
        }
    }
}