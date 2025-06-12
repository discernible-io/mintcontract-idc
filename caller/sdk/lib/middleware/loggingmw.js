/**
 * Request logging middleware
 * Provides standardized request/response logging
 * Copyright (c) 2024 Ayayai, Inc. All rights reserved.
 */

const logger = require("../../services/logger");
const config = require("config");

/**
 * Middleware for logging requests and responses
 * This middleware should be applied after the performance middleware
 * to leverage the request ID and timing information.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const loggingmw = (req, res, next) => {
  // Ensure we have a request ID (should be set by performance middleware)
  if (!req.requestId) {
    const { ulid } = require("ulid");
    req.requestId = ulid();
  }

  // Capture the original end function
  const originalEnd = res.end;

  // Override the end function
  res.end = function (chunk, encoding) {
    // Call the original end function
    originalEnd.call(this, chunk, encoding);

    // Now log after the response has been sent
    // Use duration from performance middleware if available
    const duration = req.duration || (req.startTime ? Date.now() - req.startTime : null);
    
    // Standard request log entry
    logger.info("Request completed", {
      component: "API",
      method: req.method,
      clientIP: req.ip,
      userId: req.user ? req.user.id : null,
      roditId: req.user ? req.user.roditId : null,
      authenticated: !!req.user,
      url: req.originalUrl,
      service: req.logService || "unspecified service",
      action: req.logAction || req.requestType || "unspecified action",
      resource: res.itemid,
      status: res.statusCode,
      statusMessage: res.statusReason || res.statusMessage,
      requestId: req.requestId,
      traceId: req.traceId,
      timestamp: new Date().toISOString(),
      duration,
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer')
    });
  };

  // Log the incoming request
  logger.debug("Request received", {
    component: "API",
    method: req.method,
    url: req.originalUrl,
    clientIP: req.ip,
    requestId: req.requestId,
    timestamp: new Date().toISOString()
  });

  next();
};

module.exports = loggingmw;
