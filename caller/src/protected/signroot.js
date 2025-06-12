const express = require("express");
const router = express.Router();
const logger = require("../../sdk/services/logger");
const config = require("config");
const base64url = require("base64url");
const nacl = require("tweetnacl");
const { ulid } = require("ulid");

// Import SDK components instead of middleware
const roditSDK = require("../../sdk");
const {
  validateAndSetDate,
  validateAndSetJson,
  validateAndSetUrl,
  calculateCanonicalHash,
  canonicalizeObject
} = require("../../sdk/utils");

// Get managers from SDK
const roditManager = require("../../sdk/lib/auth/roditmanager");
const stateManager = require("../../sdk/lib/blockchain/statemanager");
const loggingmw = require("../../sdk/lib/middleware/loggingmw");

/**
 * RoditRootSigner class for managing root signing operations
 */
class RoditRootSigner {
  constructor() {
    this.serverPort = config.get("SERVERPORT");
    this.signingBytesKey = null;
    this.publicKey = null;
  }

  /**
   * Initialize the signer with vault credentials and configuration
   */
  async initialize() {
    try {
      // Get the configuration that was initialized in app.js
      const configObject = await stateManager.getConfigOwnRodit();
      if (!configObject) {
        logger.error("Error 0117: Configuration not initialized");
        throw new Error("Error 0118: RODiT configuration not initialized");
      }

      // Use the credentials from the portal
      const credentials = await roditManager.getCredentials("portal");
      this.signingBytesKey = credentials.signing_bytes_key;

      // Extract public key from signing key (private key)
      // In NaCl, the private key contains the public key in the second half
      if (this.signingBytesKey && this.signingBytesKey.length === 64) {
        this.publicKey = this.signingBytesKey.subarray(32);
      } else {
        // If the key format is different, derive the public key
        this.publicKey = nacl.sign.keyPair.fromSecretKey(
          this.signingBytesKey
        ).publicKey;
      }

      return true;
    } catch (error) {
      logger.error(`Initialization error in Client: ${error.message}`, {
        stack: error.stack,
        step: error.step || "unknown",
      });
      throw error;
    }
  }

  /**
   * Get the public key in hex format
   */
  getPublicKeyBytes() {
    if (!this.publicKey) {
      throw new Error(
        "Public key not available. Signer may not be initialized."
      );
    }
    return this.publicKey;
  }

  /**
   * Update state with configuration and session key
   */
  async updateState(configObject, implicit_account_id) {
    await stateManager.setConfigOwnRodit(configObject);
    const session_base64url_jwk_public_key = Buffer.from(
      implicit_account_id,
      "hex"
    ).toString("base64url");
    await stateManager.setSessionBase64urlJwkPublicKey(
      session_base64url_jwk_public_key
    );
  }

  /**
   * Create token IDs for portal and sanctum
   */
  createTokenIds() {
    const PortalRODiTulid = ulid();
    const SanctumRODiTulid = ulid();

    const base_prefix = "bc=near.org;sc=" + config.get("NEAR_CONTRACT_ID");
    const portalTokenId = `${base_prefix};id=${PortalRODiTulid}`;
    const sanctumTokenId = `${base_prefix};id=${SanctumRODiTulid}`;
    const combinedIdportal = `${base_prefix};id=${PortalRODiTulid};id=${SanctumRODiTulid}`;
    const combinedIdsanctum = `${base_prefix};id=${SanctumRODiTulid};id=${PortalRODiTulid}`;
    return {
      portalTokenId,
      sanctumTokenId,
      combinedIdportal,
      combinedIdsanctum,
    };
  }

  /**
   * Create and validate portal values object for signing
   */
  createSanctumValuesToBless(SharedValues, sanctumTokenId, combinedIdsanctum) {
    const sanctumValues = {
      token_id: sanctumTokenId,
      openapijson_url: validateAndSetUrl(
        SharedValues.openapijson_url,
        "openapijson_url"
      ),
      not_after: validateAndSetDate(SharedValues.not_after, "not_after"),
      not_before: validateAndSetDate(SharedValues.not_before, "not_before"),
      max_requests: String(SharedValues.max_requests),
      maxrq_window: String(SharedValues.maxrq_window),
      webhook_cidr: SharedValues.webhook_cidr,
      allowed_cidr: SharedValues.allowed_cidr,
      allowed_iso3166list: validateAndSetJson(
        SharedValues.allowed_iso3166list,
        "allowed_iso3166list"
      ),
      jwt_duration: SharedValues.jwt_duration,
      permissioned_routes: validateAndSetJson(
        SharedValues.permissioned_routes,
        "permissioned_routes"
      ),
      serviceprovider_id: combinedIdsanctum,
      subjectuniqueidentifier_url: validateAndSetUrl(
        SharedValues.subjectuniqueidentifier_url,
        "subjectuniqueidentifier_url"
      ),
    };

    // Log the canonical JSON that will be used for signing
    logger.debug("sanctum values to bless:", {
      rawValues: JSON.stringify(sanctumValues),
      sortedKeys: Object.keys(sanctumValues).sort(),
      canonicalForm: JSON.stringify(canonicalizeObject(sanctumValues)),
    });

    return sanctumValues;
  }

