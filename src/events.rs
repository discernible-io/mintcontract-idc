// Copyright (c) 2026 Discernible IO
// SPDX-License-Identifier: AGPL-3.0-only

use near_sdk::{env, AccountId};
use serde_json::{json, Value};

use crate::{RODIT_METADATA_SPEC, RODIT_STANDARD_NAME};

/// Helper function to log standardized events following NEP-297
/// This reduces code duplication and improves maintainability
fn log_event(event_name: &str, data: Value) {
    let event = serde_json::to_string(&json!({
        "standard": RODIT_STANDARD_NAME,
        "version": RODIT_METADATA_SPEC,
        "event": event_name,
        "data": [data]
    })).expect("Failed to serialize event");
    
    env::log_str(&event);
}

/// Standardized event emission following NEP-297
pub fn emit_mint_event(owner_id: &AccountId, token_id: &str) {
    log_event("rodit_mint", json!({
        "owner_id": owner_id,
        "token_ids": [token_id],
    }));
}

pub fn emit_transfer_event(sender_id: &AccountId, receiver_id: &AccountId, token_id: &str, memo: Option<&str>) {
    log_event("rodit_transfer", json!({
        "old_owner_id": sender_id,
        "new_owner_id": receiver_id,
        "token_ids": [token_id],
        "memo": memo,
    }));
}

pub fn emit_burn_event(owner_id: &AccountId, token_id: &str) {
    log_event("rodit_burn", json!({
        "owner_id": owner_id,
        "token_ids": [token_id],
    }));
}

pub fn emit_recover_event(previous_owner: &AccountId, destination_account: &AccountId, token_id: &str) {
    log_event("rodit_recover", json!({
        "previous_owner_id": previous_owner,
        "new_owner_id": destination_account,
        "token_ids": [token_id],
    }));
}

pub fn emit_storage_payment(account_id: &AccountId, amount: u128) {
    log_event("rodit_storage_payment", json!({
        "account_id": account_id,
        "amount": amount.to_string(),
    }));
}

pub fn emit_contract_fee(amount: u128) {
    log_event("rodit_contract_fee", json!({
        "amount": amount.to_string(),
    }));
}

pub fn emit_provider_fee(account_id: &AccountId, amount: u128) {
    log_event("rodit_provider_fee", json!({
        "provider_id": account_id,
        "amount": amount.to_string(),
    }));
}

pub fn emit_signer_added(public_key_base64: &str) {
    log_event("rodit_signer_added", json!({
        "public_key": public_key_base64,
    }));
}

pub fn emit_signer_removed(public_key_base64: &str) {
    log_event("rodit_signer_removed", json!({
        "public_key": public_key_base64,
    }));
}

pub fn emit_contract_status_change(status: &str) {
    log_event("rodit_status_change", json!({
        "status": status,
    }));
}

pub fn emit_minting_disabled(disabled_by: &AccountId) {
    log_event("rodit_minting_disabled", json!({
        "disabled_by": disabled_by,
    }));
}

pub fn emit_capacity(total_supply: u64, capacity: u64, threshold_percent: u16) {
    let percentage = if capacity > 0 {
        (total_supply as f64 / capacity as f64 * 100.0 * 100.0).round() / 100.0
    } else {
        0.0
    };
    
    log_event("rodit_capacity", json!({
        "total_supply": total_supply,
        "capacity": capacity,
        "percentage_used": percentage,
        "threshold_percent": threshold_percent,
        "remaining": capacity.saturating_sub(total_supply),
    }));
}
