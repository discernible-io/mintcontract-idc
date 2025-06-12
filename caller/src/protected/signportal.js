const express = require("express");
const router = express.Router();
const logger = require("../../sdk/services/logger");
const config = require("config");
const base64url = require("base64url");
const nacl = require("tweetnacl");

// Import SDK components instead of middleware
const roditSDK = require("../../sdk");
const {
  validateAndSetDate,
  validateAndSetJson,
  validateAndSetUrl,
  calculateCanonicalHash
} = require("../../sdk/utils");

// Get managers from SDK
const roditManager = require("../../sdk/lib/auth/roditmanager");
const stateManager = require("../../sdk/lib/blockchain/statemanager");
const loggingmw = require("../../sdk/lib/middleware/loggingmw");

/**
 * RoditClientSigner class for managing client signing operations
 */
class RoditClientSigner {
  constructor() {
    this.serverPort = config.get("SERVERPORT");
    this.signingBytesKey = null;
    this.PortalValues = null;
  }

  /**
   * Initialize the signer with vault credentials and configuration
   */
  async initialize() {
    try {
      // Get the configuration that was initialized in app.js
      const configObject = await stateManager.getConfigOwnRodit();
      if (!configObject) {
        logger.error("Error 0115: Configuration not initialized");
        throw new Error("Error 0116: RODiT configuration not initialized");
      }

      // Use the credentials from the portal
      const credentials = await roditManager.getCredentials("portal");
      this.signingBytesKey = credentials.signing_bytes_key;

      // Use own_rodit metadata as PortalValues since that's what's available
      if (
        !configObject ||
        !configObject.own_rodit ||
        !configObject.own_rodit.metadata
      ) {
        logger.warn(
          "Configuration object or own_rodit metadata is not available"
        );
        throw new Error("Error 0117: Portal configuration not available");
      } else {
        this.PortalValues = configObject.own_rodit.metadata;

        logger.info(`this.PortalValues: ${JSON.stringify(this.PortalValues)}`);
        logger.info(
          `own_rodit.metadata: ${JSON.stringify(
            configObject.own_rodit.metadata
          )}`
        );
      }

      logger.info(`RoditClientSigner initialization completed successfully`);
      return true;
    } catch (error) {
      logger.error(`Initialization error in Client: ${error.message}`, {
        stack: error.stack,
      });
      throw error;
    }
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
   * Create signature data object from tamperproofed values
   */
  createSignatureDataClient(tamperproofedValues, roditulid) {
    if (!this.PortalValues) {
      throw new Error(
        "Portal values not available. Signer may not be initialized."
      );
    }

    const originalServiceProviderId = tamperproofedValues.serviceprovider_id;
    const parts = originalServiceProviderId.split(";");
    const prefixParts = parts.filter(
      (part) => part.startsWith("bc=") || part.startsWith("sc=")
    );
    const idParts = parts.filter((part) => part.startsWith("id="));
    const reversedIdParts = [...idParts].reverse();
    const serviceproviderid = [...prefixParts, ...reversedIdParts].join(";");

    return {
      token_id: roditulid,
      openapijson_url: validateAndSetUrl(
        tamperproofedValues.openapijson_url,
        "openapijson_url"
      ),
      not_after: validateAndSetDate(tamperproofedValues.not_after, "not_after"),
      not_before: validateAndSetDate(
        tamperproofedValues.not_before,
        "not_before"
      ),
      max_requests: String(tamperproofedValues.max_requests),  // Convert to string
      maxrq_window: String(tamperproofedValues.maxrq_window), 
      webhook_cidr: tamperproofedValues.webhook_cidr,
      allowed_cidr: tamperproofedValues.allowed_cidr,
      allowed_iso3166list: validateAndSetJson(
        tamperproofedValues.allowed_iso3166list
      ),
      jwt_duration: tamperproofedValues.jwt_duration,
      permissioned_routes: validateAndSetJson(
        tamperproofedValues.permissioned_routes
      ),
      serviceprovider_id: serviceproviderid,
      subjectuniqueidentifier_url: validateAndSetUrl(
        tamperproofedValues.subjectuniqueidentifier_url
      ),
    };
  }

  /**
   * Sign data using the signing key
   */
  signData(data) {
    try {
      logger.debug("[DEBUG] SignData full structure:", {
        data_type: typeof data,
        data_keys: Object.keys(data).sort().join(","),
        data_structure: JSON.stringify(data).substring(0, 200) + "...",
        token_id: data.token_id,
      });
      // Calculate hash of canonical form
      const combinedHash = calculateCanonicalHash(data);
      // Add right after this line
      logger.debug("[DEBUG] SignData hash result:", {
        hash: combinedHash.substring(0, 20) + "...",
        length: combinedHash.length,
      });
      logger.debug("[CRITICAL DEBUG] Full signData input:", JSON.stringify(data, null, 2));
      // Convert hash to byte array
      const message = new Uint8Array(Buffer.from(combinedHash, "hex"));

      // Sign the message with the key
      const signature = nacl.sign.detached(message, this.signingBytesKey);

      // Convert signature to base64url format
      const base64urlSignature = base64url(Buffer.from(signature));

      return base64urlSignature;
    } catch (error) {
      logger.error("Error in signData", {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  getPublicKeyBytes() {
    if (!this.signingBytesKey) {
      throw new Error(
        "Signing key not available. Signer may not be initialized."
      );
    }

    // Handle different possible formats of the signing key
    if (this.signingBytesKey.length === 64) {
      // If it's a full keypair (common in TweetNaCl), extract just the public key portion (last 32 bytes)
      return this.signingBytesKey.slice(32);
    } else {
      // Otherwise, derive the public key using nacl
      return nacl.sign.keyPair.fromSecretKey(this.signingBytesKey).publicKey;
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
const roditSignerClient = new RoditClientSigner();
let initialized = false;
router.use(loggingmw);

// Initialize the signer on startup
async function ensureInitialized(req, res, next) {
  if (!initialized) {
    try {
      await roditSignerClient.initialize();
      initialized = true;
      logger.info("RoditClientSigner initialized successfully", {
        component: "ClientSigner",
        requestId: req.requestId || facialGenerator.generateRandomCombination().encoded
      });
      next();
    } catch (error) {
      logger.error("Error initializing RoditClientSigner", {
        error: error.message,
        stack: error.stack,
        component: "ClientSigner",
        requestId: req.requestId || facialGenerator.generateRandomCombination().encoded
      });
      return res.status(500).json({ 
        error: "Error 0120: Client signer initialization error",
        requestId: req.requestId || facialGenerator.generateRandomCombination().encoded
      });
    }
  } else {
    next();
  }
};

/**
 * POST /signportal - Generate and sign client RODIT tokens
 */
/**
 * POST /signportal - Generate and sign client RODIT tokens
 */
router.post("/signportal", ensureInitialized, async (req, res) => {
  // Use existing requestId if available or generate a new one
  const requestId = req.requestId || facialGenerator.generateRandomCombination().encoded;
  
  logger.info("Processing sign request", {
    component: "ClientSigner",
    action: "sign_portal",
    requestId: requestId,
    clientIp: req.ip,
    userAgent: req.get('User-Agent')
  });

  try {
    const { tamperproofedValues, mintingfee, mintingfeeaccount } = req.body;

    if (!tamperproofedValues) {
      logger.warn(`Missing tamperproofedValues in request`, { requestId });
      return res.status(400).json({
        error: "Missing tamperproofedValues",
        requestId,
      });
    }

    // Generate unique identifier for this RODIT using facial combination generator
    const facialCombination = facialGenerator.generateRandomCombination();
    const roditulid = facialCombination.encoded;

    // Create and sign data
    const signatureData = roditSignerClient.createSignatureDataClient(
      tamperproofedValues,
      roditulid
    );
    const serviceprovider_signature = roditSignerClient.signData(signatureData);

    // Sign fee data
    const feeData = {
      token_id: roditulid,
      mintingfee,
      mintingfeeaccount,
    };
    const fee_signature = roditSignerClient.signData(feeData);

    // Prepare response with values from PortalValues
    const serviceprovider_public_key = roditSignerClient.getPublicKeyBytes();

    // Convert to base64url format for the response
    const serviceprovider_public_key_base64url = base64url(
      Buffer.from(serviceprovider_public_key)
    );

    // Now include ALL fields in the response object
    const responseObject = {
      // Include the original signatureData object that was signed
      ...signatureData,
      // Add additional fields
      serviceprovider_public_key_base64url,
      serviceprovider_signature,
      fee_signature,
      requestId,
    };

    // Log success and return response
    logger.info(`Signature created for RODIT: ${roditulid}`);
    res.json(responseObject);
  } catch (error) {
    logger.error("Error in signing process", {
      error: error.message,
      stack: error.stack,
      component: "ClientSigner",
      action: "sign_portal",
      requestId: requestId
    });

    roditSignerClient.logEvent(
      "signature_error",
      { error: error.message, requestId },
      true
    );

    // Return appropriate error response
    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: "Validation error",
        details: error.message,
        requestId,
        timestamp: new Date().toISOString()
      });
    }
    return res.status(500).json({
      error: "Internal RODIT Client Signing Router error",
      message: error.message,
      requestId,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
