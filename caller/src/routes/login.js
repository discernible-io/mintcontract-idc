const express = require("express");
const router = express.Router();
const { ulid } = require("ulid");
const logger = require("../../sdk/services/logger");
const { createLogContext, logErrorWithMetrics } = logger;
const { login_client } = require("../../sdk/lib/middleware/authenticationmw");

// Handling login request
router.post("/login", (req, res) => {
  const requestId = req.headers['x-request-id'] || ulid();
  const startTime = Date.now();
  req.logAction = "login-attempt";
  req.requestId = requestId; // Set requestId for downstream handlers
  
  const baseContext = createLogContext({
    requestId,
    component: 'LoginRoutes',
    method: 'login',
    endpoint: '/api/login',
    httpMethod: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    headers: Object.keys(req.headers),
    bodyKeys: Object.keys(req.body || {}),
    bodySize: req.body ? JSON.stringify(req.body).length : 0
  });
  
  logger.debugWithContext("Processing login request", baseContext);
  
  try {
    // Add a wrapper to capture timing and errors
    const originalEnd = res.end;
    res.end = function(...args) {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;
      const isSuccess = statusCode >= 200 && statusCode < 300;
      
      if (isSuccess) {
        logger.infoWithContext("Login request processed successfully", {
          ...baseContext,
          statusCode,
          duration
        });
        
        // Add metric for successful operation
        logger.metric('auth_operations', duration, {
          operation: 'login',
          result: 'success',
          statusCode
        });
      } else {
        logger.warnWithContext("Login request failed", {
          ...baseContext,
          statusCode,
          duration
        });
        
        // Add metric for failed operation
        logger.metric('auth_operations', duration, {
          operation: 'login',
          result: 'failure',
          statusCode
        });
      }
      
      originalEnd.apply(this, args);
    };
    
    // Pass to the login_client handler directly
    login_client(req, res);
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logErrorWithMetrics(
      'Error processing login request',
      {
        ...baseContext,
        duration
      },
      error,
      'auth_error',
      {
        operation: 'login',
        result: 'error',
        duration
      }
    );
    
    res.status(500).json({
      error: 'Failed to process login request',
      message: 'An internal server error occurred',
      requestId
    });
  }
});

module.exports = router;