  /**
   * Sign data using the signing key
   */
  signData(valuesToBless) {
    const requestId = ulid();
    logger.debug("Signing data", { requestId });

    try {
      // Log the entire input object that will be hashed
      logger.debug("Input object for signature calculation:", {
        requestId,
        values: JSON.stringify(valuesToBless),
        valueKeys: Object.keys(valuesToBless).sort(),
      });

      // Calculate hash of canonical form
      const hashToSign = calculateCanonicalHash(valuesToBless);
      logger.debug("EXACT_HASH_INPUT_BACKEND:", {
        completeObject: JSON.stringify(valuesToBless),
        canonicalForm: JSON.stringify(canonicalizeObject(valuesToBless)),
        hashResult: hashToSign,
      });

      // Log the hash in hex format
      logger.debug("Calculated hash:", {
        requestId,
        hashHex: hashToSign,
      });

      const bytesHash = new Uint8Array(Buffer.from(hashToSign, "hex"));

      // Log the byte representation
      logger.debug("Hash bytes:", {
        requestId,
        hashBytesHex: Buffer.from(bytesHash).toString("hex"),
      });

      // Sign the hash with the key
      const bytesSignature = nacl.sign.detached(
        bytesHash,
        this.signingBytesKey
      );

      // Log the signature bytes
      logger.debug("Signature:", {
        requestId,
        signatureHex: Buffer.from(bytesSignature).toString("hex"),
        signatureLength: bytesSignature.length,
      });

      // Log the public key that would be used to verify
      logger.debug("Public key:", {
        requestId,
        publicKeyHex: Buffer.from(this.publicKey).toString("hex"),
        publicKeyLength: this.publicKey.length,
      });

      // Convert signature to base64url format
      const base64URLSignature = base64url(Buffer.from(bytesSignature));

      // Verify our own signature as a sanity check
      const verificationResult = nacl.sign.detached.verify(
        bytesHash,
        bytesSignature,
        this.publicKey
      );

      logger.debug("Self-verification result:", {
        requestId,
        result: verificationResult,
      });

      return base64URLSignature;
    } catch (error) {
      logger.error("Error in signData", {
        requestId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Log events with appropriate level
   */
  logEvent(event, data, isError = false) {
    try {
      const logData = typeof data === "object" ? JSON.stringify(data) : data;
      isError
        ? logger.error(`${event}: ${logData}`)
        : logger.info(`${event}: ${logData}`);
    } catch (error) {
      logger.error(`Error in logEvent: ${error.message}`);
    }
  }
}

// Initialize router
const roditSignerRoot = new RoditRootSigner();
let initialized = false;

// Use SDK logging middleware
router.use(loggingmw);

// Initialize the signer on startup
async function ensureInitialized(req, res, next) {
  if (!initialized) {
    try {
      await roditSignerRoot.initialize();
      initialized = true;
      logger.info("RoditRootSigner initialized successfully", {
        component: "RootSigner",
        requestId: req.requestId || ulid()
      });
      next();
    } catch (error) {
      logger.error("Error initializing RoditRootSigner", {
        error: error.message,
        stack: error.stack,
        component: "RootSigner",
        requestId: req.requestId || ulid()
      });
      res.status(500).json({ 
        error: "Error 0119: Server initialization error",
        requestId: req.requestId || ulid()
      });
    }
  } else {
    next();
  }
}

/**
 * POST /signroot - Generate and sign RODIT tokens
 */
router.post("/signroot", ensureInitialized, async (req, res) => {
  const requestId = ulid();
  logger.info(`Processing sign request - Request ID: ${requestId}`);

  try {
    const { SharedValues, mintingfee, mintingfeeaccount } = req.body;

    if (!SharedValues) {
      return res.status(400).json({
        error: "Missing SharedValues",
        requestId,
      });
    }

    // Create token IDs
    const {
      portalTokenId,
      sanctumTokenId,
      combinedIdportal,
      combinedIdsanctum,
    } = roditSignerRoot.createTokenIds();

    // Prepare values for signing
    const SanctumValuesToBless = roditSignerRoot.createSanctumValuesToBless(
      SharedValues,
      sanctumTokenId,
      combinedIdsanctum
    );

    // Sign the sanctum values
    const serviceprovider_signature =
      roditSignerRoot.signData(SanctumValuesToBless);

    // Prepare and sign fee data
    const feeData = {
      token_id: portalTokenId,
      mintingfee,
      mintingfeeaccount,
    };
    const fee_signature = roditSignerRoot.signData(feeData);
    const serviceprovider_public_key = roditSignerRoot.getPublicKeyBytes();
    const serviceprovider_public_key_base64url = base64url(
      Buffer.from(serviceprovider_public_key)
    );
    // Prepare response
    const responseObject = {
      portal_token_id: portalTokenId,
      sanctum_token_id: sanctumTokenId,
      combined_id_portal: combinedIdportal,
      combined_id_sanctum: combinedIdsanctum,
      serviceprovider_signature,
      serviceprovider_public_key_base64url,
      fee_signature,
    };

    // Log success and return response
    logger.info(`Signatures created successfully for request: ${requestId}`);
    res.json(responseObject);
  } catch (error) {
    logger.error(`Error in signing: ${error.message}`, {
      requestId,
      stack: error.stack,
    });

    // Return appropriate error response
    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: "Validation error",
        details: error.message,
        requestId,
      });
    }
    return res.status(500).json({
      error: "Internal RODIT Client Signing Router error",
      message: error.message,
      requestId,
    });
  }
});

module.exports = router;
