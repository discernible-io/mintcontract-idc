/**
 * RODiT Authentication System
 * 
 * This module exports the core authentication functions directly from their source files.
 * It provides a simple interface for using the RODiT authentication system without adding
 * unnecessary abstraction layers.
 * 
 * Copyright (c) 2025 Rodit Technologies Inc. All rights reserved.
 */

// Import authentication middleware functions
const { 
  authenticate_apicall,
  login_client,
  logout_client,
  login_client_withnep413
} = require('./lib/middleware/authenticationmw');

// Import token service functions
const {
  validate_jwt_token_be,
  generate_jwt_token
} = require('./lib/auth/tokenservice');

// Import permission validation - direct function import
const validatePermissions = require('./lib/middleware/validatepermissions');

// Import session management
const { sessionManager } = require('./lib/auth/sessionmanager');

// Import blockchain services
const blockchainService = require('./lib/blockchain/blockchainservice');
const stateManager = require('./lib/blockchain/statemanager');

// Import webhook functionality directly
const webhookHandler = require('./lib/webhook/webhookhandler');
// Note: eventHandler has been consolidated into webhookhandler.js

// Import versioning functionality
const { versioningMiddleware } = require('./lib/middleware/versioningmw');
const { versionManager, VersionManager } = require('./lib/versioning/versionmanager');

// Simple export of the authentication system
module.exports = {
  // Core middleware functions
  authenticate: authenticate_apicall,
  validatePermissions,
  
  // Authentication handlers
  login: login_client,
  logout: logout_client,
  loginWithNEP413: login_client_withnep413,
  
  // Original function names for backward compatibility
  authenticate_apicall,
  login_client,
  logout_client,
  login_client_withnep413,
  
  // Token functions
  validateToken: validate_jwt_token_be,
  generateToken: generate_jwt_token,
  
  // Services
  sessionManager,
  blockchainService,
  stateManager,
  
  // Webhook functionality
  webhook: {
    // Export all webhook handler functionality
    ...webhookHandler
    // Note: eventHandler functionality is now part of webhookHandler
  },
  
  // Versioning functionality
  versioning: {
    middleware: versioningMiddleware,
    manager: versionManager,
    VersionManager
  },
  
  // Configuration helper
  configure: (config) => {
    // Store configuration in state manager for access by all components
    if (config) {
      stateManager.setConfig(config);
      
      // Configure versioning if specified
      if (config.apiVersion) {
        versionManager.setVersion(config.apiVersion);
      }
      
      if (config.versionHeaderType) {
        versionManager.setHeaderType(config.versionHeaderType);
      }
    }
    return module.exports;
  }
};

