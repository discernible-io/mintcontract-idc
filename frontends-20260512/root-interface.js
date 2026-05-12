import { utils } from "near-api-js";
import {
  RoditAuthService,
  verifyRoditPairBeforeMinting,
  validateAndSetUrl,
  validateAndSetDate,
  validateAndSetJson,
  validateAndSetSignature,
  base64ToBase64Url,
  calculateCanonicalHash,
  canonicalizeObject,
  bufferUtils
} from '@rodit/rodit-auth-fe';
import { logger, createLogContext } from "./services/logger.js";

const bs58 = require("bs58");
const nacl = require("tweetnacl");
const { decodeUTF8 } = require("tweetnacl-util");

// Helper function to get today's date in YYYY-MM-DD format
// This mirrors the logic used in StepOne component but keeps near-interface self-contained.
const todayDate = () => {
  const date = new Date();
  const currentDate = date.getDate();
  const currentMonth = date.getMonth() + 1; // Months are 0-indexed
  const currentYear = date.getFullYear();
  return (
    currentYear +
    "-" +
    (currentMonth < 10 ? "0" + currentMonth : currentMonth) +
    "-" +
    (currentDate < 10 ? "0" + currentDate : currentDate)
  );
};

const HUNDRED_AND_FIFTY_TGAS = "150000000000000"; // Increased to 150 TGas to handle signature verification and metadata processing

/**
 * Verify fee signatures before minting
 * @param {string} portalFeeDataJson - Portal fee data as a JSON string
 * @param {string} sanctumFeeDataJson - Sanctum fee data as a JSON string
 * @param {string} portalFeeSignatureBase64url - Portal fee signature in base64url format
 * @param {string} sanctumFeeSignatureBase64url - Sanctum fee signature in base64url format
 * @param {Uint8Array} sanctumPublicKey - Sanctum public key (used to verify Portal fee signature)
 * @param {Uint8Array} portalPublicKey - Portal public key (used to verify Sanctum fee signature)
 * @returns {Object} - Result object with success flag and error message if applicable
 */
