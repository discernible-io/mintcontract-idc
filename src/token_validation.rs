// No imports from near_sdk needed here
use regex::Regex;
use lazy_static::lazy_static;

// Validation functions for token metadata
pub fn validate_date_format(date_str: &str) -> bool {
    // ISO 8601 format: YYYY-MM-DD
    lazy_static! {
        static ref DATE_REGEX: Regex = Regex::new(r"^\d{4}-\d{2}-\d{2}$").unwrap();
    }
    DATE_REGEX.is_match(date_str)
}

pub fn validate_url(url: &str) -> bool {
    // Basic URL validation
    lazy_static! {
        static ref URL_REGEX: Regex = Regex::new(
            r"^(https?://)?([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(/[a-zA-Z0-9_.-]*)*/?$"
        ).unwrap();
    }
    URL_REGEX.is_match(url)
}

pub fn validate_cidr(cidr: &str) -> bool {
    // CIDR notation validation (IPv4)
    lazy_static! {
        static ref CIDR_REGEX: Regex = Regex::new(
            r"^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])(\/([0-9]|[1-2][0-9]|3[0-2]))$"
        ).unwrap();
    }
    CIDR_REGEX.is_match(cidr)
}

pub fn validate_iso3166(country_list: &str) -> bool {
    // ISO 3166 country code list validation (comma-separated)
    lazy_static! {
        static ref COUNTRY_CODE_REGEX: Regex = Regex::new(r"^([A-Z]{2})(,[A-Z]{2})*$").unwrap();
    }
    
    // Empty list is valid
    if country_list.is_empty() {
        return true;
    }
    
    COUNTRY_CODE_REGEX.is_match(country_list)
}

pub fn validate_numeric_string(num_str: &str) -> bool {
    num_str.parse::<u64>().is_ok()
}

// Validate all token metadata fields
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
) -> Result<(), String> {
    // URL validations
    if !validate_url(openapijson_url) {
        return Err(format!("Invalid openapijson_url format: {}", openapijson_url));
    }
    
    if !validate_url(webhook_url) {
        return Err(format!("Invalid webhook_url format: {}", webhook_url));
    }
    
    // Date validations
    if !validate_date_format(not_after) {
        return Err(format!("Invalid not_after date format (should be YYYY-MM-DD): {}", not_after));
    }
    
    if !validate_date_format(not_before) {
        return Err(format!("Invalid not_before date format (should be YYYY-MM-DD): {}", not_before));
    }
    
    // Numeric string validations
    if !validate_numeric_string(max_requests) {
        return Err(format!("Invalid max_requests (should be a number): {}", max_requests));
    }
    
    if !validate_numeric_string(maxrq_window) {
        return Err(format!("Invalid maxrq_window (should be a number): {}", maxrq_window));
    }
    
    if !validate_numeric_string(jwt_duration) {
        return Err(format!("Invalid jwt_duration (should be a number): {}", jwt_duration));
    }
    
    // CIDR validations
    if !webhook_cidr.is_empty() && !validate_cidr(webhook_cidr) {
        return Err(format!("Invalid webhook_cidr format: {}", webhook_cidr));
    }
    
    if !allowed_cidr.is_empty() && !validate_cidr(allowed_cidr) {
        return Err(format!("Invalid allowed_cidr format: {}", allowed_cidr));
    }
    
    // ISO 3166 country code list validation
    if !validate_iso3166(allowed_iso3166list) {
        return Err(format!("Invalid allowed_iso3166list format (should be comma-separated 2-letter country codes): {}", allowed_iso3166list));
    }
    
    Ok(())
}
