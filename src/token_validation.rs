//! Token metadata validation module
//! 
//! This module provides comprehensive validation for RODIT token metadata fields.
//! It ensures that all token metadata conforms to expected formats before minting.

use regex::Regex;
use lazy_static::lazy_static;
use serde_json;

// Regular expressions for validation
lazy_static! {
    /// Validates date format: YYYY-MM-DD
    static ref DATE_REGEX: Regex = Regex::new(r"^\d{4}-\d{2}-\d{2}$").unwrap();
    
    /// Validates HTTPS URLs with basic structure checking
    static ref URL_REGEX: Regex = Regex::new(r"^https://[^\s/$.?#].[^\s]*$").unwrap();
    
    /// Validates CIDR notation (e.g., 192.168.1.0/24)
    static ref CIDR_REGEX: Regex = Regex::new(r"^([0-9]{1,3}\.){3}[0-9]{1,3}/([0-9]|[1-2][0-9]|3[0-2])$").unwrap();
    
    /// Validates domain names
    static ref DOMAIN_REGEX: Regex = Regex::new(r"^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$").unwrap();
}

/// Validates a date string format (YYYY-MM-DD)
/// 
/// # Arguments
/// * `date_str` - The date string to validate
/// 
/// # Returns
/// * `bool` - true if the date is in valid YYYY-MM-DD format
/// 
/// # Examples
/// ```
/// assert!(validate_date_format("2025-12-31"));
/// assert!(!validate_date_format("2025/12/31"));
/// ```
pub fn validate_date_format(date_str: &str) -> bool {
    if date_str.is_empty() {
        return false;
    }
    
    if !DATE_REGEX.is_match(date_str) {
        return false;
    }
    
    // Additional validation: check if date components are in valid ranges
    let parts: Vec<&str> = date_str.split('-').collect();
    if parts.len() != 3 {
        return false;
    }
    
    if let (Ok(year), Ok(month), Ok(day)) = (
        parts[0].parse::<u32>(),
        parts[1].parse::<u32>(),
        parts[2].parse::<u32>()
    ) {
        // Basic range validation
        year >= 2020 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31
    } else {
        false
    }
}

/// Validates a URL format
/// 
/// # Arguments
/// * `url` - The URL string to validate
/// 
/// # Returns
/// * `bool` - true if the URL is valid HTTPS format or empty
/// 
/// # Security Notes
/// - Only HTTPS URLs are allowed for security
/// - Empty URLs are considered valid (optional field)
/// - URL must not contain whitespace or control characters
pub fn validate_url(url: &str) -> bool {
    if url.is_empty() {
        return true; // Empty URL is considered valid (optional field)
    }
    
    // Check for whitespace or control characters
    if url.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return false;
    }
    
    // Must be HTTPS
    if !url.starts_with("https://") {
        return false;
    }
    
    // Basic URL validation using regex
    if !URL_REGEX.is_match(url) {
        return false;
    }
    
    // Extract and validate domain
    if let Some(domain_start) = url.find("://") {
        let after_protocol = &url[domain_start + 3..];
        if let Some(domain_end) = after_protocol.find('/').or_else(|| Some(after_protocol.len())) {
            let domain = &after_protocol[..domain_end];
            // Remove port if present
            let domain_without_port = domain.split(':').next().unwrap_or(domain);
            return DOMAIN_REGEX.is_match(domain_without_port) || domain_without_port == "localhost";
        }
    }
    
    false
}

