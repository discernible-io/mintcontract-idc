/**
 * Service for interacting with the blockchain network
 * Copyright (c) 2024 Ayayai, Inc. All rights reserved.
 */

const { ulid } = require("ulid");
const config = require("config");
const logger = require("../../services/logger");
const { createLogContext, logErrorWithMetrics } = logger;

const baseModuleContext = createLogContext("BlockchainService", "module", {
  loadedAt: new Date().toISOString()
});

logger.debugWithContext("Loading blockchainservice.js module", baseModuleContext);

/**
 * Constants and Configuration
 */
const CONSTANTS = {
  NEAR_CONTRACT_ID: config.get("NEAR_CONTRACT_ID"),
  SMART_CONTRACT_REVOKED: "10975-revoked-cableguard-org.testnet",
  RODIT_ID_SZ: 128,
  RODIT_ID_PK_SZ: 32,
  RODIT_ID_SIGNATURE_SZ: 64,
  ED25519_KEY_SZ: 64,
};

const NEAR_RPC_URL = config.get("NEAR_RPC_URL");
/**
 * Data models for RODiT authentication
 * Copyright (c) 2024 Ayayai, Inc. All rights reserved.
 */

/**
 * RODiT token class that represents a Resource Ownership and Digital Identity Token
 */
class RODiT {
  constructor() {
    this.token_id = "";
    this.owner_id = "";
    this.metadata = {
      openapijson_url: "",
      not_after: "",
      not_before: "",
      max_requests: "",
      maxrq_window: "",
      webhook_url: "",
      webhook_cidr: "",
      userselected_dn: "",
      allowed_cidr: "",
      allowed_iso3166list: "",
      jwt_duration: "",
      permissioned_routes: "",
      subjectuniqueidentifier_url: "",
      serviceprovider_id: "",
      serviceprovider_signature: "",
    };
  }
}

/**
 * Payload class for NEP-413 standard
 */
class PayloadNEP413 {
  constructor(props) {
    this.tag = props.tag || 2147484061;
    this.message = props.message;
    if (props.nonce instanceof Uint8Array) {
      if (props.nonce.length !== 32) {
        throw new Error("Nonce must be exactly 32 bytes");
      }
      this.nonce = props.nonce;
    } else if (
      Array.isArray(props.nonce) ||
      (typeof props.nonce === "object" && props.nonce !== null)
    ) {
      const nonceArray = Array.isArray(props.nonce)
        ? props.nonce
        : Object.values(props.nonce);
      if (nonceArray.length !== 32) {
        throw new Error("Nonce must be exactly 32 bytes");
      }
      this.nonce = new Uint8Array(nonceArray);
    } else {
      throw new Error(
        "Invalid nonce format - must be Uint8Array or convertible to Uint8Array"
      );
    }
    this.recipient = props.recipient;
    this.callbackUrl = props.callbackUrl;
  }
}

/**
 * Schema for NEP-413 payload in Borsh format
 */
const PayloadNEP413Schema = {
  struct: {
    tag: "u32",
    message: "string",
    nonce: { array: { type: "u8", len: 32 } },
    recipient: "string",
    callbackUrl: { option: "string" },
  },
};

