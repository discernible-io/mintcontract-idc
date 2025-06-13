use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedMap, UnorderedSet};
use near_sdk::json_types::U128;
use near_sdk::NearToken;
use serde_json::json;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near_bindgen, AccountId, PanicOnDefault, Promise, require};

pub const RODIT_METADATA_SPEC: &str = "RODIT-near.org-1.09.75";
pub const RODIT_STANDARD_NAME: &str = "PENDING nepXXX";
pub const INITIALIZE_FEE: NearToken = NearToken::from_yoctonear(100_000_000_000_000_000_000); // 0.0001 NEAR
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

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct JsonToken {
    pub token_id: String,
    pub owner_id: AccountId,
    pub metadata: TokenMetadata,
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
    pub fn init(owner_id: AccountId, metadata: Option<RoditContractMetadata>) -> Self {
        require!(!env::state_exists(), "Contract is already initialized");
        
        let metadata = metadata.unwrap_or_else(|| RoditContractMetadata {
            versionnumber: RODIT_METADATA_SPEC.to_string(),
            name: "Cableguard API forge".to_string(),
            symbol: "RODIT".to_string(),
            issueruniqueidentifierURL: Some("10975-cableguard.org".to_string()),
        });

        Self {
            owner_id,
            tokensPerOwner: LookupMap::new(b"tokensPerOwner".to_vec()),
            tokensById: LookupMap::new(b"tokensById".to_vec()),
            tokenMetadataById: UnorderedMap::new(b"tokenMetadataById".to_vec()),
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
        fee_signature: String,
    ) {
        let fee_data = json!({
            "token_id": token_id,
            "mintingfee": env::attached_deposit(),
            "mintingfeeaccount": mintingfee_account.to_string()
        });
        
        let initial_storage_usage = env::storage_usage();
        
        require!(
            self.tokensById.get(&token_id).is_none(),
            "Token already exists"
        );

        let token = Token {
            owner_id: owneraccount_id.clone(),
        };

        self.tokensById.insert(&token_id, &token);
        self.tokenMetadataById.insert(&token_id, &metadata);
        self.internal_add_token_to_owner(&owneraccount_id, &token_id);

        // Calculate storage used
        let storage_used = env::storage_usage() - initial_storage_usage;
        
        // Handle fees and storage based on actual usage
        self.handle_account_fees_and_storage(
            storage_used,
            &owneraccount_id,
            &mintingfee_account
        );
    }

    fn handle_account_fees_and_storage(
        &self,
        storage_used: u64,
        implicit_account_id: &AccountId,
        minting_fee_account: &AccountId,
    ) {
        // Calculate required storage cost based on actual usage
        let required_cost = NearToken::from_yoctonear(
            (storage_used as u128) * env::storage_byte_cost().as_yoctonear()
        );
        
        let attached_deposit = env::attached_deposit();
        
        require!(
            required_cost <= attached_deposit,
            format!("Must attach at least {} yoctoNEAR to cover storage and fee", required_cost.as_yoctonear())
        );

        // Initialize recipient account
        Promise::new(implicit_account_id.clone())
            .transfer(INITIALIZE_FEE);

        // Calculate contract fee (1% of remaining after storage and init fee)
        let contract_fee = NearToken::from_yoctonear(
            attached_deposit.as_yoctonear()
                .checked_sub(required_cost.as_yoctonear())
                .and_then(|amt| amt.checked_sub(INITIALIZE_FEE.as_yoctonear()))
                .and_then(|amt| amt.checked_div(100))
                .expect("Fee calculation overflow")
        );

        // Calculate remaining balance for provider
        let remaining_balance = NearToken::from_yoctonear(
            attached_deposit.as_yoctonear()
                .saturating_sub(required_cost.as_yoctonear())
                .saturating_sub(contract_fee.as_yoctonear())
                .saturating_sub(INITIALIZE_FEE.as_yoctonear())
        );

        // Log all operations
        env::log_str(&format!(
            "Initializing {} with {} yoctoNEAR",
            implicit_account_id,
            INITIALIZE_FEE.as_yoctonear()
        ));
        env::log_str(&format!(
            "Contract collecting fee {} yoctoNEAR",
            contract_fee.as_yoctonear()
        ));
        env::log_str(&format!(
            "Sending provider {} API fee of {} yoctoNEAR",
            minting_fee_account,
            remaining_balance.as_yoctonear()
        ));

        // Transfer contract fee
        Promise::new(env::current_account_id())
            .transfer(contract_fee);

        // Transfer remaining balance to provider if any
        if remaining_balance.as_yoctonear() > 0 {
            Promise::new(minting_fee_account.clone())
                .transfer(remaining_balance);
        }
    }

    #[payable]
    pub fn rodit_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: String,
        memo: Option<String>,
    ) {
        let sender_id = env::predecessor_account_id();
        let token = self.tokensById.get(&token_id).expect("No token found");
        
        assert_eq!(
            token.owner_id, sender_id,
            "Sender must be the token owner"
        );
        
        assert_ne!(
            token.owner_id, receiver_id,
            "The token owner and receiver should be different"
        );

        self.internal_transfer(
            &sender_id,
            &receiver_id,
            &token_id,
            memo.as_deref(),
        );
    }

    pub fn rodit_token(&self, token_id: String) -> Option<JsonToken> {
        if let Some(token) = self.tokensById.get(&token_id) {
            let metadata = self.tokenMetadataById.get(&token_id).unwrap();
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
        U128(self.tokenMetadataById.len() as u128)
    }

    pub fn rodit_tokens(
        &self,
        from_index: Option<U128>,
        limit: Option<u64>,
    ) -> Vec<JsonToken> {
        let start = u128::from(from_index.unwrap_or(U128(0)));
        let limit = limit.unwrap_or(50) as usize;

        // Iterate through all tokens regardless of owner
        self.tokenMetadataById
            .iter()
            .skip(start as usize)
            .take(limit)
            .map(|(token_id, metadata)| {
                let token = self.tokensById.get(&token_id).unwrap();
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
        let tokens_set = self.tokensPerOwner.get(&account_id);
        let tokens = if let Some(tokens_set) = tokens_set {
            tokens_set.iter()
                .skip(u128::from(from_index.unwrap_or(U128(0))) as usize)
                .take(limit.unwrap_or(50) as usize)
                .map(|token_id| {
                    let metadata = self.tokenMetadataById.get(&token_id).unwrap();
                    let token = self.tokensById.get(&token_id).unwrap();
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
        if let Some(tokens) = self.tokensPerOwner.get(&account_id) {
            U128(tokens.len() as u128)
        } else {
            U128(0)
        }
    }

    pub fn rodit_metadata(&self) -> &RoditContractMetadata {
        &self.metadata
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

        if let Some(memo) = memo {
            env::log_str(&format!("Memo: {}", memo));
        }

        env::log_str(
            &serde_json::to_string(&json!({
                "standard": RODIT_STANDARD_NAME,
                "version": RODIT_METADATA_SPEC,
                "event": "rodit_transfer",
                "data": [{
                    "old_owner_id": sender_id,
                    "new_owner_id": receiver_id,
                    "token_ids": [token_id],
                    "memo": memo,
                }]
            }))
            .unwrap(),
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::{testing_env, VMContext};

    fn get_context(predecessor_account_id: AccountId) -> VMContext {
        VMContextBuilder::new()
            .predecessor_account_id(predecessor_account_id)
            .attached_deposit(STORAGE_COST.as_yoctonear())
            .build()
    }

    #[test]
    fn test_new() {
        let context = get_context(accounts(1));
        testing_env!(context);
        let contract = Contract::init(accounts(1), None);
        assert_eq!(contract.rodit_total_supply(), U128(0));
    }
}