/// Validates a CIDR notation string
/// 
/// # Arguments
/// * `cidr` - The CIDR notation string to validate (e.g., "192.168.1.0/24")
/// 
/// # Returns
/// * `bool` - true if the CIDR notation is valid or empty
/// 
/// # Examples
/// ```
/// assert!(validate_cidr("192.168.1.0/24"));
/// assert!(validate_cidr("10.0.0.0/8"));
/// assert!(!validate_cidr("256.1.1.1/24"));
/// ```
pub fn validate_cidr(cidr: &str) -> bool {
    if cidr.is_empty() {
        return true; // Empty CIDR is considered valid (optional field)
    }
    
    if !CIDR_REGEX.is_match(cidr) {
        return false;
    }
    
    // Additional validation: check if IP octets are in valid range (0-255)
    let parts: Vec<&str> = cidr.split('/').collect();
    if parts.len() != 2 {
        return false;
    }
    
    let ip_parts: Vec<&str> = parts[0].split('.').collect();
    if ip_parts.len() != 4 {
        return false;
    }
    
    for octet in ip_parts {
        if let Ok(num) = octet.parse::<u32>() {
            if num > 255 {
                return false;
            }
        } else {
            return false;
        }
    }
    
    true
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
/// 
/// # Arguments
/// * `num_str` - The numeric string to validate
/// 
/// # Returns
/// * `bool` - true if the string can be parsed as a valid u64
/// 
/// # Security Notes
/// - Only non-negative integers are allowed
/// - Maximum value is u64::MAX
pub fn validate_numeric_string(num_str: &str) -> bool {
    if num_str.is_empty() {
        return false;
    }
    
    // Check for leading zeros (except "0" itself)
    if num_str.len() > 1 && num_str.starts_with('0') {
        return false;
    }
    
    num_str.parse::<u64>().is_ok()
}

/// Validates all token metadata fields comprehensively
/// 
/// This function performs thorough validation of all RODIT token metadata fields
/// before allowing a token to be minted. It ensures data integrity and security.
/// 
/// # Arguments
/// * `openapijson_url` - URL to the OpenAPI JSON specification
/// * `not_after` - Expiration date in YYYY-MM-DD format
/// * `not_before` - Start date in YYYY-MM-DD format
/// * `max_requests` - Maximum number of requests allowed
/// * `maxrq_window` - Time window for max requests (in seconds)
/// * `webhook_url` - URL for webhook callbacks
/// * `webhook_cidr` - CIDR notation for webhook source IP restriction
/// * `allowed_cidr` - CIDR notation for allowed client IPs
/// * `allowed_iso3166list` - ISO 3166 country code list or JSON
/// * `jwt_duration` - JWT token duration in seconds
/// * `permissioned_routes` - JSON string of permissioned API routes
/// 
/// # Returns
/// * `Result<(), String>` - Ok(()) if all validations pass, Err with detailed message otherwise
/// 
/// # Security Considerations
/// - All URLs must be HTTPS
/// - Dates must be in valid ranges
/// - Numeric values must be positive integers
/// - CIDR notations must be properly formatted
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

/// Validates a single facial token ID in the strict 12-character format
/// 
/// # Arguments
/// * `facial_id` - The 12-character facial token ID to validate
/// * `token_number` - The token number for error reporting (1, 2, etc.)
/// 
/// # Returns
/// * `Result<(), String>` - Ok(()) if valid, Err with message otherwise
fn validate_single_facial_token(facial_id: &str, token_number: usize) -> Result<(), String> {
    if facial_id.len() != 12 {
        return Err(format!(
            "Facial token ID #{} validation failed: Invalid facial token ID: must be exactly 12 characters (got {})",
            token_number,
            facial_id.len()
        ));
    }
    
    // Character set validation
    const CHARSET_EVEN: &[u8] = b"bcaeug";
    const CHARSET_ODD: &[u8] = b"dfhjkmnpqrtvwxy";
    
    let bytes = facial_id.as_bytes();
    
    // Validate character positions and charsets
    for (i, &byte) in bytes.iter().enumerate() {
        if i % 2 == 0 {
            // Even positions use CHARSET_EVEN
            if !CHARSET_EVEN.contains(&byte) {
                return Err(format!(
                    "Facial token ID #{} validation failed: Invalid character at position {}: '{}' not in allowed charset for even positions",
                    token_number, i, byte as char
                ));
            }
        } else {
            // Odd positions use CHARSET_ODD
            if !CHARSET_ODD.contains(&byte) {
                return Err(format!(
                    "Facial token ID #{} validation failed: Invalid character at position {}: '{}' not in allowed charset for odd positions",
                    token_number, i, byte as char
                ));
            }
        }
    }
    
    // Validate checksum at position 11
    let checksum_byte = bytes[11];
    let mut checksum_sum: u32 = 0;
    
    for i in 0..11 {
        let byte = bytes[i];
        let charset = if i % 2 == 0 { CHARSET_EVEN } else { CHARSET_ODD };
        if let Some(index) = charset.iter().position(|&c| c == byte) {
            checksum_sum += index as u32;
        }
    }
    
    let expected_checksum_index = (checksum_sum % 15) as usize;
    if let Some(expected_byte) = CHARSET_ODD.get(expected_checksum_index) {
        if checksum_byte != *expected_byte {
            return Err(format!(
                "Facial token ID #{} validation failed: Invalid checksum: expected '{}' at position 11, got '{}'",
                token_number, *expected_byte as char, checksum_byte as char
            ));
        }
    } else {
        return Err(format!("Facial token ID #{} validation failed: Checksum validation failed: invalid index", token_number));
    }
    
    Ok(())
}

/// Validates a facial token ID in either short or full RODiT format
/// 
/// Accepts both formats:
/// - **Short format**: Just the 12-character facial token ID (e.g., "bjuveperbngn")
/// - **Full RODiT format**: Complete format with bc, sc, and one or more id fields
///   (e.g., "bc=near.org;sc=2026v1-identyclaw-com.near;id=bjuveperbngn")
///   (e.g., "bc=near.org;sc=2026v1-identyclaw-com.near;id=bjuveperbngn;id=ctedcjudgqbm")
/// 
/// # Arguments
/// * `token_id` - The token ID string in either short or full RODiT format
/// 
/// # Returns
/// * `Result<(), String>` - Ok(()) if all facial token IDs are valid, Err with message otherwise
/// 
/// # Examples
/// ```
/// // Short format (from signportal.js)
/// validate_face_token_id("bjuveperbngn").unwrap();
/// 
/// // Full RODiT format (from signroot.js)
/// validate_face_token_id("bc=near.org;sc=2026v1-identyclaw-com.near;id=bjuveperbngn").unwrap();
/// 
/// // Combined format with two tokens
/// validate_face_token_id("bc=near.org;sc=2026v1-identyclaw-com.near;id=bjuveperbngn;id=ctedcjudgqbm").unwrap();
/// ```
pub fn validate_face_token_id(token_id: &str) -> Result<(), String> {
    if token_id.is_empty() {
        return Err("Token ID cannot be empty".to_string());
    }

    // Check if it's the full RODiT format or short format
    if token_id.contains("bc=") || token_id.contains("sc=") || token_id.contains("id=") {
        // Full RODiT format: extract and validate each id= value
        let facial_ids: Vec<&str> = token_id
            .split(';')
            .filter_map(|part| {
                if part.starts_with("id=") {
                    Some(&part[3..])  // Extract the value after "id="
                } else {
                    None
                }
            })
            .collect();
        
        if facial_ids.is_empty() {
            return Err("No facial token IDs found in token_id string (expected at least one 'id=' field)".to_string());
        }
        
        // Validate each facial token ID
        for (idx, facial_id) in facial_ids.iter().enumerate() {
            validate_single_facial_token(facial_id, idx + 1)?;
        }
    } else {
        // Short format: validate directly as a single 12-character ID
        validate_single_facial_token(&token_id, 1)?;
    }
    
    Ok(())
}
