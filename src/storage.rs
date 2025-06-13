use near_sdk::{env, AccountId, Promise, NearToken, require};
use crate::{INITIALIZE_FEE, CONTRACT_FEE_PERCENTAGE, STORAGE_COST_PER_BYTE};
use crate::events::{emit_storage_payment, emit_contract_fee, emit_provider_fee};

/// Handles the storage costs and fee distribution for token minting
pub fn handle_account_fees_and_storage(
    storage_used: u64,
    implicit_account_id: &AccountId,
    minting_fee_account: &AccountId,
) -> Result<(), String> {
    // Calculate required storage cost based on actual usage
    let required_storage_cost = STORAGE_COST_PER_BYTE.checked_mul(storage_used as u128)
        .ok_or_else(|| "Storage cost calculation overflow".to_string())?;
    
    // Add a 10% buffer for future storage needs
    let storage_with_buffer = required_storage_cost
        .checked_mul(110)
        .ok_or_else(|| "Storage buffer calculation overflow".to_string())?
        .checked_div(100)
        .ok_or_else(|| "Storage buffer division error".to_string())?;
    
    let attached_deposit = env::attached_deposit();
    
    // Ensure enough deposit is attached
    let min_required = storage_with_buffer
        .checked_add(INITIALIZE_FEE)
        .ok_or_else(|| "Deposit calculation overflow".to_string())?;
    
    require!(
        min_required <= attached_deposit.as_yoctonear(),
        format!("Must attach at least {} yoctoNEAR to cover storage and fee", min_required)
    );

    // Initialize recipient account
    Promise::new(implicit_account_id.clone())
        .transfer(NearToken::from_yoctonear(INITIALIZE_FEE));
    
    emit_storage_payment(implicit_account_id, INITIALIZE_FEE);

    // Calculate contract fee (1% of remaining after storage and init fee)
    let attached_deposit_yocto = env::attached_deposit().as_yoctonear();
    let remaining_after_storage = attached_deposit_yocto
        .checked_sub(storage_with_buffer)
        .ok_or_else(|| "Insufficient funds after storage costs".to_string())?
        .checked_sub(INITIALIZE_FEE)
        .ok_or_else(|| "Insufficient funds after initialization fee".to_string())?;
    
    let contract_fee = remaining_after_storage
        .checked_mul(CONTRACT_FEE_PERCENTAGE)
        .ok_or_else(|| "Contract fee calculation overflow".to_string())?
        .checked_div(100)
        .ok_or_else(|| "Contract fee division error".to_string())?;

    // Calculate remaining balance for provider
    let remaining_balance = remaining_after_storage
        .checked_sub(contract_fee)
        .ok_or_else(|| "Insufficient funds after contract fee".to_string())?;

    emit_contract_fee(contract_fee);
    emit_provider_fee(minting_fee_account, remaining_balance);

    // Transfer contract fee
    Promise::new(env::current_account_id())
        .transfer(NearToken::from_yoctonear(contract_fee));

    // Transfer remaining balance to provider if any
    if remaining_balance > 0 {
        Promise::new(minting_fee_account.clone())
            .transfer(NearToken::from_yoctonear(remaining_balance));
    }

    Ok(())
}
