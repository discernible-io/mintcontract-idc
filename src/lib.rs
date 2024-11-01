use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedMap, UnorderedSet};
use near_sdk::json_types::U128;
use near_sdk::NearToken;
use serde_json::json;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near_bindgen, AccountId, PanicOnDefault, Promise};

pub const RODIT_METADATA_SPEC: &str = "RODIT-near.org-1.09.63";
pub const RODIT_STANDARD_NAME: &str = "PENDING nepXXX";
pub const STORAGE_COST: NearToken = NearToken::from_yoctonear(1_000_000_000_000_000_000_000); // 0.001 NEAR

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct RoditContractMetadata {
    pub versionnumber: String,
    pub name: String,
    pub symbol: String,
    pub issueruniqueidentifierURL: Option<String>,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct TokenMetadata {
    pub openapijson_url: Option<String>,
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
    pub permissioned_routes: Option<String>,
    pub subjectuniqueidentifier_url: Option<String>,
    pub serviceprovider_id: Option<String>,
    pub serviceprovider_signature: Option<String>,
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
        let metadata = metadata.unwrap_or_else(|| RoditContractMetadata {
            versionnumber: RODIT_METADATA_SPEC.to_string(),
            name: "Cableguard API forge".to_string(),
            symbol: "RODIT".to_string(),
            issueruniqueidentifierURL: Some("10963-cableguard.org".to_string()),
        });

        Self {
            owner_id,
            tokensPerOwner: LookupMap::new(b"tokensPerOwner".to_vec()),
            tokensById: LookupMap::new(b"tokensById".to_vec()),
            tokenMetadataById: UnorderedMap::new(b"tokenMetadataById".to_vec()),
            metadata,
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
        
        assert!(
            self.tokensById.get(&token_id).is_none(),
            "Token already exists"
        );

        let token = Token {
            owner_id: owneraccount_id.clone(),
        };

        self.tokensById.insert(&token_id, &token);
        self.tokenMetadataById.insert(&token_id, &metadata);

        self.internal_add_token_to_owner(&owneraccount_id, &token_id);

        let required_storage_in_bytes = env::storage_usage() - initial_storage_usage;
        let required_cost = NearToken::from_yoctonear(
            required_storage_in_bytes as u128 * STORAGE_COST.as_yoctonear()
        );

        let attached_deposit = env::attached_deposit();
        
        assert!(
            required_cost <= attached_deposit,
            "Must attach at least {} yoctoNEAR to cover storage",
            required_cost.as_yoctonear()
        );

        self.handle_fees(required_cost, attached_deposit, owneraccount_id, mintingfee_account);

        env::log_str(
            &serde_json::to_string(&json!({
                "standard": RODIT_STANDARD_NAME,
                "version": RODIT_METADATA_SPEC,
                "event": "rodit_mint",
                "data": [{
                    "owner_id": token.owner_id,
                    "token_ids": [token_id]
                }]
            }))
            .unwrap(),
        );
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
}

impl Contract {
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

    fn handle_fees(
        &self,
        storage_cost: NearToken,
        attached_deposit: NearToken,
        receiver_id: AccountId,
        minting_fee_account: AccountId,
    ) {
        let initialize_fee = NearToken::from_yoctonear(100_000_000_000_000_000_000); // 0.1 NEAR
        
        let contract_fee = NearToken::from_yoctonear(
            (attached_deposit.as_yoctonear()
                .saturating_sub(storage_cost.as_yoctonear())
                .saturating_sub(initialize_fee.as_yoctonear())) / 100
        ); // 1% fee

        let remaining_balance = NearToken::from_yoctonear(
            attached_deposit.as_yoctonear()
                .saturating_sub(storage_cost.as_yoctonear())
                .saturating_sub(contract_fee.as_yoctonear())
                .saturating_sub(initialize_fee.as_yoctonear())
        );

        Promise::new(receiver_id).transfer(initialize_fee);
        Promise::new(env::current_account_id()).transfer(contract_fee);

        if remaining_balance.as_yoctonear() > 0 {
            Promise::new(minting_fee_account).transfer(remaining_balance);
        }
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