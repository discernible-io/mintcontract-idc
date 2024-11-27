use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::{env, near_bindgen, AccountId, PanicOnDefault};
use near_sdk::collections::UnorderedSet;

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Contract {
    // Store authorized wallets
    authorized_wallets: UnorderedSet<AccountId>,
    // Store the contract owner
    owner_id: AccountId,
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new(owner_id: AccountId) -> Self {
        let mut contract = Self {
            authorized_wallets: UnorderedSet::new(b"a"),
            owner_id,
        };
        // Add owner to authorized wallets by default
        contract.authorized_wallets.insert(&owner_id);
        contract
    }

    // Modifier function to check if caller is authorized
    fn assert_authorized(&self) {
        let caller = env::predecessor_account_id();
        assert!(
            self.authorized_wallets.contains(&caller),
            "Unauthorized: This function can only be called by authorized wallets"
        );
    }

    // Owner-only function to add authorized wallets
    pub fn add_authorized_wallet(&mut self, wallet_id: AccountId) {
        assert_eq!(
            env::predecessor_account_id(),
            self.owner_id,
            "Only the owner can add authorized wallets"
        );
        self.authorized_wallets.insert(&wallet_id);
    }

    // Owner-only function to remove authorized wallets
    pub fn remove_authorized_wallet(&mut self, wallet_id: AccountId) {
        assert_eq!(
            env::predecessor_account_id(),
            self.owner_id,
            "Only the owner can remove authorized wallets"
        );
        assert_ne!(
            wallet_id, 
            self.owner_id,
            "Cannot remove owner from authorized wallets"
        );
        self.authorized_wallets.remove(&wallet_id);
    }

    // Example of a restricted function
    pub fn restricted_function(&self, message: String) -> String {
        self.assert_authorized();
        format!("Authorized wallet called with message: {}", message)
    }

    // Public function to check if a wallet is authorized
    pub fn is_authorized(&self, wallet_id: AccountId) -> bool {
        self.authorized_wallets.contains(&wallet_id)
    }

    // Public function to get all authorized wallets
    pub fn get_authorized_wallets(&self) -> Vec<AccountId> {
        self.authorized_wallets.to_vec()
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
            .build()
    }

    #[test]
    fn test_new() {
        let context = get_context(accounts(0));
        testing_env!(context);
        let contract = Contract::new(accounts(0));
        assert!(contract.is_authorized(accounts(0)));
    }

    #[test]
    fn test_authorized_function() {
        let context = get_context(accounts(0));
        testing_env!(context);
        let contract = Contract::new(accounts(0));
        
        // Should work for authorized wallet
        let result = contract.restricted_function("test".to_string());
        assert!(result.contains("test"));
    }

    #[test]
    #[should_panic(expected = "Unauthorized")]
    fn test_unauthorized_function() {
        let mut context = get_context(accounts(0));
        testing_env!(context);
        let contract = Contract::new(accounts(0));
        
        // Switch context to unauthorized wallet
        context = get_context(accounts(1));
        testing_env!(context);
        
        // Should panic for unauthorized wallet
        contract.restricted_function("test".to_string());
    }
}