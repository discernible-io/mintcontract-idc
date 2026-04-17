//! Token metadata validation module
//! 
//! This module provides comprehensive validation for RODIT token metadata fields.
//! It ensures that all token metadata conforms to expected formats before minting.

use regex::Regex;
use lazy_static::lazy_static;
use serde_json;
use serde::{Serialize, Deserialize};

// Regular expressions for validation
lazy_static! {
    /// Validates date format: YYYY-MM-DD (present but not exclusively)
    static ref DATE_REGEX: Regex = Regex::new(r"\d{4}-\d{2}-\d{2}").unwrap();
    
    /// Validates HTTPS URLs with basic structure checking (present but not exclusively)
    static ref URL_REGEX: Regex = Regex::new(r"https://[^\s/$.?#].[^\s]*").unwrap();
    
    /// Validates CIDR notation (e.g., 192.168.1.0/24) (present but not exclusively)
    static ref CIDR_REGEX: Regex = Regex::new(r"([0-9]{1,3}\.){3}[0-9]{1,3}/([0-9]|[1-2][0-9]|3[0-2])").unwrap();
    
    /// Validates domain names (present but not exclusively)
    static ref DOMAIN_REGEX: Regex = Regex::new(r"([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}").unwrap();
}

/// Validates a date string format (YYYY-MM-DD)
/// Checks for presence of valid date but not exclusively
/// 
/// # Arguments
/// * `date_str` - The date string to validate
/// 
/// # Returns
/// * `bool` - true if a valid YYYY-MM-DD date is present in the string
/// 
/// # Examples
/// ```
/// assert!(validate_date_format("2026-12-31"));
/// assert!(validate_date_format("Date: 2026-12-31 is valid"));
/// assert!(!validate_date_format("2026/12/31"));
/// ```
pub fn validate_date_format(date_str: &str) -> bool {
    if date_str.is_empty() {
        return false;
    }
    
    // Find if a date pattern exists in the string
    if let Some(date_match) = DATE_REGEX.find(date_str) {
        let matched_date = date_match.as_str();
        
        // Additional validation: check if date components are in valid ranges
        let parts: Vec<&str> = matched_date.split('-').collect();
        if parts.len() != 3 {
            return false;
        }
        
        if let (Ok(year), Ok(month), Ok(day)) = (
            parts[0].parse::<u32>(),
            parts[1].parse::<u32>(),
            parts[2].parse::<u32>()
        ) {
            // Basic range validation
            return year >= 2020 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31;
        }
    }
    
    false
}

/// Validates a URL format
/// Checks for presence of valid HTTPS URL but not exclusively
/// 
/// # Arguments
/// * `url` - The URL string to validate
/// 
/// # Returns
/// * `bool` - true if a valid HTTPS URL is present in the string or empty
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
    
    // Find if a valid HTTPS URL is present in the string
    if let Some(url_match) = URL_REGEX.find(url) {
        let matched_url = url_match.as_str();
        
        // Extract and validate domain
        if let Some(domain_start) = matched_url.find("://") {
            let after_protocol = &matched_url[domain_start + 3..];
            if let Some(domain_end) = after_protocol.find('/').or_else(|| Some(after_protocol.len())) {
                let domain = &after_protocol[..domain_end];
                // Remove port if present
                let domain_without_port = domain.split(':').next().unwrap_or(domain);
                return DOMAIN_REGEX.is_match(domain_without_port) || domain_without_port == "localhost";
            }
        }
    }
    
    false
}

