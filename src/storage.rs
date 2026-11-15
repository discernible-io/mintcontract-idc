// Copyright (c) 2026 Discernible IO
// SPDX-License-Identifier: AGPL-3.0-only

use near_sdk::{env, AccountId, Promise, NearToken, require};
use crate::events::{emit_storage_payment, emit_contract_fee, emit_provider_fee};

/// Handles the storage costs and fee distribution for token minting
pub fn handle_account_fees_and_storage(
    storage_used: u64,
    implicit_account_id: &AccountId,
    minting_fee_account: &AccountId,
    initialize_fee: u128,
    contract_fee_percentage: u128,
    storage_cost_per_byte: u128,
) -> Result<(), String> {
    // Calculate required storage cost based on actual usage
    let required_storage_cost = storage_cost_per_byte.checked_mul(storage_used as u128)
        .ok_or_else(|| "Storage cost calculation overflow".to_string())?;
    let attached_deposit = env::attached_deposit();
    
    // Ensure enough deposit is attached
    let min_required = required_storage_cost
        .checked_add(initialize_fee)
        .ok_or_else(|| "Deposit calculation overflow".to_string())?;

    require!(
        min_required <= attached_deposit.as_yoctonear(),
        format!("Must attach at least {} yoctoNEAR to cover storage and fee", min_required)
    );

    // Transfer initialization fee to the implicit account
    Promise::new(implicit_account_id.clone())
        .transfer(NearToken::from_yoctonear(initialize_fee));
    
    emit_storage_payment(implicit_account_id, initialize_fee);

    // Calculate contract fee (1% of remaining after storage and init fee)
    let attached_deposit_yocto = env::attached_deposit().as_yoctonear();
    let remaining_after_storage = attached_deposit_yocto
        .checked_sub(required_storage_cost)
        .ok_or_else(|| "Insufficient funds after storage costs".to_string())?
        .checked_sub(initialize_fee)
        .ok_or_else(|| "Insufficient funds after initialization fee".to_string())?;
    
    let contract_fee = remaining_after_storage
        .checked_mul(contract_fee_percentage)
        .ok_or_else(|| "Contract fee calculation overflow".to_string())?
        .checked_div(100)
        .ok_or_else(|| "Contract fee division error".to_string())?;

    // Calculate remaining balance for provider
    let remaining_balance = remaining_after_storage
        .checked_sub(contract_fee)
        .ok_or_else(|| "Insufficient funds after contract fee".to_string())?;

    emit_contract_fee(contract_fee);
    emit_provider_fee(minting_fee_account, remaining_balance);

    // SECURITY FIX: Do not transfer contract fee to self - it's already in the contract balance
    // Transferring to current_account_id is redundant and wastes gas
    // The contract fee simply remains in the contract balance

    // Transfer remaining balance to provider if any
    if remaining_balance > 0 {
        Promise::new(minting_fee_account.clone())
            .transfer(NearToken::from_yoctonear(remaining_balance));
    }

    Ok(())
}
