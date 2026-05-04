use near_sdk::{env, require, AccountId};
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use crate::ContractStatus;
use crate::events::emit_contract_status_change;

/// Default upgrade delay period in seconds
/// Set to 30 seconds for testing/development
/// For production, consider using 86400 (24 hours) for safety
pub const DEFAULT_UPGRADE_DELAY_SECONDS: u64 = 30;

/// Minimum allowed upgrade delay (30 seconds)
pub const MIN_UPGRADE_DELAY_SECONDS: u64 = 30;

/// Handles contract upgrade process
#[derive(BorshDeserialize, BorshSerialize)]
pub struct ContractUpgrade {
    pub upgrade_delay: u64,
    pub upgrade_proposed_at: Option<u64>,
    pub upgrade_proposed_by: Option<AccountId>,
}

impl Default for ContractUpgrade {
    fn default() -> Self {
        Self {
            upgrade_delay: DEFAULT_UPGRADE_DELAY_SECONDS,
            upgrade_proposed_at: None,
            upgrade_proposed_by: None,
        }
    }
}

impl ContractUpgrade {
    /// Proposes a contract upgrade with a time delay
    pub fn propose_upgrade(&mut self, status: &mut ContractStatus) -> Result<(), String> {
        // Only allow proposing upgrade when contract is active
        require!(*status == ContractStatus::Active, "Contract must be active to propose upgrade");
        
        // Set the upgrade proposal time and proposer
        self.upgrade_proposed_at = Some(env::block_timestamp() / 1_000_000_000);
        self.upgrade_proposed_by = Some(env::predecessor_account_id());
        
        // Change status to upgrading
        *status = ContractStatus::Upgrading;
        emit_contract_status_change("Upgrading");
        
        Ok(())
    }
    
    /// Cancels a proposed upgrade
    pub fn cancel_upgrade(&mut self, status: &mut ContractStatus) -> Result<(), String> {
        // Only allow cancelling when in upgrading status
        require!(*status == ContractStatus::Upgrading, "No upgrade in progress");
        
        // Only the account that proposed the upgrade can cancel it
        let predecessor = env::predecessor_account_id();
        require!(
            self.upgrade_proposed_by.as_ref() == Some(&predecessor),
            "Only the account that proposed the upgrade can cancel it"
        );
        
        // Reset upgrade state
        self.upgrade_proposed_at = None;
        self.upgrade_proposed_by = None;
        
        // Change status back to active
        *status = ContractStatus::Active;
        emit_contract_status_change("Active");
        
        Ok(())
    }
    
    /// Finalizes the upgrade after the delay period
    pub fn finalize_upgrade(&mut self) -> Result<(), &'static str> {
        let current_time = env::block_timestamp() / 1_000_000_000;
        
        // Check if an upgrade has been proposed
        let proposed_at = self.upgrade_proposed_at.ok_or("No upgrade has been proposed")?;
        
        // Check if the proposer matches
        let proposer = self.upgrade_proposed_by.as_ref().ok_or("No upgrade proposer found")?;
        require!(env::predecessor_account_id() == *proposer, "Only the account that proposed the upgrade can finalize it");
        
        // Check if enough time has passed
        require!(current_time >= proposed_at + self.upgrade_delay, "Upgrade delay period has not passed");
    
        // Reset upgrade state
        self.upgrade_proposed_at = None;
        self.upgrade_proposed_by = None;
    
        Ok(())
    }
    
    /// Sets a new upgrade delay period
    pub fn set_upgrade_delay(&mut self, new_delay: u64) {
        require!(
            new_delay >= MIN_UPGRADE_DELAY_SECONDS, 
            format!("Upgrade delay must be at least {} seconds (1 minute)", MIN_UPGRADE_DELAY_SECONDS)
        );
        self.upgrade_delay = new_delay;
    }
    
    /// Gets the remaining time until upgrade can be finalized
    pub fn get_upgrade_remaining_time(&self) -> Option<u64> {
        if let Some(proposed_at) = self.upgrade_proposed_at {
            let current_time = env::block_timestamp() / 1_000_000_000;
            let deadline = proposed_at + self.upgrade_delay;
            
            if current_time < deadline {
                Some(deadline - current_time)
            } else {
                Some(0)
            }
        } else {
            None
        }
    }
}