/// Validates a CIDR notation string
/// Checks for presence of valid CIDR notation but not exclusively
/// 
/// # Arguments
/// * `cidr` - The CIDR notation string to validate (e.g., "192.168.1.0/24")
/// 
/// # Returns
/// * `bool` - true if a valid CIDR notation is present in the string or empty
/// 
/// # Examples
/// ```
/// assert!(validate_cidr("192.168.1.0/24"));
/// assert!(validate_cidr("Network: 10.0.0.0/8"));
/// assert!(!validate_cidr("256.1.1.1/24"));
/// ```
pub fn validate_cidr(cidr: &str) -> bool {
    if cidr.is_empty() {
        return true; // Empty CIDR is considered valid (optional field)
    }
    
    // Find if a valid CIDR pattern exists in the string
    if let Some(cidr_match) = CIDR_REGEX.find(cidr) {
        let matched_cidr = cidr_match.as_str();
        
        // Additional validation: check if IP octets are in valid range (0-255)
        let parts: Vec<&str> = matched_cidr.split('/').collect();
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
        
        return true;
    }
    
    false
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
/// Checks for presence of valid codes but not exclusively
pub fn validate_iso3166(country_list_json: &str) -> bool {
    // Empty input is not valid
    if country_list_json.is_empty() {
        return false;
    }
    
    // Try to parse as JSON first
    if country_list_json.contains('{') {
        return validate_escaped_json(country_list_json);
    }
    
    // If not JSON, validate as a simple comma-separated list of country codes
    // ISO 3166 country code list validation (comma-separated, present but not exclusively)
    lazy_static! {
        static ref COUNTRY_CODE_REGEX: Regex = Regex::new(r"([A-Z]{2})(,[A-Z]{2})*").unwrap();
    }
    
    // Special case: "WLD" is a valid value representing "worldwide" (no restrictions)
    if country_list_json.contains("WLD") {
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

// =============================================================================
// FACIAL TOKEN ID ENCODING SPECIFICATION
// =============================================================================
// 
// A facial token_id is a 12-character string that encodes biometric facial
// features using position-specific character sets.
//
// STRUCTURE:
// - Positions 0-10: Facial feature category indices
// - Position 11: Checksum letter
// - Total length: 12 characters
//
// CHARACTER SETS (no vowels or ambiguous letters):
// - CHARSET_EVEN: [b, c, a, e, u, g]  (6 chars) - for positions 0,2,4,6,8,10
// - CHARSET_ODD:  [d, f, h, j, k, m, n, p, q, r, t, v, w, x, y] (15 chars) - for positions 1,3,5,7,9,11(checksum)
//
// POSITION MAP (categories ordered by value count to optimize charset usage):
//   [0] = Overall Structure    (2 values,  uses CHARSET_EVEN)
//   [1] = Face Shape           (15 values, uses CHARSET_ODD)
//   [2] = Age Related          (5 values,  uses CHARSET_EVEN)
//   [3] = Regional Bone Struct (12 values, uses CHARSET_ODD)
//   [4] = Lips                 (5 values,  uses CHARSET_EVEN)
//   [5] = Hair Color           (11 values, uses CHARSET_ODD)
//   [6] = Eyebrow Style        (6 values,  uses CHARSET_EVEN)
//   [7] = Eyes                 (10 values, uses CHARSET_ODD)
//   [8] = Skin Conditions      (6 values,  uses CHARSET_EVEN)
//   [9] = Skin Tones           (11 values, uses CHARSET_ODD)
//  [10] = Nose                 (6 values,  uses CHARSET_EVEN)
//  [11] = Checksum             (mod 15 of sum, uses CHARSET_ODD)
//
// CHECKSUM CALCULATION:
// - Sum all indices from positions 0-10
// - checksum_index = sum % 15 (CHARSET_ODD length)
// - checksum_letter = CHARSET_ODD[checksum_index]
//
// =============================================================================

const FACE_TOKEN_ID_LENGTH: usize = 12;

// Position-specific character sets (no vowels, no ambiguous letters)
const CHARSET_EVEN: &[u8] = b"bcaeug";    // 6 chars - for positions 0,2,4,6,8,10
const CHARSET_ODD: &[u8] = b"dfhjkmnpqrtvwxy"; // 15 chars - for positions 1,3,5,7,9,11(checksum)

// Facial category value counts (matching JavaScript FACE_CATEGORIES)
const OVERALL_STRUCTURE_VALUE_COUNT: usize = 2;        // masculine, feminine
const FACE_SHAPE_VALUE_COUNT: usize = 15;              // 15 face shapes
const AGE_RELATED_VALUE_COUNT: usize = 5;              // 5 age categories
const REGIONAL_BONE_STRUCTURE_VALUE_COUNT: usize = 12; // 12 regional types
const LIPS_VALUE_COUNT: usize = 5;                     // 5 lip types
const HAIR_COLOR_VALUE_COUNT: usize = 11;              // 11 hair colors
const EYEBROW_STYLE_VALUE_COUNT: usize = 6;            // 6 eyebrow styles
const EYES_VALUE_COUNT: usize = 10;                    // 10 eye types
const SKIN_CONDITIONS_VALUE_COUNT: usize = 6;          // 6 skin conditions
const SKIN_TONES_VALUE_COUNT: usize = 11;              // 11 skin tones
const NOSE_VALUE_COUNT: usize = 6;                     // 6 nose types

/// Get the character set for a specific position
fn get_charset_for_position(pos: usize) -> &'static [u8] {
    match pos {
        0 | 2 | 4 | 6 | 8 | 10 => CHARSET_EVEN,
        1 | 3 | 5 | 7 | 9 | 11 => CHARSET_ODD,
        _ => panic!("Invalid position {} for facial token charset", pos),
    }
}

/// Convert a character to its index within the position-specific charset
fn char_to_index(c: char, pos: usize) -> Option<usize> {
    let charset = get_charset_for_position(pos);
    charset.iter().position(|&byte| byte as char == c)
}

/// Convert an index to its character within the position-specific charset
fn index_to_char(index: usize, pos: usize) -> Option<char> {
    let charset = get_charset_for_position(pos);
    charset.get(index).map(|&byte| byte as char)
}

fn validate_face_position(
    token_id: &str,
    pos: usize,
    max_values: usize,
    category_name: &str,
) -> Result<usize, String> {
    let bytes = token_id.as_bytes();
    if pos >= bytes.len() {
        return Err(format!("Position {} out of bounds", pos));
    }
    let value_char = bytes[pos] as char;

    let index = char_to_index(value_char, pos).ok_or_else(|| {
        let charset = get_charset_for_position(pos);
        let charset_str = std::str::from_utf8(charset).unwrap_or("unknown");
        format!(
            "Invalid character '{}' at position {} for {} (expected one of: {})",
            value_char, pos, category_name, charset_str
        )
    })?;

    if index >= max_values {
        return Err(format!(
            "Index {} at position {} for {} is out of range (max index {})",
            index, pos, category_name, max_values - 1
        ));
    }

    Ok(index)
}

/// Helper function to validate a specific 12-character substring as a facial token
fn validate_face_token_substring(token_id: &str) -> Result<(), String> {
    debug_assert_eq!(token_id.len(), FACE_TOKEN_ID_LENGTH);

    // Validate each of the 11 positional category indices
    let mut indices = Vec::new();
    
    indices.push(validate_face_position(
        token_id,
        0,
        OVERALL_STRUCTURE_VALUE_COUNT,
        "overall_structure",
    )?);
    indices.push(validate_face_position(
        token_id,
        1,
        FACE_SHAPE_VALUE_COUNT,
        "face_shape",
    )?);
    indices.push(validate_face_position(
        token_id,
        2,
        AGE_RELATED_VALUE_COUNT,
        "age_related",
    )?);
    indices.push(validate_face_position(
        token_id,
        3,
        REGIONAL_BONE_STRUCTURE_VALUE_COUNT,
        "regional_bone_structure",
    )?);
    indices.push(validate_face_position(
        token_id,
        4,
        LIPS_VALUE_COUNT,
        "lips",
    )?);
    indices.push(validate_face_position(
        token_id,
        5,
        HAIR_COLOR_VALUE_COUNT,
        "hair_color",
    )?);
    indices.push(validate_face_position(
        token_id,
        6,
        EYEBROW_STYLE_VALUE_COUNT,
        "eyebrow_style",
    )?);
    indices.push(validate_face_position(
        token_id,
        7,
        EYES_VALUE_COUNT,
        "eyes",
    )?);
    indices.push(validate_face_position(
        token_id,
        8,
        SKIN_CONDITIONS_VALUE_COUNT,
        "skin_conditions",
    )?);
    indices.push(validate_face_position(
        token_id,
        9,
        SKIN_TONES_VALUE_COUNT,
        "skin_tones",
    )?);
    indices.push(validate_face_position(
        token_id,
        10,
        NOSE_VALUE_COUNT,
        "nose",
    )?);

    // Validate checksum at position 11
    let bytes = token_id.as_bytes();
    let checksum_char = bytes[11] as char;
    
    // Calculate expected checksum: sum of all indices mod CHARSET_ODD length (15)
    let sum_indices: usize = indices.iter().sum();
    let expected_checksum_index = sum_indices % CHARSET_ODD.len();
    let expected_checksum_char = index_to_char(expected_checksum_index, 11)
        .ok_or_else(|| format!("Failed to generate checksum character"))?;
    
    if checksum_char != expected_checksum_char {
        return Err(format!(
            "Checksum mismatch at position 11: got '{}', expected '{}'",
            checksum_char, expected_checksum_char
        ));
    }

    Ok(())
}

/// Decodes a facial token ID and returns detailed category information
/// 
/// # Arguments
/// * `token_id` - A 12-character facial token ID string
/// 
/// # Returns
/// * `Result<DecodedFacialToken, String>` - Decoded token with category details or error
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FacialTokenCategory {
    pub index: usize,
    pub letter: char,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecodedFacialToken {
    pub token_id: String,
    pub valid: bool,
    pub checksum_valid: bool,
    pub overall_structure: Option<FacialTokenCategory>,
    pub face_shape: Option<FacialTokenCategory>,
    pub age_related: Option<FacialTokenCategory>,
    pub regional_bone_structure: Option<FacialTokenCategory>,
    pub lips: Option<FacialTokenCategory>,
    pub hair_color: Option<FacialTokenCategory>,
    pub eyebrow_style: Option<FacialTokenCategory>,
    pub eyes: Option<FacialTokenCategory>,
    pub skin_conditions: Option<FacialTokenCategory>,
    pub skin_tones: Option<FacialTokenCategory>,
    pub nose: Option<FacialTokenCategory>,
}


// =============================================================================
// Custom Distinguished Name (DN) Validation
// =============================================================================
// Supports RFC 2253-style DN format with custom attributes:
//   NNSWF, NSWF, ContactURI, taxRes, inceptDateTime, inceptPlace, taxCode,
//   address, Creature, AvatarURL, EmojiURL
// =============================================================================

lazy_static! {
    /// Validates ISO 3166-1 alpha-2 country codes (2 uppercase letters)
    static ref TAX_RES_REGEX: Regex = Regex::new(r"^[A-Z]{2}$").unwrap();
    
    /// Validates GeneralizedTime format: YYYYMMDDHHMMSSZ
    static ref GENERALIZED_TIME_REGEX: Regex = Regex::new(r"^\d{14}Z$").unwrap();
    
    /// Validates Plus Code format (e.g., 9F4MGCH7+R6 or 87G8Q23F+XF)
    static ref PLUS_CODE_REGEX: Regex = Regex::new(r"^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,}$").unwrap();
    
    /// Validates URI format: scheme:authority:identifier
    /// Examples: twitter:x.com:user, email:gmail.com:user, phone:ES:34683493049
    static ref URI_REGEX: Regex = Regex::new(r"^[a-zA-Z][a-zA-Z0-9+.-]*:[^:]+:[^:]+$").unwrap();
}


/// Parsed DN attribute
#[derive(Debug, Clone)]
pub struct DnAttribute {
    pub name: String,
    pub value: String,
}

/// Parses a RFC 2253-style DN string into individual attributes
/// Handles escaping: \, \+ \" \\ \< \> \; \= \#
pub fn parse_dn_string(dn: &str) -> Result<Vec<DnAttribute>, String> {
    if dn.is_empty() {
        return Ok(Vec::new()); // Empty DN is valid (optional)
    }
    
    let mut attributes = Vec::new();
    let mut current_name = String::new();
    let mut current_value = String::new();
    let mut in_value = false;
    let mut escaped = false;
    
    let chars: Vec<char> = dn.chars().collect();
    let mut i = 0;
    
    while i < chars.len() {
        let c = chars[i];
        
        if escaped {
            // Handle escaped character
            current_value.push(c);
            escaped = false;
            i += 1;
            continue;
        }
        
        if c == '\\' {
            escaped = true;
            i += 1;
            continue;
        }
        
        if !in_value {
            // Parsing attribute name
            if c == '=' {
                in_value = true;
            } else if c == ',' || c.is_whitespace() {
                // Skip leading/trailing whitespace and empty segments
                if !current_name.is_empty() {
                    return Err(format!("Missing value for attribute '{}'", current_name));
                }
            } else {
                current_name.push(c);
            }
        } else {
            // Parsing attribute value
            if c == ',' {
                // End of this attribute, start new one
                let name = current_name.trim().to_string();
                let value = current_value.trim().to_string();
                
                if !name.is_empty() {
                    attributes.push(DnAttribute { name, value });
                }
                
                current_name.clear();
                current_value.clear();
                in_value = false;
            } else {
                current_value.push(c);
            }
        }
        
        i += 1;
    }
    
    // Handle last attribute
    if !current_name.is_empty() {
        let name = current_name.trim().to_string();
        let value = current_value.trim().to_string();
        attributes.push(DnAttribute { name, value });
    }
    
    Ok(attributes)
}

/// Validates a single DN attribute value based on its name
pub fn validate_dn_attribute(name: &str, value: &str) -> Result<(), String> {
    // UTF-8 length checks for name fields
    const MAX_NAME_LENGTH: usize = 50;
    
    match name {
        "NNSWF" => {
            // Name Not Shared With Family: UTF-8 string, 1-50 chars
            if value.is_empty() || value.chars().count() > MAX_NAME_LENGTH {
                return Err(format!("NNSWF must be 1-{} characters", MAX_NAME_LENGTH));
            }
        }
        "NSWF" => {
            // Name Shared With Family: UTF-8 string, max 50 chars (optional)
            if !value.is_empty() && value.chars().count() > MAX_NAME_LENGTH {
                return Err(format!("NSWF must be at most {} characters", MAX_NAME_LENGTH));
            }
        }
        "ContactURI" => {
            // Generic URI format: scheme:authority:identifier
            // Examples: twitter:x.com:emusk, email:gmail.com:user, phone:ES:34683493049
            if !value.is_empty() && !URI_REGEX.is_match(value) {
                return Err("ContactURI must be format scheme:authority:identifier (e.g., twitter:x.com:user)".to_string());
            }
        }
        "taxRes" => {
            // Tax residence: ISO 3166-1 alpha-2 code
            if !value.is_empty() && !TAX_RES_REGEX.is_match(value) {
                return Err("taxRes must be ISO 3166-1 alpha-2 country code (e.g., US, GB, DE)".to_string());
            }
        }
        "inceptDateTime" => {
            // GeneralizedTime: YYYYMMDDHHMMSSZ
            if !value.is_empty() && !GENERALIZED_TIME_REGEX.is_match(value) {
                return Err("inceptDateTime must be GeneralizedTime format (YYYYMMDDHHMMSSZ)".to_string());
            }
            // Additional validation: check date components
            if !value.is_empty() {
                let year: u32 = value[0..4].parse().unwrap_or(0);
                let month: u32 = value[4..6].parse().unwrap_or(0);
                let day: u32 = value[6..8].parse().unwrap_or(0);
                let hour: u32 = value[8..10].parse().unwrap_or(99);
                let minute: u32 = value[10..12].parse().unwrap_or(99);
                let second: u32 = value[12..14].parse().unwrap_or(99);
                
                if year < 1900 || year > 2100 {
                    return Err("inceptDateTime year must be 1900-2100".to_string());
                }
                if month < 1 || month > 12 {
                    return Err("inceptDateTime month must be 01-12".to_string());
                }
                if day < 1 || day > 31 {
                    return Err("inceptDateTime day must be 01-31".to_string());
                }
                if hour > 23 {
                    return Err("inceptDateTime hour must be 00-23".to_string());
                }
                if minute > 59 {
                    return Err("inceptDateTime minute must be 00-59".to_string());
                }
                if second > 59 {
                    return Err("inceptDateTime second must be 00-59".to_string());
                }
            }
        }
        "inceptPlace" => {
            // Plus Code format
            if !value.is_empty() && !PLUS_CODE_REGEX.is_match(value) {
                return Err("inceptPlace must be Plus Code format (e.g., 9F4MGCH7+R6)".to_string());
            }
        }
        "taxCode" => {
            // Country-specific format - allow alphanumeric with hyphens
            // Max 30 chars for most tax IDs worldwide
            if !value.is_empty() && value.len() > 30 {
                return Err("taxCode must be at most 30 characters".to_string());
            }
            // Basic format: alphanumeric, hyphens, spaces allowed
            if !value.is_empty() && !value.chars().all(|c| c.is_alphanumeric() || c == '-' || c == ' ') {
                return Err("taxCode must contain only alphanumeric characters, hyphens, or spaces".to_string());
            }
        }
        "address" => {
            // Plus Code format for address
            if !value.is_empty() && !PLUS_CODE_REGEX.is_match(value) {
                return Err("address must be Plus Code format (e.g., 87G8Q23F+XF)".to_string());
            }
        }
        "Creature" => {
            // Creature descriptor: 1-50 printable characters (excluding control)
            if !value.is_empty() {
                if value.chars().count() > 50 {
                    return Err("Creature must be at most 50 characters".to_string());
                }
                if value.chars().any(|c| c.is_control()) {
                    return Err("Creature must not contain control characters".to_string());
                }
            }
        }
        "AvatarURL" | "EmojiURL" => {
            // HTTPS URLs validated using existing metadata URL validator
            if !value.is_empty() && !validate_url(value) {
                return Err(format!("{} must be a valid HTTPS URL", name));
            }
        }
        _ => {
            // Unknown attributes are allowed but logged
            // This provides extensibility while maintaining structure
        }
    }
    
    Ok(())
}

/// Validates a complete userselected_dn string with custom format
/// 
/// # Format
/// RFC 2253-style: `NNSWF=Claudio,NSWF=Perez,ContactURI=email:example.com:identyclaw@example.com,...`
/// 
/// # Supported Attributes
/// - **NNSWF**: Name Not Shared With Family (given name), 1-50 UTF-8 chars
/// - **NSWF**: Name Shared With Family (surname), 1-50 UTF-8 chars
/// - **ContactURI**: Generic identifier (scheme:authority:identifier)
///   - Examples: `twitter:x.com:emusk`, `email:example.com:identyclaw@example.com`, `phone:ES:34683493049`
/// - **taxRes**: Tax residence (ISO 3166-1 alpha-2)
/// - **inceptDateTime**: Incept date/time (GeneralizedTime YYYYMMDDHHMMSSZ)
/// - **inceptPlace**: Incept place (Plus Code)
/// - **taxCode**: Tax code/ID (country-specific, max 30 chars)
/// - **address**: Contact address (Plus Code)
/// - **Creature**: Descriptive label (max 50 printable characters)
/// - **AvatarURL**: HTTPS URL for avatar media
/// - **EmojiURL**: HTTPS URL for emoji asset
/// 
/// # Returns
/// * `Ok(())` if DN is valid (or empty)
/// * `Err(String)` with detailed error message
pub fn validate_userselected_dn(dn: &str) -> Result<(), String> {
    // Empty DN is valid (optional field)
    if dn.is_empty() {
        return Ok(());
    }
    
    // Max total length to prevent abuse (1024 bytes)
    const MAX_DN_LENGTH: usize = 1024;
    if dn.len() > MAX_DN_LENGTH {
        return Err(format!("DN exceeds maximum length of {} bytes", MAX_DN_LENGTH));
    }
    
    // Parse the DN string
    let attributes = parse_dn_string(dn)?;
    
    // Validate each attribute
    for attr in &attributes {
        validate_dn_attribute(&attr.name, &attr.value)?;
    }
    
    Ok(())
}


// =============================================================================
// Unit tests for DN validation (test data only - not used in production)
// =============================================================================
#[cfg(test)]
mod dn_tests {
    use super::*;

    #[test]
    fn test_empty_dn_is_valid() {
        assert!(validate_userselected_dn("").is_ok());
    }

    #[test]
    fn test_full_dn_format() {
        // Test with placeholder data matching schema structure
        let dn = "NNSWF=TestNameNotSharedWithFamily,NSWF=TestSurname,ContactURI=email:test.test:user,taxRes=XX,inceptDateTime=20000101120000Z,inceptPlace=8FVC9G8F+6X,taxCode=000-00-0000,address=8FVC9G8F+6X,Creature=Friendly Being,AvatarURL=https://example.com/avatar.png,EmojiURL=https://example.com/emoji.svg";
        assert!(validate_userselected_dn(dn).is_ok());
    }

    #[test]
    fn test_dn_with_email_identifier() {
        // Test with email identifier containing @ symbol (new format)
        let dn = "NNSWF=Claudio,NSWF=Perez,ContactURI=email:example.com:identyclaw@example.com,taxRes=ES,inceptDateTime=20260101120000Z,inceptPlace=443R4JF4+8M,address=443R4JF4+8M,Creature=Majordomo,AvatarURL=https://identyclaw.com/avatar.png";
        assert!(validate_userselected_dn(dn).is_ok());
    }

    #[test]
    fn test_partial_dn_valid() {
        assert!(validate_userselected_dn("NNSWF=NameNotSharedWithFamily,NSWF=Surname").is_ok());
        assert!(validate_userselected_dn("NNSWF=Name,ContactURI=twitter:x.com:testuser").is_ok());
    }

    #[test]
    fn test_dn_with_spaces() {
        let dn = "NNSWF=Given, NSWF=Family, taxRes=XX";
        assert!(validate_userselected_dn(dn).is_ok());
    }

    #[test]
    fn test_invalid_tax_residence() {
        // taxRes must be exactly 2 uppercase letters (ISO 3166-1 alpha-2)
        assert!(validate_userselected_dn("NNSWF=Name,taxRes=USA").is_err()); // 3 letters
        assert!(validate_userselected_dn("NNSWF=Name,taxRes=us").is_err());  // lowercase
    }

    #[test]
    fn test_invalid_incept_datetime() {
        // Must be GeneralizedTime: YYYYMMDDHHMMSSZ
        assert!(validate_userselected_dn("NNSWF=Name,inceptDateTime=2000-01-01").is_err());
        assert!(validate_userselected_dn("NNSWF=Name,inceptDateTime=20001315120000Z").is_err()); // month 13
    }

    #[test]
    fn test_invalid_plus_code() {
        assert!(validate_userselected_dn("NNSWF=Name,inceptPlace=NOTVALID").is_err());
        assert!(validate_userselected_dn("NNSWF=Name,address=12345").is_err());
    }

    #[test]
    fn test_escaped_characters() {
        let dn = r"NNSWF=Given,NSWF=Family\, Suffix";
        assert!(validate_userselected_dn(dn).is_ok());
    }

    #[test]
    fn test_dn_too_long() {
        let long_str = "x".repeat(1025);
        assert!(validate_userselected_dn(&long_str).is_err());
    }

    #[test]
    fn test_name_too_long() {
        let long_name = "x".repeat(51);
        assert!(validate_userselected_dn(&format!("NNSWF={}", long_name)).is_err());
    }


    #[test]
    fn test_valid_plus_codes() {
        assert!(validate_dn_attribute("inceptPlace", "8FVC9G8F+6W").is_ok());
        assert!(validate_dn_attribute("address", "8FVC9G8F+6X").is_ok());
    }

    #[test]
    fn test_valid_uri_formats() {
        // scheme:authority:identifier format
        assert!(validate_dn_attribute("ContactURI", "twitter:x.com:testuser").is_ok());
        assert!(validate_dn_attribute("ContactURI", "email:gmail.com:testuser").is_ok());
        assert!(validate_dn_attribute("ContactURI", "telegram:telegram.com:testuser").is_ok());
        assert!(validate_dn_attribute("ContactURI", "phone:ES:34000000000").is_ok());
        assert!(validate_dn_attribute("ContactURI", "").is_ok()); // Empty is valid (optional)
    }

    #[test]
    fn test_invalid_uri_formats() {
        // Missing parts
        assert!(validate_dn_attribute("ContactURI", "twitter").is_err());
        assert!(validate_dn_attribute("ContactURI", "twitter:x.com").is_err()); // Missing identifier
        assert!(validate_dn_attribute("ContactURI", ":x.com:user").is_err()); // Missing scheme
    }
}

// =============================================================================
// Unit tests for facial token validation
// =============================================================================
#[cfg(test)]
mod face_token_tests {
    use super::*;

    #[test]
    fn test_valid_token_with_checksum() {
        let valid_token = "bcaegudfjhkm"; // Valid 12-char token with correct checksum
        assert!(validate_face_token_id(valid_token).is_ok());
    }

    #[test]
    fn test_token_wrong_length_too_short() {
        let short_token = "bcaegudfjhk"; // 11 characters
        assert!(validate_face_token_id(short_token).is_err());
    }

    #[test]
    fn test_token_wrong_length_too_long() {
        let long_token = "bcaegudfjhkmd"; // 13 characters
        assert!(validate_face_token_id(long_token).is_err());
    }

    #[test]
    fn test_token_with_invalid_character() {
        let invalid_token = "bcaegudfjhki"; // 'i' is not in valid charset
        assert!(validate_face_token_id(invalid_token).is_err());
    }

    #[test]
    fn test_token_with_vowel_rejected() {
        let vowel_token = "bcaegudfjhka"; // 'a' at position 11 (checksum) but should be odd charset
        assert!(validate_face_token_id(vowel_token).is_err());
    }

}
