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

// Facial token_id encoding: 11 positional category indices (letters) + 1 checksum letter
// Total length: 12 characters
const FACE_TOKEN_ID_LENGTH: usize = 12;
const SKIN_TONES_VALUE_COUNT: usize = 19;
const REGIONAL_BONE_STRUCTURE_VALUE_COUNT: usize = 12;
const FACE_SHAPE_VALUE_COUNT: usize = 15;
const AGE_RELATED_VALUE_COUNT: usize = 5;
const EYES_VALUE_COUNT: usize = 10;
const EYEBROW_STYLE_VALUE_COUNT: usize = 6;
const OVERALL_STRUCTURE_VALUE_COUNT: usize = 2;
const NOSE_VALUE_COUNT: usize = 6;
const LIPS_VALUE_COUNT: usize = 5;
const SKIN_CONDITIONS_VALUE_COUNT: usize = 6;
const HAIR_COLOR_VALUE_COUNT: usize = 11;

fn face_value_char_to_index(c: char) -> Option<usize> {
    match c {
        'a'..='z' => Some((c as u8 - b'a') as usize),
        _ => None,
    }
}

fn validate_face_position(
    token_id: &str,
    pos: usize,
    max_values: usize,
    category_name: &str,
) -> Result<usize, String> {
    let bytes = token_id.as_bytes();
    let value_char = bytes[pos] as char;

    let index = face_value_char_to_index(value_char).ok_or_else(|| {
        format!(
            "Invalid value code '{}' at position {} for {} (expected 'a'-'z')",
            value_char,
            pos,
            category_name
        )
    })?;

    if index >= max_values {
        return Err(format!(
            "Value code '{}' at position {} for {} is out of range (max index {})",
            value_char,
            pos,
            category_name,
            max_values - 1
        ));
    }

    Ok(index)
}

pub fn validate_face_token_id(token_id: &str) -> Result<(), String> {
    if token_id.len() != FACE_TOKEN_ID_LENGTH {
        return Err(format!(
            "Invalid token_id length: expected {} characters, got {}",
            FACE_TOKEN_ID_LENGTH,
            token_id.len()
        ));
    }

    if !token_id.is_ascii() {
        return Err("token_id must contain only ASCII characters".to_string());
    }

    // Validate each of the 11 positional category indices (letters a-z)
    let idx_skin_tones = validate_face_position(
        token_id,
        0,
        SKIN_TONES_VALUE_COUNT,
        "skin_tones",
    )?;
    let idx_regional_bone = validate_face_position(
        token_id,
        1,
        REGIONAL_BONE_STRUCTURE_VALUE_COUNT,
        "regional_bone_structure",
    )?;
    let idx_face_shape = validate_face_position(
        token_id,
        2,
        FACE_SHAPE_VALUE_COUNT,
        "face_shape",
    )?;
    let idx_age_related = validate_face_position(
        token_id,
        3,
        AGE_RELATED_VALUE_COUNT,
        "age_related",
    )?;
    let idx_eyes = validate_face_position(
        token_id,
        4,
        EYES_VALUE_COUNT,
        "eyes",
    )?;
    let idx_eyebrow_style = validate_face_position(
        token_id,
        5,
        EYEBROW_STYLE_VALUE_COUNT,
        "eyebrow_style",
    )?;
    let idx_overall_structure = validate_face_position(
        token_id,
        6,
        OVERALL_STRUCTURE_VALUE_COUNT,
        "overall_structure",
    )?;
    let idx_nose = validate_face_position(
        token_id,
        7,
        NOSE_VALUE_COUNT,
        "nose",
    )?;
    let idx_lips = validate_face_position(
        token_id,
        8,
        LIPS_VALUE_COUNT,
        "lips",
    )?;
    let idx_skin_conditions = validate_face_position(
        token_id,
        9,
        SKIN_CONDITIONS_VALUE_COUNT,
        "skin_conditions",
    )?;
    let idx_hair_color = validate_face_position(
        token_id,
        10,
        HAIR_COLOR_VALUE_COUNT,
        "hair_color",
    )?;

    // Compute checksum as sum of all indices modulo 26
    let sum_indices: usize = idx_skin_tones
        + idx_regional_bone
        + idx_face_shape
        + idx_age_related
        + idx_eyes
        + idx_eyebrow_style
        + idx_overall_structure
        + idx_nose
        + idx_lips
        + idx_skin_conditions
        + idx_hair_color;
    let checksum_index = sum_indices % 26;
    let expected_checksum_char = (b'a' + checksum_index as u8) as char;

    let bytes = token_id.as_bytes();
    let checksum_char = bytes[11] as char;

    let _ = face_value_char_to_index(checksum_char).ok_or_else(|| {
        format!(
            "Invalid checksum character '{}' at position 11 (expected 'a'-'z')",
            checksum_char
        )
    })?;

    if checksum_char != expected_checksum_char {
        return Err(format!(
            "Invalid checksum: expected '{}' but found '{}'",
            expected_checksum_char,
            checksum_char
        ));
    }

    Ok(())
}