export function verifyFeePairBeforeMinting(
  portalFeeDataJson,
  sanctumFeeDataJson,
  portalFeeSignatureBase64url,
  sanctumFeeSignatureBase64url,
  portalPublicKey,
  sanctumPublicKey
) {
  try {
    // Parse the JSON strings to validate them
    let portalFeeData, sanctumFeeData;
    try {
      portalFeeData = JSON.parse(portalFeeDataJson);
      sanctumFeeData = JSON.parse(sanctumFeeDataJson);
    } catch (e) {
      logger.error("Failed to parse fee data JSON", {
        component: "verifyFeePairBeforeMinting",
        error: e.message,
        stack: e.stack
      });
      return { success: false, error: `Invalid fee data JSON: ${e.message}` };
    }
    
    const requestId = Math.random().toString(36).substring(2, 15);
    const baseContext = createLogContext("verifyFeePairBeforeMinting", "verify", { requestId });
    
    logger.debug("Starting fee pair verification process", baseContext);
    logger.debug("Received fee data and signatures", {
      ...baseContext,
      portalFeeDataJson: portalFeeDataJson?.substring(0, 50) + "...",
      sanctumFeeDataJson: sanctumFeeDataJson?.substring(0, 50) + "...",
      portalFeeSignatureBase64url: portalFeeSignatureBase64url?.substring(0, 20) + "...",
      sanctumFeeSignatureBase64url: sanctumFeeSignatureBase64url?.substring(0, 20) + "...",
      sanctumPublicKeyLength: sanctumPublicKey?.length,
      portalPublicKeyLength: portalPublicKey?.length,
    });
    
    logger.debug("Parsed fee data objects", {
      ...baseContext,
      portalFeeData,
      sanctumFeeData
    });
    
    // Validate inputs - match contract's validation pattern
    logger.debug("Validating input parameters", baseContext);
    if (!portalFeeDataJson || !sanctumFeeDataJson) {
      logger.error("Missing fee data JSON", baseContext);
      return { success: false, error: "Missing fee data JSON" };
    }
    
    if (!portalFeeSignatureBase64url || !sanctumFeeSignatureBase64url) {
      logger.error("Missing fee signatures", baseContext);
      return { success: false, error: "Missing fee signatures" };
    }
    
    if (!sanctumPublicKey || !portalPublicKey) {
      logger.error("Missing signer public keys", baseContext);
      return { success: false, error: "Missing signer public keys" };
    }
    
    // ===== SANCTUM FEE VERIFICATION =====
    logger.debug("Starting Sanctum fee verification", baseContext);
    
    // Step 1: Use the JSON string directly (it's already canonicalized)
    logger.debug("Starting JSON parsing and canonicalization for Sanctum fee", baseContext);
   
    // We're using the JSON string directly as it's already canonicalized when sent to the contract
    logger.debug("Raw message", { ...baseContext, sanctumFeeDataJson });
    
    // Step 2: Calculate hash using SHA-512 (nacl.hash uses SHA-512)
    logger.debug("Calculating SHA-512 hash for Sanctum fee", baseContext);
    const sanctumCanonicalMessageBytes = decodeUTF8(sanctumFeeDataJson);
    const sanctumHashUint8 = nacl.hash(sanctumCanonicalMessageBytes);
    
    // Convert hash to hex for logging (matching contract's logging pattern)
    const sanctumHashHex = Array.from(sanctumHashUint8)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    logger.debug("Hash calculation complete", {
      ...baseContext,
      hashLength: sanctumHashUint8.length,
      hashHex: sanctumHashHex
    });
    
    // Step 3: Convert base64url signature to bytes
    logger.debug("Converting Sanctum signature from base64url", baseContext);
    const sanctumFeeSignatureBytes = bufferUtils.base64urlToUint8Array(sanctumFeeSignatureBase64url);
    logger.debug("Signature conversion complete", {
      ...baseContext,
      signatureBytesLength: sanctumFeeSignatureBytes.length,
      firstBytes: Array.from(sanctumFeeSignatureBytes.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' ')
    });
    
    // Step 4: Verify signature
    logger.debug("Attempting verification with Portal public key", {
      ...baseContext,
      publicKeyFingerprint: Array.from(portalPublicKey.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ')
    });
    
    let sanctumFeeValid;
    try {
      sanctumFeeValid = nacl.sign.detached.verify(
        sanctumHashUint8,
        sanctumFeeSignatureBytes,
        portalPublicKey  // Use Portal's public key to verify Sanctum fee signature
      );
      
      if (sanctumFeeValid) {
        logger.info("Sanctum fee signature verified successfully", baseContext);
      } else {
        logger.error("Sanctum fee signature verification failed", baseContext);
      }
    } catch (verifyError) {
      logger.error("Sanctum fee verification threw an error", {
        ...baseContext,
        error: verifyError.message,
        stack: verifyError.stack
      });
      sanctumFeeValid = false;
    }
    
    // Early return if Sanctum verification fails - ensure one rodit is fully verified before proceeding
    if (!sanctumFeeValid) {
      return {
        success: false,
        error: "Sanctum fee signature verification failed", // Sanctum fee is verified with Portal public key
        sanctumFeeValid,
        portalFeeValid: false // Not verified yet
      };
    }
    
    // ===== PORTAL FEE VERIFICATION =====
    // Only proceed to Portal verification if Sanctum verification was successful
    logger.debug("Starting Portal fee verification", baseContext);
    
    // Step 1: Use the JSON string directly (it's already canonicalized)
    logger.debug("Starting JSON parsing and canonicalization for Portal fee", baseContext);
    // We're using the JSON string directly as it's already canonicalized when sent to the contract
    logger.debug("Raw message", { ...baseContext, portalFeeDataJson });
    
    // Step 2: Calculate hash using SHA-512 (nacl.hash uses SHA-512)
    logger.debug("Calculating SHA-512 hash for Portal fee", baseContext);
    const portalCanonicalMessageBytes = decodeUTF8(portalFeeDataJson);
    const portalHashUint8 = nacl.hash(portalCanonicalMessageBytes);
    
    // Convert hash to hex for logging (matching contract's logging pattern)
    const portalHashHex = Array.from(portalHashUint8)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    logger.debug("Portal hash calculation complete", {
      ...baseContext,
      hashLength: portalHashUint8.length,
      hashHex: portalHashHex
    });
    
    // Step 3: Convert base64url signature to bytes
    logger.debug("Converting Portal signature from base64url", baseContext);
    const portalFeeSignatureBytes = bufferUtils.base64urlToUint8Array(portalFeeSignatureBase64url);
    logger.debug("Portal signature conversion complete", {
      ...baseContext,
      signatureBytesLength: portalFeeSignatureBytes.length,
      firstBytes: Array.from(portalFeeSignatureBytes.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' ')
    });
    
    // Step 4: Verify signature
    logger.debug("Attempting verification with Sanctum public key", {
      ...baseContext,
      publicKeyFingerprint: Array.from(sanctumPublicKey.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ')
    });
    
    let portalFeeValid;
    try {
      portalFeeValid = nacl.sign.detached.verify(
        portalHashUint8,
        portalFeeSignatureBytes,
        sanctumPublicKey  // Use Sanctum public key for Portal verification
      );
      
      if (portalFeeValid) {
        logger.info("Portal fee signature verified successfully", baseContext);
      } else {
        logger.error("Portal fee signature verification failed", baseContext);
      }
    } catch (verifyError) {
      logger.error("Portal verification threw an error", {
        ...baseContext,
        error: verifyError.message,
        stack: verifyError.stack
      });
      portalFeeValid = false;
    }
    
    // Final verification result
    logger.info("Fee signature verification results", {
      ...baseContext,
      sanctumFeeValid,
      portalFeeValid
    });
    
    if (!portalFeeValid) {
      return {
        success: false,
        error: "Portal fee signature verification failed", // Portal fee is verified with Sanctum public key
        sanctumFeeValid, // Already verified as true
        portalFeeValid,
      };
    }
    
    logger.info("Signature verification successful", baseContext);
    return { success: true };
  } catch (error) {
    logger.error("Fee verification error", {
      component: "verifyFeePairBeforeMinting",
      error: error.message,
      stack: error.stack
    });
    return { success: false, error: error.message };
  }
}
export class Contract {
  constructor({ contractId, walletToUse }) {
    this.contractId = contractId;
    this.wallet = walletToUse;
  }

  async listrodits() {
    return this.wallet.viewMethod({
      contractId: this.contractId,
      method: "rodit_tokens",
    });
  }

  async buildpairofrodits(
    openapijsonurl,
    subjectuniqueidentifierurl,
    SanctumBase58PrivateKey,
    SanctumOwnerAccountId
  ) {
    const providerSelectedValues = {
      scaccountid: process.env.REACT_APP_NEAR_CONTRACT_ID,
      mintingfeeaccount: process.env.REACT_APP_MINTING_FEEACCOUNT,
      mintingfee: process.env.REACT_APP_MINTING_FEE,
      signapiendpoint: process.env.REACT_APP_SIGNAPIENDPOINT,
    };

    const defaultValues = {
      notafter: process.env.REACT_APP_NOTAFTER,
      maxrequests: process.env.REACT_APP_MAXREQUESTS,
      maxrqwindow: process.env.REACT_APP_MAXRQWINDOW,
      webhookurl: process.env.REACT_APP_WEBHOOKURL,
      userselecteddn: process.env.REACT_APP_USERSELECTEDDN,
      webhookcidr: process.env.REACT_APP_WEBHOOKCIDR,
      allowedcidr: process.env.REACT_APP_ALLOWEDCIDR,
      allowediso3166list: process.env.REACT_APP_ALLOWEDISO3166LIST,
      jwtduration: process.env.REACT_APP_JWTDURATION,
      permissionedroutes: process.env.REACT_APP_PERMISSIONEDROUTES,
    };

    const gas = HUNDRED_AND_FIFTY_TGAS;

    try {
      // Creating shared values WITHOUT webhook_url and userselected_dn for verification
      const SharedValues = {
        openapijson_url: validateAndSetUrl(openapijsonurl),
        not_after: validateAndSetDate(defaultValues.notafter),
        not_before: validateAndSetDate(String(todayDate())),
        max_requests: String(defaultValues.maxrequests),
        maxrq_window: String(defaultValues.maxrqwindow),
        webhook_cidr: defaultValues.webhookcidr,
        allowed_cidr: defaultValues.allowedcidr,
        allowed_iso3166list: validateAndSetJson(
          defaultValues.allowediso3166list
        ),
        jwt_duration: String(defaultValues.jwtduration),
        permissioned_routes: validateAndSetJson(
          defaultValues.permissionedroutes
        ),
        subjectuniqueidentifier_url: validateAndSetUrl(
          subjectuniqueidentifierurl
        ),
      };

      const auth = new RoditAuthService(
        this.wallet,
        providerSelectedValues.signapiendpoint,
        null
      );

      const SanctumBase64URLSignatureWithPortalsAndIDs =
        await auth.fetchWithErrorHandling_fe(
          `${providerSelectedValues.signapiendpoint}/api/root/signroot`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              SharedValues,
              mintingfee: providerSelectedValues.mintingfee,
              mintingfeeaccount: providerSelectedValues.mintingfeeaccount,
            }),
          }
        );

      if (SanctumBase64URLSignatureWithPortalsAndIDs.error) {
        throw new Error(
          `API Error: ${
            SanctumBase64URLSignatureWithPortalsAndIDs.message ||
            "Unknown error"
          }`
        );
      }

      const {
        portal_token_id,
        sanctum_token_id,
        combined_id_portal,
        combined_id_sanctum,
        serviceprovider_signature: SanctumBase64URLSignatureWithPortal,
        serviceprovider_public_key_base64url,
        sanctum_fee_signature_base64url ,
      } = SanctumBase64URLSignatureWithPortalsAndIDs;

      const buildContext = createLogContext("Contract", "buildpairofrodits", { requestId: Math.random().toString(36).substring(2, 15) });
      
      logger.debug("API Response IDs", {
        ...buildContext,
        portal_token_id,
        sanctum_token_id,
        combined_id_portal,
        combined_id_sanctum,
      });

      const PortalValuesToBless = {
        token_id: portal_token_id,
        openapijson_url: validateAndSetUrl(openapijsonurl),
        not_after: validateAndSetDate(defaultValues.notafter),
        not_before: validateAndSetDate(String(todayDate())),
        max_requests: String(defaultValues.maxrequests),
        maxrq_window: String(defaultValues.maxrqwindow),
        webhook_cidr: defaultValues.webhookcidr,
        allowed_cidr: defaultValues.allowedcidr,
        allowed_iso3166list: validateAndSetJson(
          defaultValues.allowediso3166list
        ),
        jwt_duration: String(defaultValues.jwtduration),
        permissioned_routes: validateAndSetJson(
          defaultValues.permissionedroutes
        ),
        serviceprovider_id: combined_id_portal,
        subjectuniqueidentifier_url: validateAndSetUrl(
          subjectuniqueidentifierurl
        ),
      };

      // Sign sanctum values
      const SanctumBytesPrivateKey = new Uint8Array(
        bs58.decode(SanctumBase58PrivateKey)
      );

      const PortalHashToSign = calculateCanonicalHash(PortalValuesToBless);
      const PortalBytesHash = bufferUtils.hexToUint8Array(PortalHashToSign);
      const PortalBytesSignatureWithSanctum = nacl.sign.detached(
        PortalBytesHash,
        SanctumBytesPrivateKey
      );
      const PortalBase64URLSignatureWithSanctum =
        bufferUtils.uint8ArrayToBase64url(PortalBytesSignatureWithSanctum);

      // Create verification metadata - WITHOUT webhook_url and userselected_dn
      const SanctumVerificationMetadata = {
        openapijson_url: validateAndSetUrl(openapijsonurl),
        not_after: validateAndSetDate(defaultValues.notafter),
        not_before: validateAndSetDate(String(todayDate())),
        max_requests: String(defaultValues.maxrequests),
        maxrq_window: String(defaultValues.maxrqwindow),
        webhook_cidr: defaultValues.webhookcidr,
        allowed_cidr: defaultValues.allowedcidr,
        allowed_iso3166list: validateAndSetJson(
          defaultValues.allowediso3166list
        ),
        jwt_duration: String(defaultValues.jwtduration),
        permissioned_routes: validateAndSetJson(
          defaultValues.permissionedroutes
        ),
        subjectuniqueidentifier_url: validateAndSetUrl(
          subjectuniqueidentifierurl
        ),
        serviceprovider_id: combined_id_sanctum,
        serviceprovider_signature: validateAndSetSignature(
          base64ToBase64Url(SanctumBase64URLSignatureWithPortal),
          "digital signature"
        ),
      };

      const PortalVerificationMetadata = {
        openapijson_url: validateAndSetUrl(openapijsonurl),
        not_after: validateAndSetDate(defaultValues.notafter),
        not_before: validateAndSetDate(String(todayDate())),
        max_requests: String(defaultValues.maxrequests),
        maxrq_window: String(defaultValues.maxrqwindow),
        webhook_cidr: defaultValues.webhookcidr,
        allowed_cidr: defaultValues.allowedcidr,
        allowed_iso3166list: validateAndSetJson(
          defaultValues.allowediso3166list
        ),
        jwt_duration: String(defaultValues.jwtduration),
        permissioned_routes: validateAndSetJson(
          defaultValues.permissionedroutes
        ),
        serviceprovider_id: combined_id_portal,
        subjectuniqueidentifier_url: validateAndSetUrl(
          subjectuniqueidentifierurl
        ),
        serviceprovider_signature: validateAndSetSignature(
          base64ToBase64Url(PortalBase64URLSignatureWithSanctum),
          "digital signature"
        ),
      };

      // Generate signing keys
      logger.debug("Public key from API", {
        ...buildContext,
        serviceprovider_public_key_base64url,
        length: serviceprovider_public_key_base64url.length,
        // Show the raw base64url string characters
        characters: serviceprovider_public_key_base64url.split('').map(c => c.charCodeAt(0))
      });
      
      // Convert the base64url public key to the correct format for TweetNaCl
      // First, log the intermediate steps of the conversion
      const base64 = serviceprovider_public_key_base64url.replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64.padEnd(
        base64.length + ((4 - (base64.length % 4)) % 4),
        "="
      );
      
      logger.debug("Portal public key conversion steps", {
        ...buildContext,
        original: serviceprovider_public_key_base64url,
        base64: base64,
        padded: padded,
        paddedLength: padded.length
      });
      
      // Use the standard function for decoding
      const PortalSignerPublicKey = bufferUtils.base64urlToUint8Array(
        serviceprovider_public_key_base64url
      );
      
      logger.debug("Portal public key after conversion", {
        ...buildContext,
        length: PortalSignerPublicKey.length,
        firstBytes: Array.from(PortalSignerPublicKey.slice(0, 4)).join(" "),
        fullKey: Array.from(PortalSignerPublicKey).join(" ")
      });

      const SanctumSignerPublicKey = nacl.sign.keyPair.fromSecretKey(
        SanctumBytesPrivateKey
      ).publicKey;
      
      logger.debug("Sanctum public key", {
        ...buildContext,
        length: SanctumSignerPublicKey.length,
        firstBytes: Array.from(SanctumSignerPublicKey.slice(0, 4)).join(" ")
      });

      logger.debug("Verification metadata combined IDs", {
        ...buildContext,
        portalVerificationId: PortalVerificationMetadata.serviceprovider_id,
        sanctumVerificationId: SanctumVerificationMetadata.serviceprovider_id,
        rawPortalId: combined_id_portal,
        rawSanctumId: combined_id_sanctum,
      });
      
      // Add detailed logging for the working rodit signature verification
      logger.debug("RODiT verification inputs", {
        ...buildContext,
        portalTokenId: portal_token_id,
        sanctumTokenId: sanctum_token_id,
        portalSignature: PortalVerificationMetadata.serviceprovider_signature,
        sanctumSignature: SanctumVerificationMetadata.serviceprovider_signature,
        portalSignatureLength: PortalVerificationMetadata.serviceprovider_signature?.length,
        sanctumSignatureLength: SanctumVerificationMetadata.serviceprovider_signature?.length,
        portalPublicKeyLength: PortalSignerPublicKey?.length,
        sanctumPublicKeyLength: SanctumSignerPublicKey?.length,
        portalPublicKeyFirstFew: Array.from(PortalSignerPublicKey.slice(0, 10)).join(' '),
        sanctumPublicKeyFirstFew: Array.from(SanctumSignerPublicKey.slice(0, 10)).join(' ')
      });

      // Additional sanity-check logs for public keys
      logger.debug("Portal key sanity-check", {
        ...buildContext,
        PortalKeyLength: PortalSignerPublicKey.length,
        PortalKeyBase64url: bufferUtils.uint8ArrayToBase64url(PortalSignerPublicKey)
      });
      logger.debug("Sanctum key sanity-check", {
        ...buildContext,
        SanctumKeyLength: SanctumSignerPublicKey.length,
        SanctumKeyBase64url: bufferUtils.uint8ArrayToBase64url(SanctumSignerPublicKey)
      });
      
      // Verify RODiT pair before minting
      const verificationResult = await verifyRoditPairBeforeMinting(
        {
          token_id: portal_token_id,
          ...PortalVerificationMetadata,
        },
        {
          token_id: sanctum_token_id,
          ...SanctumVerificationMetadata,
        },
        PortalSignerPublicKey,
        SanctumSignerPublicKey
      );
      console.log("[DEBUG] verifyRoditPairBeforeMinting result:", verificationResult);

      if (!verificationResult) {
        throw new Error("RODiT pair verification failed - aborting mint");
      }
      
      // Create minting metadata - WITH webhook_url and userselected_dn for both
      // Important: Create completely new objects with all fields explicitly set
      // Ensure all fields are properly formatted strings to match the contract's TokenMetadata struct
      const ensureString = (value) => {
        if (value === null || value === undefined) return "";
        return String(value);
      }
      
      const SanctumMintingMetadata = {
        openapijson_url: ensureString(SanctumVerificationMetadata.openapijson_url),
        not_after: ensureString(SanctumVerificationMetadata.not_after),
        not_before: ensureString(SanctumVerificationMetadata.not_before),
        max_requests: ensureString(SanctumVerificationMetadata.max_requests),
        maxrq_window: ensureString(SanctumVerificationMetadata.maxrq_window),
        webhook_cidr: ensureString(SanctumVerificationMetadata.webhook_cidr),
        allowed_cidr: ensureString(SanctumVerificationMetadata.allowed_cidr),
        allowed_iso3166list: ensureString(SanctumVerificationMetadata.allowed_iso3166list),
        jwt_duration: ensureString(SanctumVerificationMetadata.jwt_duration),
        permissioned_routes: ensureString(SanctumVerificationMetadata.permissioned_routes),
        subjectuniqueidentifier_url: ensureString(SanctumVerificationMetadata.subjectuniqueidentifier_url),
        serviceprovider_id: ensureString(SanctumVerificationMetadata.serviceprovider_id),
        serviceprovider_signature: ensureString(SanctumVerificationMetadata.serviceprovider_signature),
        webhook_url: ensureString(validateAndSetUrl(defaultValues.webhookurl)),
        userselected_dn: ensureString(defaultValues.userselecteddn),
      };

      const PortalMintingMetadata = {
        openapijson_url: ensureString(PortalVerificationMetadata.openapijson_url),
        not_after: ensureString(PortalVerificationMetadata.not_after),
        not_before: ensureString(PortalVerificationMetadata.not_before),
        max_requests: ensureString(PortalVerificationMetadata.max_requests),
        maxrq_window: ensureString(PortalVerificationMetadata.maxrq_window),
        webhook_cidr: ensureString(PortalVerificationMetadata.webhook_cidr),
        allowed_cidr: ensureString(PortalVerificationMetadata.allowed_cidr),
        allowed_iso3166list: ensureString(PortalVerificationMetadata.allowed_iso3166list),
        jwt_duration: ensureString(PortalVerificationMetadata.jwt_duration),
        permissioned_routes: ensureString(PortalVerificationMetadata.permissioned_routes),
        subjectuniqueidentifier_url: ensureString(PortalVerificationMetadata.subjectuniqueidentifier_url),
        serviceprovider_id: ensureString(PortalVerificationMetadata.serviceprovider_id),
        serviceprovider_signature: ensureString(PortalVerificationMetadata.serviceprovider_signature),
        webhook_url: ensureString(validateAndSetUrl(defaultValues.webhookurl)),
        userselected_dn: ensureString(defaultValues.userselecteddn),
      };

      // Add debug logging for final metadata
      console.log("Debug final metadata types:", {
        sanctum: {
          token_id: typeof sanctum_token_id,
          max_requests: typeof SanctumMintingMetadata.max_requests,
          maxrq_window: typeof SanctumMintingMetadata.maxrq_window,
          jwt_duration: typeof SanctumMintingMetadata.jwt_duration,
          allowed_iso3166list:
            typeof SanctumMintingMetadata.allowed_iso3166list,
          permissioned_routes:
            typeof SanctumMintingMetadata.permissioned_routes,
        },
        portal: {
          token_id: typeof portal_token_id,
          max_requests: typeof PortalMintingMetadata.max_requests,
          maxrq_window: typeof PortalMintingMetadata.maxrq_window,
          jwt_duration: typeof PortalMintingMetadata.jwt_duration,
          allowed_iso3166list: typeof PortalMintingMetadata.allowed_iso3166list,
          permissioned_routes: typeof PortalMintingMetadata.permissioned_routes,
        },
      });

      logger.debug("Transaction details", {
        ...buildContext,
        sanctum_token_id,
        portal_token_id,
        owneraccount_id: SanctumOwnerAccountId,
        mintingfee_account: providerSelectedValues.mintingfeeaccount,
      });
      
      // Check if sanctum_fee_signature_base64url is defined
      // This is critical for the contract call to succeed
      if (!sanctum_fee_signature_base64url ) {
        throw new Error("Sanctum fee signature is missing or undefined");
      }
      
      // IMPORTANT: The sanctum_fee_signature_base64url from the API is for the Sanctum token
      // We need to generate a separate signature for the Portal token
      
      // Create fee data for Portal token using the same mintingfee as sent to the API
      const portalFeeData = {
        token_id: portal_token_id,
        mintingfee: providerSelectedValues.mintingfee,
        mintingfeeaccount: providerSelectedValues.mintingfeeaccount
      };
      
      // Generate signature for Portal token using the same method as in signroot.js
      const portalFeeHash = calculateCanonicalHash(portalFeeData);
      const portalFeeHashBytes = bufferUtils.hexToUint8Array(portalFeeHash);
      
      // Sign with Portal private key (which is the Sanctum private key in this case)
      const portalFeeSignature = nacl.sign.detached(
        portalFeeHashBytes,
        SanctumBytesPrivateKey
      );
      
      // Convert to base64url format
      const portal_fee_signature_base64url = bufferUtils.uint8ArrayToBase64url(portalFeeSignature);
            
      // Log both fee signatures
      logger.debug("Portal fee signature", {
        ...buildContext,
        token_id: portal_token_id,
        signature: portal_fee_signature_base64url,
        signatureLength: portal_fee_signature_base64url.length
      });
      
      logger.debug("Sanctum fee signature", {
        ...buildContext,
        token_id: sanctum_token_id,
        signature: sanctum_fee_signature_base64url,
        signatureLength: sanctum_fee_signature_base64url.length
      });
      
      // Create sanctum fee data object matching the structure used for signing
      // IMPORTANT: This must exactly match the structure in the API's signroot.js
      const sanctumFeeData = {
        token_id: sanctum_token_id,
        mintingfee: providerSelectedValues.mintingfee,
        // Use the exact same property name and order as in the API
        mintingfeeaccount: providerSelectedValues.mintingfeeaccount
      };
      
      // Log the exact data structure for debugging
      logger.debug("Exact Sanctum fee data comparison", {
        ...buildContext,
        frontendData: JSON.stringify(sanctumFeeData),
        // This should match what's logged in the API
        expectedApiFormat: JSON.stringify({
          token_id: sanctum_token_id,
          mintingfee: providerSelectedValues.mintingfee,
          mintingfeeaccount: providerSelectedValues.mintingfeeaccount
        })
      });
      
      // Compare the sanctum fee signature with the rodit signature (which works)
      logger.debug("Signature comparison", {
        ...buildContext,
        sanctumFeeSignature: {
          value: sanctum_fee_signature_base64url,
          length: sanctum_fee_signature_base64url.length,
          firstChars: sanctum_fee_signature_base64url.substring(0, 20),
          lastChars: sanctum_fee_signature_base64url.substring(sanctum_fee_signature_base64url.length - 20)
        },
        roditSignature: {
          value: SanctumVerificationMetadata.serviceprovider_signature,
          length: SanctumVerificationMetadata.serviceprovider_signature.length,
          firstChars: SanctumVerificationMetadata.serviceprovider_signature.substring(0, 20),
          lastChars: SanctumVerificationMetadata.serviceprovider_signature.substring(SanctumVerificationMetadata.serviceprovider_signature.length - 20)
        }
      });
      
      // Log the fee data that was signed for each token
      logger.debug("Portal fee data", { ...buildContext, portalFeeData });
      
      logger.debug("Sanctum fee data", { ...buildContext, sanctumFeeData });
      
      // Add detailed logging for fee verification process
      logger.debug("Portal fee verification details", {
        ...buildContext,
        rawData: JSON.stringify(portalFeeData),
        canonicalForm: JSON.stringify(canonicalizeObject(portalFeeData)),
        calculatedHash: calculateCanonicalHash(portalFeeData),
        hashBytes: Array.from(bufferUtils.hexToUint8Array(calculateCanonicalHash(portalFeeData))).slice(0, 10).join(' '),
        signatureBytes: Array.from(bufferUtils.base64urlToUint8Array(portal_fee_signature_base64url)).slice(0, 10).join(' '),
        publicKeyUsed: Array.from(SanctumSignerPublicKey).slice(0, 10).join(' ')
      });
      
      logger.debug("Sanctum fee verification details", {
        ...buildContext,
        rawData: JSON.stringify(sanctumFeeData),
        canonicalForm: JSON.stringify(canonicalizeObject(sanctumFeeData)),
        calculatedHash: calculateCanonicalHash(sanctumFeeData),
        hashBytes: Array.from(bufferUtils.hexToUint8Array(calculateCanonicalHash(sanctumFeeData))).slice(0, 10).join(' '),
        signatureBytes: Array.from(bufferUtils.base64urlToUint8Array(sanctum_fee_signature_base64url)).slice(0, 10).join(' '),
        publicKeyUsed: Array.from(PortalSignerPublicKey).slice(0, 10).join(' ')
      });
      
      // Verify fee signatures before minting
      logger.debug("Verifying fee signatures before minting", buildContext);
      
      // Prepare pre-canonicalized JSON for contract calls
      // This ensures the JSON is already in canonical form when sent to the contract
      // eliminating potential canonicalization differences between JS and Rust
      
      // For Portal token - Use canonicalized JSON string
      const portalCanonicalObj = canonicalizeObject(portalFeeData);
      const portalFeeDataJson = JSON.stringify(portalCanonicalObj);
      logger.debug("Portal fee data (canonicalized)", {
        ...buildContext,
        portalFeeDataJson
      });
      
      // Log the exact bytes that will be hashed for verification
      const portalBytes = decodeUTF8(portalFeeDataJson);
      logger.debug("Portal fee data bytes (first 20)", {
        ...buildContext,
        bytes: Array.from(portalBytes.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' ')
      });
      
      // For Sanctum token - Use canonicalized JSON string
      const sanctumCanonicalObj = canonicalizeObject(sanctumFeeData);
      const sanctumFeeDataJson = JSON.stringify(sanctumCanonicalObj);
      logger.debug("Sanctum fee data (canonicalized)", {
        ...buildContext,
        sanctumFeeDataJson
      });
      
      // Log the exact bytes that will be hashed for verification
      const sanctumBytes = decodeUTF8(sanctumFeeDataJson);
      logger.debug("Sanctum fee data bytes (first 20)", {
        ...buildContext,
        bytes: Array.from(sanctumBytes.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' ')
      });
      
      // Log hash values for comparison with contract
      const portalHashUint8 = nacl.hash(portalBytes);
      const portalHashHex = Array.from(portalHashUint8)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      logger.debug("Portal fee data hash (hex)", {
        ...buildContext,
        portalHashHex
      });
      
      const sanctumHashUint8 = nacl.hash(sanctumBytes);
      const sanctumHashHex = Array.from(sanctumHashUint8)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      logger.debug("Sanctum fee data hash (hex)", {
        ...buildContext,
        sanctumHashHex
      });
      
      // Log comparison between verification methods
      logger.debug("Verification comparison", {
        ...buildContext,
        contractStyleVerification: "Using raw message bytes hash",
        regularVerification: "Using canonicalized object hash"
      });
      
      // Proceed with the existing verification method
      try {
       // Use the already canonicalized JSON strings from above
       const verificationResult = await verifyFeePairBeforeMinting(
          portalFeeDataJson,
          sanctumFeeDataJson,
          portal_fee_signature_base64url,
          sanctum_fee_signature_base64url,
          PortalSignerPublicKey,
          SanctumSignerPublicKey
        );

        logger.debug("verifyRoditPairBeforeMinting result", {
          ...buildContext,
          verificationResult
        });

        if (!verificationResult.success) {
          throw new Error(`Fee signature verification failed: ${verificationResult.error}`);
        }
        
        logger.info("Fee signatures verified successfully", buildContext);
      } catch (error) {
        logger.error("Fee signature verification failed", {
          ...buildContext,
          error: {
            message: error.message,
            stack: error.stack
          }
        });
        throw new Error(`Fee signature verification failed: ${error.message}`);
      }

      // Create mint actions - using the minting metadata with added fields
      // Convert mintingfee to yoctoNEAR format for the contract call
      const deposit = utils.format.parseNearAmount(
        providerSelectedValues.mintingfee
      );
      
      const actionset = [
        {
          type: "FunctionCall",
          params: {
            methodName: "rodit_mint",
            args: {
              token_id: sanctum_token_id,
              metadata: SanctumMintingMetadata,
              owneraccount_id: SanctumOwnerAccountId,
              mintingfee_account: providerSelectedValues.mintingfeeaccount,
              mintingfee_value: providerSelectedValues.mintingfee,
              fee_data_json: sanctumFeeDataJson,
              fee_signature_base64url: sanctum_fee_signature_base64url,
            },
            gas,
            deposit,
          },
        },
        {
          type: "FunctionCall",
          params: {
            methodName: "rodit_mint",
            args: {
              token_id: portal_token_id,
              metadata: PortalMintingMetadata,
              owneraccount_id: SanctumOwnerAccountId,
              mintingfee_account: providerSelectedValues.mintingfeeaccount,
              mintingfee_value: providerSelectedValues.mintingfee,
              fee_data_json: portalFeeDataJson,
              fee_signature_base64url: portal_fee_signature_base64url,
            },
            gas,
            deposit,
          },
        },
      ];

      // Add detailed logging of the exact data being sent to the contract
      logger.debug("Full contract call data", {
        ...buildContext,
        actionset: JSON.stringify(actionset, null, 2)
      });
      
      // Log each metadata object separately for clarity
      logger.debug("Sanctum metadata fields", {
        ...buildContext,
        fields: Object.keys(actionset[0].params.args.metadata)
      });
      logger.debug("Portal metadata fields", {
        ...buildContext,
        fields: Object.keys(actionset[1].params.args.metadata)
      });
      
      // Log specific field types to check for type mismatches
      logger.debug("Sanctum metadata types", {
        ...buildContext,
        openapijson_url: typeof actionset[0].params.args.metadata.openapijson_url,
        not_after: typeof actionset[0].params.args.metadata.not_after,
        not_before: typeof actionset[0].params.args.metadata.not_before,
        max_requests: typeof actionset[0].params.args.metadata.max_requests,
        maxrq_window: typeof actionset[0].params.args.metadata.maxrq_window,
        webhook_url: typeof actionset[0].params.args.metadata.webhook_url,
        webhook_cidr: typeof actionset[0].params.args.metadata.webhook_cidr,
        userselected_dn: typeof actionset[0].params.args.metadata.userselected_dn,
        allowed_cidr: typeof actionset[0].params.args.metadata.allowed_cidr,
        allowed_iso3166list: typeof actionset[0].params.args.metadata.allowed_iso3166list,
        jwt_duration: typeof actionset[0].params.args.metadata.jwt_duration,
        permissioned_routes: typeof actionset[0].params.args.metadata.permissioned_routes,
        subjectuniqueidentifier_url: typeof actionset[0].params.args.metadata.subjectuniqueidentifier_url,
        serviceprovider_id: typeof actionset[0].params.args.metadata.serviceprovider_id,
        serviceprovider_signature: typeof actionset[0].params.args.metadata.serviceprovider_signature
      });
      
      logger.info("Initiating RODiT pair minting transaction", {
        ...buildContext,
        sanctumTokenId: sanctum_token_id,
        portalTokenId: portal_token_id,
        contractId: this.contractId,
        actionCount: actionset.length
      });
      
      // Note: wallet.callMethod will redirect to NEAR wallet for approval
      // The page will reload after the user approves/rejects the transaction
      // This is expected behavior - the transaction result will be in the URL params
      try {
        const result = await this.wallet.callMethod(this.contractId, actionset);
        
        // This code may not execute if wallet redirects
        logger.info("RODiT pair minting transaction completed", {
          ...buildContext,
          result
        });
        
        return result;
      } catch (walletError) {
        logger.error("Wallet transaction failed", {
          ...buildContext,
          error: {
            message: walletError.message,
            stack: walletError.stack,
            name: walletError.name
          }
        });
        throw new Error(`Wallet transaction failed: ${walletError.message}`);
      }
    } catch (error) {
      throw error;
    }
  }
}
