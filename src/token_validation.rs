// No imports from near_sdk needed here
use regex::Regex;
use lazy_static::lazy_static;
use serde_json;

// Regular expressions for validation
lazy_static! {
    static ref DATE_REGEX: Regex = Regex::new(r"^\d{4}-\d{2}-\d{2}$").unwrap();
    static ref URL_REGEX: Regex = Regex::new(r"^https?://[^\s/$.?#].[^\s]*$").unwrap();
    static ref CIDR_REGEX: Regex = Regex::new(r"^([0-9]{1,3}\.){3}[0-9]{1,3}/([0-9]|[1-2][0-9]|3[0-2])$").unwrap();
}

/// Validates a date string format (YYYY-MM-DD)
/// Equivalent to part of validateAndSetDate in utils.js
pub fn validate_date_format(date_str: &str) -> bool {
    if date_str.is_empty() {
        return false;
    }
    
    DATE_REGEX.is_match(date_str)
}

/// Validates a URL format
/// Equivalent to part of validateAndSetUrl in utils.js
pub fn validate_url(url: &str) -> bool {
    if url.is_empty() {
        return true; // Empty URL is considered valid (optional field)
    }
    
    // Basic URL validation using regex
    if !URL_REGEX.is_match(url) {
        return false;
    }
    
    // Additional validation could be added here if needed
    true
}

/// Validates a CIDR notation string
/// No direct equivalent in utils.js, but used in token metadata validation
pub fn validate_cidr(cidr: &str) -> bool {
    if cidr.is_empty() {
        return true; // Empty CIDR is considered valid (optional field)
    }
    CIDR_REGEX.is_match(cidr)
}

/// Helper function to validate escaped JSON strings
pub fn validate_escaped_json(json_str: &str) -> bool {
    if json_str.is_empty() {
        return false;
    }
    
    // Handle escaped JSON by unescaping it first
    if let Ok(unescaped) = serde_json::from_str::<String>(format!("\"{}\"", json_str.replace("\"", "\\\"")).as_str()) {
        if let Ok(_) = serde_json::from_str::<serde_json::Value>(&unescaped) {
            return true; // Valid JSON after unescaping
        }
    }
    
    false
}

/// Validates ISO 3166 country codes in JSON format
/// Handles both simple comma-separated lists and JSON structures with allow/deny fields
pub fn validate_iso3166(country_list_json: &str) -> bool {
    // Empty input is not valid
    if country_list_json.is_empty() {
        return false;
    }
    
    // Try to parse as JSON first
    if country_list_json.starts_with('{') {
        return validate_escaped_json(country_list_json);
    }
    
    // If not JSON, validate as a simple comma-separated list of country codes
    // ISO 3166 country code list validation (comma-separated)
    lazy_static! {
        static ref COUNTRY_CODE_REGEX: Regex = Regex::new(r"^([A-Z]{2})(,[A-Z]{2})*$").unwrap();
    }
    
    // Special case: "WLD" is a valid value representing "worldwide" (no restrictions)
    if country_list_json == "WLD" {
        return true;
    }
    
    COUNTRY_CODE_REGEX.is_match(country_list_json)
}

/// Validates that a string can be parsed as a number
/// Similar to numeric validation in utils.js
pub fn validate_numeric_string(num_str: &str) -> bool {
    num_str.parse::<u64>().is_ok()
}

/// Validates all token metadata fields
/// This function combines the validation logic similar to the various validateAndSet* functions in utils.js
/// but adapted for the Rust smart contract environment
pub fn validate_token_metadata(
    openapijson_url: &str,
    not_after: &str,
    not_before: &str,
    max_requests: &str,
    maxrq_window: &str,
    webhook_url: &str,
    webhook_cidr: &str,
    allowed_cidr: &str,
    allowed_iso3166list: &str,
    jwt_duration: &str,
    permissioned_routes: &str,
) -> Result<(), String> {
    // URL validations - similar to validateAndSetUrl in utils.js
    if !validate_url(openapijson_url) {
        return Err(format!("Invalid openapijson_url format: {}", openapijson_url));
    }
    
    if !validate_url(webhook_url) {
        return Err(format!("Invalid webhook_url format: {}", webhook_url));
    }
    
    // Date validations - similar to validateAndSetDate in utils.js
    if !validate_date_format(not_after) {
        return Err(format!("Invalid not_after date format (should be YYYY-MM-DD): {}", not_after));
    }
    
    if !validate_date_format(not_before) {
        return Err(format!("Invalid not_before date format (should be YYYY-MM-DD): {}", not_before));
    }
    
    // Numeric validations - similar to numeric validation in utils.js
    if !validate_numeric_string(max_requests) {
        return Err(format!("Invalid max_requests (should be a number): {}", max_requests));
    }
    
    if !validate_numeric_string(maxrq_window) {
        return Err(format!("Invalid maxrq_window (should be a number): {}", maxrq_window));
    }
    
    if !validate_numeric_string(jwt_duration) {
        return Err(format!("Invalid jwt_duration (should be a number): {}", jwt_duration));
    }
    
    // CIDR validations - no direct equivalent in utils.js but important for token validation
    if !webhook_cidr.is_empty() && !validate_cidr(webhook_cidr) {
        return Err(format!("Invalid webhook_cidr format: {}", webhook_cidr));
    }
    
    if !allowed_cidr.is_empty() && !validate_cidr(allowed_cidr) {
        return Err(format!("Invalid allowed_cidr format: {}", allowed_cidr));
    }
    
    // ISO 3166 country code list validation - no direct equivalent in utils.js
    if !validate_iso3166(allowed_iso3166list) {
        return Err(format!("Invalid allowed_iso3166list format (should be comma-separated 2-letter country codes): {}", allowed_iso3166list));
    }
    
    // Validate permissioned_routes as JSON
    if !permissioned_routes.is_empty() {
        // Validate as escaped JSON
        if !validate_escaped_json(permissioned_routes) {
            return Err(format!("Invalid permissioned_routes JSON: failed to parse escaped JSON"))
        }
    }
    
    Ok(())
}
