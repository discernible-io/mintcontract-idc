use near_sdk::test_utils::{accounts, VMContextBuilder};
use near_sdk::{testing_env, AccountId, VMContext};

// Import the contract using the crate name from Cargo.toml
extern crate rodit_near;
use rodit_near::Contract;
use ed25519_dalek::{Keypair, Signer, PublicKey, SecretKey};
use rand::rngs::ThreadRng;
use rand::thread_rng;
use serde_json::json;

fn get_context(predecessor_account_id: AccountId) -> VMContext {
    let mut builder = VMContextBuilder::new();
    builder.predecessor_account_id(predecessor_account_id);
    builder.build()
}

#[test]
fn test_signature_verification() {
    // Set up the testing context
    let account_id = accounts(0);
    let context = get_context(account_id.clone());
    testing_env!(context);
    
    // Initialize contract
    let mut contract = Contract::new(
        account_id.clone(),
        "Rodit Contract".to_string(),
        "RODIT".to_string(),
        "1.0.0".to_string(),
    );
    
    // Generate a test keypair
    let mut csprng = thread_rng();
    let keypair: Keypair = Keypair::generate(&mut csprng);
    let public_key_bytes = keypair.public.as_bytes().to_vec();
    
    // Add the public key to authorized signers
    contract.add_authorized_signer(public_key_bytes);
    
    // Create test data to sign
    let fee_data = json!({
        "token_id": "test-token-123",
        "mintingfee": "1000000000000000000000000",
        "mintingfeeaccount": account_id.to_string()
    });
    
    // Canonicalize the JSON
    let canonical_fee_data = Contract::canonicalize_json(&fee_data);
    let message = serde_json::to_string(&canonical_fee_data)
        .expect("Failed to serialize fee data")
        .as_bytes()
        .to_vec();
    
    // Sign the message
    let signature = keypair.sign(&message);
    
    // Convert signature to base64url format
    let signature_bytes = signature.to_bytes();
    let signature_base64 = base64::encode(&signature_bytes);
    let signature_base64url = Contract::base64_to_base64url(&signature_base64);
    
    // Test the verification function
    contract.verify_fee_signature(&message, &signature_base64url);
    
    // If we reach here without panicking, the test passed
    assert!(true, "Signature verification passed");
    
    // Test with invalid signature
    let mut invalid_signature_bytes = signature_bytes.clone();
    // Modify a byte to make the signature invalid
    if invalid_signature_bytes[0] == 0 {
        invalid_signature_bytes[0] = 1;
    } else {
        invalid_signature_bytes[0] = 0;
    }
    
    let invalid_signature_base64 = base64::encode(&invalid_signature_bytes);
    let invalid_signature_base64url = Contract::base64_to_base64url(&invalid_signature_base64);
    
    // This should panic
    let result = std::panic::catch_unwind(|| {
        contract.verify_fee_signature(&message, &invalid_signature_base64url);
    });
    
    assert!(result.is_err(), "Expected panic with invalid signature");
}

// Additional test for base64url conversion
#[test]
fn test_base64url_conversion() {
    let original = "abc+/=";
    let expected_base64url = "abc-_";
    let actual_base64url = Contract::base64_to_base64url(original);
    assert_eq!(expected_base64url, actual_base64url);
    
    let back_to_base64 = Contract::base64url_to_base64(&actual_base64url);
    // Note: padding might be different, so we don't compare directly with original
    let decoded_original = base64::decode(original).unwrap();
    let decoded_converted = base64::decode(&back_to_base64).unwrap();
    assert_eq!(decoded_original, decoded_converted);
}