/**
 * Service for interacting with the blockchain network
 */

  async function nearorg_rpc_timestamp() {
    const requestId = ulid();
    const startTime = Date.now();
    
    const baseContext = createLogContext(
      "BlockchainService",
      "nearorg_rpc_timestamp",
      {
        requestId,
        rpcUrl: NEAR_RPC_URL
      }
    );
    
    logger.debugWithContext("Fetching blockchain timestamp", baseContext);

    try {
      const jsonData = {
        jsonrpc: "2.0",
        id: "dontcare",
        method: "block",
        params: {
          finality: "final",
        },
      };

      const fetchStartTime = Date.now();
      const response = await fetch(NEAR_RPC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(jsonData),
      });
      const fetchDuration = Date.now() - fetchStartTime;

      logger.debugWithContext("RPC response received", {
        ...baseContext,
        statusCode: response.status,
        fetchDuration
      });

      if (!response.ok) {
        const duration = Date.now() - startTime;
        
        // Add metric for failed RPC calls
        logger.metric("near_rpc_calls", fetchDuration, {
          result: "http_error",
          status_code: response.status,
          method: "block",
        });
        
        logErrorWithMetrics(
          "HTTP error from blockchain RPC",
          {
            ...baseContext,
            statusCode: response.status,
            statusText: response.statusText,
            duration
          },
          new Error(`HTTP error! status: ${response.status}`),
          "near_rpc_http_error",
          {
            result: "error",
            status_code: response.status,
            method: "block",
            duration
          }
        );

        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const parseStartTime = Date.now();
      const parsedJson = await response.json();
      const parseDuration = Date.now() - parseStartTime;

      logger.debugWithContext("RPC response parsed", {
        ...baseContext,
        parseDuration
      });

      if (parsedJson.error) {
        const duration = Date.now() - startTime;
        
        // Add metric for RPC errors
        logger.metric("near_rpc_errors", 1, {
          error_code: parsedJson.error.code || "unknown",
          method: "block",
        });
        
        logErrorWithMetrics(
          "RPC error response",
          {
            ...baseContext,
            rpcError: parsedJson.error.message,
            rpcErrorCode: parsedJson.error.code,
            duration
          },
          new Error(`Error 017: ${parsedJson.error.message}`),
          "near_rpc_error_response",
          {
            result: "error",
            error_code: parsedJson.error.code || "unknown",
            method: "block",
            duration
          }
        );

        throw new Error(`Error 017: ${parsedJson.error.message}`);
      }

      const timestamp = parsedJson.result?.header?.timestamp;
      const totalDuration = Date.now() - startTime;

      logger.infoWithContext("Blockchain timestamp fetched successfully", {
        ...baseContext,
        duration: totalDuration,
        fetchDuration,
        parseDuration,
        timestamp: timestamp || "0"
      });

      // Add metric for successful RPC calls
      logger.metric("near_rpc_calls", totalDuration, {
        result: "success",
        method: "block",
      });

      return timestamp ? timestamp.toString() : "0";
    } catch (error) {
      const duration = Date.now() - startTime;

      // Add metrics for timestamp errors
      logger.metric("near_rpc_timestamp_errors", 1, {
        error_type: error.name || "Unknown",
      });
      
      logErrorWithMetrics(
        "Error fetching blockchain timestamp",
        {
          ...baseContext,
          duration,
          rpcUrl: NEAR_RPC_URL
        },
        error,
        "near_rpc_timestamp",
        {
          result: "error",
          error_type: error.name || "Unknown",
          duration
        }
      );

      throw error;
    }
  }

  /**
   * Fetches a RODiT token by ID from the NEAR blockchain
   * 
   * @param {string} roditid - RODiT token ID to fetch
   * @returns {Promise<RODiT>} RODiT token object
   */
  async function nearorg_rpc_tokenfromroditid(roditid) {
    const requestId = ulid();
    const startTime = Date.now();
    
    const baseContext = createLogContext(
      "BlockchainService",
      "nearorg_rpc_tokenfromroditid",
      {
        requestId,
        roditId: roditid
      }
    );

    // Security check: Handle null, undefined, or invalid roditid
    // This is important for security tests that intentionally send invalid tokens
    if (!roditid) {
      logger.warnWithContext("Attempted to fetch RODiT with null/undefined ID", baseContext);
      
      // Return an empty RODiT object instead of throwing an error
      // This allows the authentication flow to continue and properly reject the invalid token
      return new RODiT();
    }

    logger.debugWithContext("Fetching RODiT token by ID", baseContext);

    try {
      const args = { token_id: roditid };
      const argsBase64 = Buffer.from(JSON.stringify(args)).toString("base64");

      const json_data = {
        jsonrpc: "2.0",
        id: CONSTANTS.NEAR_CONTRACT_ID,
        method: "query",
        params: {
          request_type: "call_function",
          finality: "final",
          account_id: CONSTANTS.NEAR_CONTRACT_ID,
          method_name: "rodit_token",
          args_base64: argsBase64,
        },
      };

      const fetchStartTime = Date.now();
      const response = await fetch(NEAR_RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json_data),
      });
      const fetchDuration = Date.now() - fetchStartTime;

      logger.debugWithContext("RPC response received", {
        ...baseContext,
        statusCode: response.status,
        fetchDuration
      });

      if (!response.ok) {
        const duration = Date.now() - startTime;
        
        // Add metric for failed RPC calls
        logger.metric("near_rpc_calls", fetchDuration, {
          result: "http_error",
          status_code: response.status,
          method: "rodit_token",
        });
        
        logErrorWithMetrics(
          "HTTP error from blockchain RPC",
          {
            ...baseContext,
            statusCode: response.status,
            duration
          },
          new Error(`HTTP error! status: ${response.status}`),
          "near_rpc_http_error",
          {
            result: "error",
            status_code: response.status,
            method: "rodit_token",
            duration
          }
        );

        return new RODiT();
      }

      const parseStartTime = Date.now();
      const responseText = await response.text();
      const parsedJson = JSON.parse(responseText);
      const parseDuration = Date.now() - parseStartTime;

      logger.debugWithContext("RPC response parsed", {
        ...baseContext,
        parseDuration,
        hasResult: !!parsedJson.result
      });

      if (parsedJson.result && parsedJson.result.error) {
        const duration = Date.now() - startTime;
        
        // Add metric for WASM errors
        logger.metric("near_rpc_wasm_errors", 1, {
          method: "rodit_token",
          rodit_id: roditid,
        });
        
        logErrorWithMetrics(
          "WASM execution error",
          {
            ...baseContext,
            wasmError: parsedJson.result.error,
            duration
          },
          new Error(`WASM execution error: ${parsedJson.result.error}`),
          "near_rpc_wasm_error",
          {
            method: "rodit_token",
            rodit_id: roditid,
            duration
          }
        );

        return new RODiT();
      }

      const resultArray = parsedJson.result.result;
      if (!Array.isArray(resultArray)) {
        const duration = Date.now() - startTime;
        
        // Add metric for format errors
        logger.metric("near_rpc_format_errors", 1, {
          method: "rodit_token",
          rodit_id: roditid,
          error_type: "invalid_array",
        });
        
        logErrorWithMetrics(
          "Invalid result format",
          {
            ...baseContext,
            resultType: typeof resultArray,
            duration
          },
          new Error("Result is not an array"),
          "near_rpc_format_error",
          {
            method: "rodit_token",
            rodit_id: roditid,
            error_type: "invalid_array",
            duration
          }
        );

        return new RODiT();
      }

      const decodeStartTime = Date.now();
      const resultString = new TextDecoder().decode(new Uint8Array(resultArray));
      let parsed;
      
      try {
        parsed = JSON.parse(resultString);
      } catch (error) {
        logErrorWithMetrics(
          "Failed to parse RODiT data",
          {
            ...baseContext,
            error: error.message
          },
          error,
          "rodit_parse_error",
          {
            error_type: error.name || "Unknown",
            rodit_id: roditid
          }
        );
        return new RODiT();
      }
      
      const decodeDuration = Date.now() - decodeStartTime;

      logger.debugWithContext("RODiT data decoded", {
        ...baseContext,
        decodeDuration,
        hasTokenId: parsed && !!parsed.token_id
      });

      const rodit = new RODiT();
      if (parsed) {
        Object.assign(rodit, parsed);
      }

      const totalDuration = Date.now() - startTime;
      const hasValidData = !!rodit.token_id && !!rodit.owner_id;

      logger.infoWithContext("RODiT token fetched", {
        ...baseContext,
        duration: totalDuration,
        retrieved: hasValidData,
        fetchDuration,
        parseDuration,
        decodeDuration
      });

      // Add metrics for successful RPC calls
      logger.metric("near_rpc_calls", totalDuration, {
        result: "success",
        method: "rodit_token",
        data_found: hasValidData ? "true" : "false",
      });

      return rodit;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Add metrics for token fetch errors
      logger.metric("near_rpc_token_errors", 1, {
        error_type: error.name || "Unknown",
        rodit_id: roditid,
      });
      
      logErrorWithMetrics(
        "Failed to fetch RODiT token",
        {
          ...baseContext,
          duration
        },
        error,
        "near_rpc_token_fetch",
        {
          result: "error",
          error_type: error.name || "Unknown",
          rodit_id: roditid,
          duration
        }
      );

      return new RODiT();
    }
  }

  /**
   * Checks account state on the blockchain
   * 
   * @param {string} accountId - Account ID to check
   * @returns {Promise<boolean>} Whether the account exists
   */
  async function nearorg_rpc_state(accountId) {
    const requestId = ulid();
    const startTime = Date.now();
    
    const baseContext = createLogContext(
      "BlockchainService",
      "nearorg_rpc_state",
      {
        requestId,
        accountId,
        contractId: CONSTANTS.NEAR_CONTRACT_ID
      }
    );

    logger.debugWithContext("Checking account state on blockchain", baseContext);

    try {
      const jsonData = {
        jsonrpc: "2.0",
        id: CONSTANTS.NEAR_CONTRACT_ID,
        method: "query",
        params: {
          request_type: "view_account",
          finality: "final",
          account_id: accountId,
        },
      };

      logger.debugWithContext("Sending RPC request for account state", {
        ...baseContext,
        rpcMethod: "view_account"
      });

      const response = await fetch(NEAR_RPC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(jsonData),
      });

      const responseText = await response.json();

      if (JSON.stringify(responseText).includes("does not exist while viewing")) {
        const duration = Date.now() - startTime;

        logger.warnWithContext("Account does not exist in blockchain", {
          ...baseContext,
          duration,
          needsFunding: true
        });

        // Emit metrics for Grafana dashboards
        logger.metric("account_state_check_duration_ms", duration, {
          component: "BlockchainService",
          success: true,
          accountExists: false,
        });
        logger.metric("non_existent_accounts_total", 1, {
          component: "BlockchainService",
          accountId,
        });

        return false;
      }

      const duration = Date.now() - startTime;
      logger.debugWithContext("Account state verification complete", {
        ...baseContext,
        duration,
        accountExists: true
      });

      // Emit metrics for Grafana dashboards
      logger.metric("account_state_check_duration_ms", duration, {
        component: "BlockchainService",
        success: true,
        accountExists: true,
      });

      return true;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Emit metrics for Grafana dashboards
      logger.metric("account_state_check_duration_ms", duration, {
        component: "BlockchainService",
        success: false,
        error: error.constructor.name,
      });
      logger.metric("blockchain_rpc_errors_total", 1, {
        component: "BlockchainService",
        method: "account_state",
        error: error.constructor.name,
      });
      
      logErrorWithMetrics(
        "Failed to check account state",
        {
          ...baseContext,
          duration
        },
        error,
        "account_state_check",
        {
          result: "error",
          error_type: error.constructor.name,
          duration
        }
      );

      throw error;
    }
  }

  /**
   * Fetches RODiT tokens for an account
   * 
   * @param {string} account_id - Account ID to fetch tokens for
   * @returns {Promise<RODiT>} First RODiT token for the account
   */
  async function nearorg_rpc_tokensfromaccountid(account_id) {
    const requestId = ulid();
    const startTime = Date.now();
    
    const baseContext = createLogContext(
      "BlockchainService",
      "nearorg_rpc_tokensfromaccountid",
      {
        requestId,
        accountId: account_id,
        contractId: CONSTANTS.NEAR_CONTRACT_ID
      }
    );

    logger.debugWithContext("Fetching RODiT tokens for account", baseContext);

    try {
      const args = JSON.stringify({
        account_id: account_id,
        from_index: null,
        limit: null,
      });

      const jsonData = {
        jsonrpc: "2.0",
        id: CONSTANTS.NEAR_CONTRACT_ID,
        method: "query",
        params: {
          request_type: "call_function",
          finality: "final",
          account_id: CONSTANTS.NEAR_CONTRACT_ID,
          method_name: "rodit_tokens_for_owner",
          args_base64: Buffer.from(args).toString("base64"),
        },
      };

      logger.debugWithContext("Sending RPC request for account tokens", {
        ...baseContext,
        rpcMethod: "rodit_tokens_for_owner"
      });

      const response = await fetch(NEAR_RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jsonData),
      });

      const responseText = await response.text();
      const parsedJson = JSON.parse(responseText);

      if (parsedJson.result && parsedJson.result.error) {
        const duration = Date.now() - startTime;

        // Emit metrics for Grafana dashboards
        logger.metric("account_tokens_fetch_duration_ms", duration, {
          component: "BlockchainService",
          success: false,
          error: "WASM_ERROR",
        });
        logger.metric("blockchain_rpc_errors_total", 1, {
          component: "BlockchainService",
          method: "tokens_from_account",
          error: "WASM_ERROR",
        });
        
        logErrorWithMetrics(
          "WASM execution error",
          {
            ...baseContext,
            duration,
            wasmError: parsedJson.result.error
          },
          new Error(`Smart contract execution failed: ${parsedJson.result.error}`),
          "account_tokens_fetch",
          {
            result: "error",
            error_type: "WASM_ERROR",
            duration
          }
        );

        throw new Error(
          `Smart contract execution failed: ${parsedJson.result.error}`
        );
      }

      const resultArray = parsedJson.result.result;
      if (!Array.isArray(resultArray)) {
        const duration = Date.now() - startTime;

        // Emit metrics for Grafana dashboards
        logger.metric("account_tokens_fetch_duration_ms", duration, {
          component: "BlockchainService",
          success: false,
          error: "INVALID_RESULT_FORMAT",
        });
        logger.metric("blockchain_rpc_errors_total", 1, {
          component: "BlockchainService",
          method: "tokens_from_account",
          error: "INVALID_RESULT_FORMAT",
        });
        
        logErrorWithMetrics(
          "Invalid result format from blockchain",
          {
            ...baseContext,
            duration,
            resultType: typeof resultArray
          },
          new Error("Result is not an array"),
          "account_tokens_fetch",
          {
            result: "error",
            error_type: "INVALID_RESULT_FORMAT",
            duration
          }
        );

        throw new Error("Result is not an array");
      }

      const resultString = new TextDecoder().decode(new Uint8Array(resultArray));
      const resultStruct = JSON.parse(resultString);

      if (!Array.isArray(resultStruct) || resultStruct.length === 0) {
        const duration = Date.now() - startTime;

        logger.warnWithContext("No RODiT instances found for account", {
          ...baseContext,
          duration,
          tokenCount: 0
        });

        // Emit metrics for Grafana dashboards
        logger.metric("account_tokens_fetch_duration_ms", duration, {
          component: "BlockchainService",
          success: true,
          tokenCount: 0,
        });
        logger.metric("empty_account_tokens_total", 1, {
          component: "BlockchainService",
          accountId: account_id,
        });

        const emptyRodit = new RODiT();
        return emptyRodit;
      }

      const rodit = new RODiT();
      Object.assign(rodit, resultStruct[0]);

      const duration = Date.now() - startTime;
      logger.debugWithContext("Successfully retrieved RODiT tokens", {
        ...baseContext,
        duration,
        tokenCount: resultStruct.length,
        firstTokenId: rodit.token_id
      });

      // Emit metrics for Grafana dashboards
      logger.metric("account_tokens_fetch_duration_ms", duration, {
        component: "BlockchainService",
        success: true,
        tokenCount: resultStruct.length,
      });

      return rodit;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Emit metrics for Grafana dashboards
      logger.metric("account_tokens_fetch_duration_ms", duration, {
        component: "BlockchainService",
        success: false,
        error: error.constructor.name,
      });
      logger.metric("blockchain_rpc_errors_total", 1, {
        component: "BlockchainService",
        method: "tokens_from_account",
        error: error.constructor.name,
      });
      
      logErrorWithMetrics(
        "Failed to fetch RODiT tokens",
        {
          ...baseContext,
          duration
        },
        error,
        "account_tokens_fetch",
        {
          result: "error",
          error_type: error.constructor.name,
          duration
        }
      );

      throw error;
    }
  }

  /**
   * Fetches a public key in bytes format for an account
   * 
   * @param {string} accountId - Account ID
   * @returns {Promise<Uint8Array>} Public key bytes
   */
  async function nearorg_rpc_fetchpublickeybytes(accountId) {
    const requestId = ulid();
    const startTime = Date.now();
    
    const baseContext = createLogContext(
      "BlockchainService",
      "nearorg_rpc_fetchpublickeybytes",
      {
        requestId,
        accountId
      }
    );

    logger.debugWithContext("Fetching public key bytes", baseContext);

    try {
      const isImplicitAccount = /^[0-9a-f]{64}$/.test(accountId);

      if (isImplicitAccount) {
        logger.debugWithContext("Account is implicit, using direct hex encoding", baseContext);

        const result = new Uint8Array(Buffer.from(accountId, "hex"));

        const duration = Date.now() - startTime;
        logger.debugWithContext(
          "Successfully retrieved public key bytes from implicit account",
          {
            ...baseContext,
            duration,
            keyLength: result.length
          }
        );

        // Emit metrics for Grafana dashboards
        logger.metric("public_key_fetch_duration_ms", duration, {
          method: "direct_hex",
          component: "BlockchainService",
          success: true,
        });

        return result;
      }

      logger.debugWithContext("Account is named, fetching RODiT token", baseContext);

      const rodit = await this.nearorg_rpc_tokensfromaccountid(
        CONSTANTS.NEAR_CONTRACT_ID,
        accountId
      );

      if (!rodit || !rodit.owner_id) {
        const duration = Date.now() - startTime;
        
        // Emit metrics for Grafana dashboards
        logger.metric("public_key_fetch_duration_ms", duration, {
          method: "rodit_lookup",
          component: "BlockchainService",
          success: false,
          error: "NO_VALID_RODIT",
        });
        logger.metric("public_key_fetch_errors_total", 1, {
          method: "rodit_lookup",
          component: "BlockchainService",
          error: "NO_VALID_RODIT",
        });
        
        logErrorWithMetrics(
          "No valid RODiT found for account",
          {
            ...baseContext,
            duration,
            error: "NO_VALID_RODIT"
          },
          new Error(`No valid RODiT found for account: ${accountId}`),
          "public_key_fetch",
          {
            result: "error",
            error_type: "NO_VALID_RODIT",
            method: "rodit_lookup",
            duration
          }
        );

        throw new Error(`No valid RODiT found for account: ${accountId}`);
      }

      const result = new Uint8Array(Buffer.from(rodit.owner_id, "hex"));

      const duration = Date.now() - startTime;
      logger.debugWithContext("Successfully retrieved public key bytes from RODiT", {
        ...baseContext,
        duration,
        keyLength: result.length
      });

      // Emit metrics for Grafana dashboards
      logger.metric("public_key_fetch_duration_ms", duration, {
        method: "rodit_lookup",
        component: "BlockchainService",
        success: true,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Emit metrics for Grafana dashboards
      logger.metric("public_key_fetch_duration_ms", duration, {
        component: "BlockchainService",
        success: false,
        error: error.constructor.name,
      });
      logger.metric("public_key_fetch_errors_total", 1, {
        component: "BlockchainService",
        error: error.constructor.name,
      });
      
      logErrorWithMetrics(
        "Failed to fetch public key bytes",
        {
          ...baseContext,
          duration
        },
        error,
        "public_key_fetch",
        {
          result: "error",
          error_type: error.constructor.name,
          duration
        }
      );

      throw new Error(`Error retrieving public key: ${error.message}`);
    }
  }

  module.exports = {
    RODiT,
    PayloadNEP413,
    PayloadNEP413Schema,
    CONSTANTS,
    nearorg_rpc_timestamp,
    nearorg_rpc_tokenfromroditid,
    nearorg_rpc_state,
    nearorg_rpc_tokensfromaccountid,
    nearorg_rpc_fetchpublickeybytes
  };