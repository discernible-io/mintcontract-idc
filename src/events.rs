use near_sdk::{env, AccountId};
use serde_json::json;

use crate::{RODIT_METADATA_SPEC, RODIT_STANDARD_NAME};

/// Standardized event emission following NEP-297
pub fn emit_mint_event(owner_id: &AccountId, token_id: &str) {
    env::log_str(
        &serde_json::to_string(&json!({
            "standard": RODIT_STANDARD_NAME,
            "version": RODIT_METADATA_SPEC,
            "event": "rodit_mint",
            "data": [{
                "owner_id": owner_id,
                "token_ids": [token_id],
            }]
        }))
        .unwrap(),
    );
}

pub fn emit_transfer_event(sender_id: &AccountId, receiver_id: &AccountId, token_id: &str, memo: Option<&str>) {
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

pub fn emit_burn_event(owner_id: &AccountId, token_id: &str) {
    env::log_str(
        &serde_json::to_string(&json!({
            "standard": RODIT_STANDARD_NAME,
            "version": RODIT_METADATA_SPEC,
            "event": "rodit_burn",
            "data": [{
                "owner_id": owner_id,
                "token_ids": [token_id],
            }]
        }))
        .unwrap(),
    );
}

pub fn emit_recover_event(previous_owner: &AccountId, destination_account: &AccountId, token_id: &str) {
    env::log_str(
        &serde_json::to_string(&json!({
            "standard": RODIT_STANDARD_NAME,
            "version": RODIT_METADATA_SPEC,
            "event": "rodit_recover",
            "data": [{
                "previous_owner_id": previous_owner,
                "new_owner_id": destination_account,
                "token_ids": [token_id],
            }]
        }))
        .unwrap(),
    );
}

pub fn emit_storage_payment(account_id: &AccountId, amount: u128) {
    env::log_str(
        &serde_json::to_string(&json!({
            "standard": RODIT_STANDARD_NAME,
            "version": RODIT_METADATA_SPEC,
            "event": "rodit_storage_payment",
            "data": [{
                "account_id": account_id,
                "amount": amount.to_string(),
            }]
        }))
        .unwrap(),
    );
}

pub fn emit_contract_fee(amount: u128) {
    env::log_str(
        &serde_json::to_string(&json!({
            "standard": RODIT_STANDARD_NAME,
            "version": RODIT_METADATA_SPEC,
            "event": "rodit_contract_fee",
            "data": [{
                "amount": amount.to_string(),
            }]
        }))
        .unwrap(),
    );
}

pub fn emit_provider_fee(account_id: &AccountId, amount: u128) {
    env::log_str(
        &serde_json::to_string(&json!({
            "standard": RODIT_STANDARD_NAME,
            "version": RODIT_METADATA_SPEC,
            "event": "rodit_provider_fee",
            "data": [{
                "provider_id": account_id,
                "amount": amount.to_string(),
            }]
        }))
        .unwrap(),
    );
}

pub fn emit_signer_added(public_key_base64: &str) {
    env::log_str(
        &serde_json::to_string(&json!({
            "standard": RODIT_STANDARD_NAME,
            "version": RODIT_METADATA_SPEC,
            "event": "rodit_signer_added",
            "data": [{
                "public_key": public_key_base64,
            }]
        }))
        .unwrap(),
    );
}

pub fn emit_signer_removed(public_key_base64: &str) {
    env::log_str(
        &serde_json::to_string(&json!({
            "standard": RODIT_STANDARD_NAME,
            "version": RODIT_METADATA_SPEC,
            "event": "rodit_signer_removed",
            "data": [{
                "public_key": public_key_base64,
            }]
        }))
        .unwrap(),
    );
}

pub fn emit_contract_status_change(status: &str) {
    env::log_str(
        &serde_json::to_string(&json!({
            "standard": RODIT_STANDARD_NAME,
            "version": RODIT_METADATA_SPEC,
            "event": "rodit_status_change",
            "data": [{
                "status": status,
            }]
        }))
        .unwrap(),
    );
}
