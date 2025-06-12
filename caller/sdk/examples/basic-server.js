/**
 * Basic Express server with RODiT authentication
 * 
 * This example demonstrates how to use the RODiT authentication system
 * in an Express.js application.
 * 
 * Copyright (c) 2025 Rodit Technologies Inc. All rights reserved.
 */

const express = require('express');
const { ulid } = require('ulid');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const logger = require('../services/logger');

// Import rate limiting middleware
// In a real app, this would be: const ratelimitmw = require('rodit-auth/lib/middleware/ratelimit');
// For this example, we'll define a simple version inline
const ratelimitmw = (maxRequests, windowSeconds) => {
  const requests = {};
  
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    // Initialize or clean up old requests
    if (!requests[ip]) {
      requests[ip] = [];
    } else {
      requests[ip] = requests[ip].filter(time => now - time < windowSeconds * 1000);
    }
    
    // Check if rate limit is exceeded
    if (requests[ip].length >= maxRequests) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        requestId: req.requestId
      });
    }
    
    // Add current request timestamp
    requests[ip].push(now);
    next();
  };
};

// In a real application, you would use the npm package
// const auth = require('rodit-auth');
// For this example, we're using the local package
const auth = require('../index');

// Example of client-side versioning setup
// Configure the version manager with specific version
auth.versioning.manager.setVersion('1.1.0');
// Choose header type: 'accept', 'custom', or 'both'
auth.versioning.manager.setHeaderType('both');

// Swagger API documentation setup
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "RODiT Authentication API Example",
      version: "1.0.0",
      description: "Example API using RODiT authentication system",
      contact: {
        name: "Rodit Technologies Inc.",
        url: "https://example.com",
      },
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development server",
      },
    ],
  },
  apis: ["./examples/basic-server.js"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Create Express app
const app = express();

// Default rate limits - will be updated from RODiT metadata
let ratelimiter = ratelimitmw(100, 15);

// Configure middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// API versioning middleware
// This middleware will parse version information from headers
// and make it available as req.apiVersion and req.apiMajorVersion
app.use(auth.versioning.middleware({
  strict: false // Set to true to reject requests with unsupported versions
}));

// Example middleware that uses API version for different behavior
app.use((req, res, next) => {
  // Log the API version being used
  logger.infoWithContext('API version detected', { 
    version: req.apiVersion,
    majorVersion: req.apiMajorVersion,
    requestId: req.requestId
  });
  
  // You can conditionally apply different logic based on version
  if (req.apiMajorVersion === 1) {
    // v1.x.x specific behavior
  } else if (req.apiMajorVersion === 2) {
    // v2.x.x specific behavior
  }
  
  next();
});

// Setup webhook handling - this would typically be in a separate file
// Create webhook raw body parser for signature verification
const webhookBodyParser = auth.webhook.createRawBodyParser();

// Create webhook flag middleware to mark routes as webhook endpoints
const webhookFlagMiddleware = auth.webhook.createWebhookFlagMiddleware();

// Create webhook public key middleware
const webhookPublicKeyMiddleware = auth.webhook.createPublicKeyMiddleware(auth.stateManager);

// Create webhook authentication middleware
const webhookAuthMiddleware = auth.webhook.createWebhookAuthenticationMiddleware();

// Create a webhook event handler factory
const webhookEventHandlerFactory = new auth.webhook.WebhookEventHandlerFactory({
  // Mock dependencies for demonstration
  configManager: {
    updateConfig: async (config) => {
      logger.infoWithContext('Config update', { config });
      return true;
    }
  },
  runTestSuite: async (apiEndpoint, suiteName) => {
    logger.infoWithContext(`Running test suite`, { suiteName, apiEndpoint });
    return { success: true };
  },
  runSingleTest: async (apiEndpoint, suiteName, testName) => {
    logger.infoWithContext(`Running test`, { testName, suiteName, apiEndpoint });
    return { success: true };
  }
});

// Setup Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Performance monitoring middleware (simplified version)
app.use((req, res, next) => {
  req.startTime = Date.now();
  req.requestId = req.headers['x-request-id'] || ulid();
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    logger.infoWithContext(`Request completed`, { method: req.method, path: req.path, statusCode: res.statusCode, duration: `${duration}ms` });
  });
  next();
});

// Use the imported logger directly - no need for a wrapper

// Apply rate limiting to all routes
app.use((req, res, next) => ratelimiter(req, res, next));

// Action logging middleware - tracks user actions
app.use((req, res, next) => {
  if (req.logAction) {
    logger.infoWithContext(`Action executed`, {
      action: req.logAction,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: req.user ? req.user.id : "anonymous"
    });
  }
  next();
});

/**
 * @swagger
 * /:
 *   get:
 *     summary: Welcome page
 *     description: Returns information about available endpoints
 *     responses:
 *       200:
 *         description: Welcome message and endpoint information
 */
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the RODiT authentication example',
    endpoints: {
      login: 'POST /api/login',
      logout: 'POST /api/logout',
      protected: 'GET /api/protected',
      entities: 'GET /api/entities/:entityId'
    }
  });
});

// Authentication routes

/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: User login
 *     description: Authenticate using RODiT credentials
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roditid
 *               - roditid_base64url_signature
 *             properties:
 *               roditid:
 *                 type: string
 *                 description: RODiT ID
 *               timestamp:
 *                 type: integer
 *                 description: Current timestamp (optional)
 *               roditid_base64url_signature:
 *                 type: string
 *                 description: Base64URL signature
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Authentication failed
 */
app.post('/api/login', (req, res) => {
  req.logAction = "login-attempt";
  logger.infoWithContext("Login request received", {
    component: "API",
    method: "login",
    requestId: req.requestId,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  auth.login(req, res);
});

/**
 * @swagger
 * /api/logout:
 *   post:
 *     summary: User logout
 *     description: Invalidate the current session
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Not authenticated
 */
app.post('/api/logout', auth.authenticate, (req, res) => {
  req.logAction = "logout-attempt";
  auth.logout(req, res);
});

/**
 * @swagger
 * /api/protected:
 *   get:
 *     summary: Protected route
 *     description: Example of a protected route that requires authentication
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Protected resource
 *       401:
 *         description: Not authenticated
 */
app.get('/api/protected', auth.authenticate, (req, res) => {
  logger.infoWithContext("Protected route accessed", {
    component: "API",
    method: "getProtected",
    requestId: req.requestId,
    userId: req.user.id || req.user.roditId
  });
  
  res.json({
    message: 'This is a protected route',
    user: {
      id: req.user.id,
      roditId: req.user.roditId
    }
  });
});

// Function to update rate limits based on RODiT metadata
function updateRateLimit(maxRequests, maxRqWindow) {
  ratelimiter = ratelimitmw(maxRequests, maxRqWindow);
  logger.infoWithContext("Rate limit settings updated", { 
    maxRequests: maxRequests, 
    windowDuration: maxRqWindow 
  });
}

/**
 * @swagger
 * /api/version:
 *   get:
 *     summary: Get API version information
 *     description: Returns information about the current API version and supported versions
 *     responses:
 *       200:
 *         description: Version information
 */
app.get('/api/version', (req, res) => {
  res.json({
    currentVersion: req.apiVersion,
    supportedVersions: auth.versioning.middleware.AVAILABLE_VERSIONS,
    deprecatedVersions: auth.versioning.middleware.DEPRECATED_VERSIONS,
    clientRequestedVersion: req.headers['x-api-version'] || req.headers['accept'],
    versionDetectionMethod: req.headers['x-api-version'] ? 'custom-header' : 
                           (req.headers['accept'] && req.headers['accept'].includes('vnd.rodit')) ? 'accept-header' : 'default'
  });
});

/**
 * @swagger
 * /api/client-example:
 *   get:
 *     summary: Example of client-side version header usage
 *     description: Shows how to make API requests with version headers
 *     responses:
 *       200:
 *         description: Example code
 */
app.get('/api/client-example', (req, res) => {
  // Example code to show in the response
  const exampleCode = `
  // Example 1: Using the SDK's built-in version manager
  const { RoditClient } = require('@cableguard/rodit-sdk');
  
  // Initialize client with version information
  const client = new RoditClient({
    apiVersion: '1.1.0',
    versionHeaderType: 'both' // 'accept', 'custom', or 'both'
  });
  
  await client.init();
  
  // All API requests will automatically include version headers
  const response = await client.request('GET', '/api/data');
  
  
  // Example 2: Manual version header application
  const headers = {
    'Accept': 'application/vnd.rodit.v1.1.0+json',
    'X-API-Version': '1.1.0'
  };
  
  const response = await fetch('https://api.example.com/data', {
    headers
  });
  `;
  
  res.json({
    message: 'Example of client-side version header usage',
    exampleCode,
    note: 'This shows how to include version headers in API requests'
  });
});

/**
 * @swagger
 * /api/entities/{entityId}:
 *   get:
 *     summary: Get entity by ID
 *     description: Example of a protected route with permission validation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: entityId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the entity to retrieve
 *     responses:
 *       200:
 *         description: Entity data
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Permission denied
 *       429:
 *         description: Rate limit exceeded
 */
app.get('/api/entities/:entityId', auth.authenticate, auth.validatePermissions, (req, res) => {
  const entityId = req.params.entityId;
  
  logger.infoWithContext("Entity accessed", {
    component: "API",
    method: "getEntity",
    requestId: req.requestId,
    userId: req.user.id || req.user.roditId,
    entityId,
    permissionScope: req.permissionScope
  });
  
  // In a real implementation, this data would come from the blockchain-sourced RODiT
  // We're just showing the structure of the response here
  
  res.json({
    message: 'Entity retrieved successfully',
    entityId,
    permissionScope: req.permissionScope,
    note: 'In a real implementation, the following values would come from the blockchain-sourced RODiT',
    user: {
      id: req.user.id,
      roditId: req.user.roditId
    }
  });
});

// Enhanced error handling middleware
app.use((err, req, res, next) => {
  logger.errorWithContext(
    "Server error occurred",
    {
      method: req.method,
      url: req.originalUrl,
      userIP: req.ip,
      userId: req.user ? req.user.id : "anonymous",
      errorCode: "106",
      route: req.route ? req.route.path : "unknown",
      requestId: req.requestId
    },
    err // Pass the error object directly
  );
  
  res.status(500).json({ 
    error: "Error 106: Internal Server Error",
    requestId: req.requestId
  });
});

// Store server instance for graceful shutdown
let server;

// Example of version-specific route handlers

/**
 * @swagger
 * /api/feature:
 *   get:
 *     summary: Version-specific feature endpoint
 *     description: Demonstrates different behavior based on API version
 *     responses:
 *       200:
 *         description: Feature response
 */
app.get('/api/feature', (req, res) => {
  // Example of version-specific behavior
  if (req.apiVersion === '1.0.0') {
    return res.json({
      version: '1.0.0',
      features: ['basic-auth', 'data-retrieval'],
      deprecated: true,
      message: 'This version will be discontinued on 2025-12-31'
    });
  } else if (req.apiVersion === '1.1.0') {
    return res.json({
      version: '1.1.0',
      features: ['basic-auth', 'data-retrieval', 'advanced-filtering'],
      deprecated: false
    });
  } else if (req.apiVersion.startsWith('2.')) {
    return res.json({
      version: req.apiVersion,
      features: ['basic-auth', 'data-retrieval', 'advanced-filtering', 'real-time-updates', 'webhooks'],
      beta: true
    });
  }
  
  // Default response
  res.json({
    version: req.apiVersion,
    features: ['basic-auth', 'data-retrieval']
  });
});

// Start the server with proper initialization
async function startServer() {
  try {
    // Log server startup
    logger.info("Server starting", {
      component: "AppLifecycle",
      startTime: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV || 'development',
      pid: process.pid
    });
    // In a real implementation, this would initialize the RODiT configuration from blockchain
    // For this example, we'll just log what would happen
    logger.infoWithContext("Initializing RODiT configuration", {
      component: "AppLifecycle",
      status: "initializing"
    });
        
    // Start the HTTP server
    const PORT = process.env.PORT || 3000;
    server = app.listen(PORT, () => {
      logger.infoWithContext("Server started", {
        port: PORT,
        env: process.env.NODE_ENV || "development",
        protocol: "http",
        swagger: "http://localhost:" + PORT + "/api-docs"
      });
      
      logger.info(`\nRODiT authentication example server running on port ${PORT}`);
      
      const endpoints = [
        '  GET  / - Public welcome page',
        '  POST /api/login - Login with RODiT credentials',
        '  POST /api/logout - Logout (requires authentication)',
        '  GET  /api/protected - Protected route (requires authentication)',
        '  GET  /api/entities/:entityId - Protected route with permission validation',
        '  GET  /api-docs - Swagger API documentation'
      ];
      
      const loginInstructions = [
        '  - roditid: Your RODiT ID',
        '  - timestamp: Current timestamp (optional)',
        '  - roditid_base64url_signature: Base64URL signature'
      ];
      
      const configInfo = [
        '  - All configuration values are automatically extracted from the blockchain-sourced RODiT',
        '  - No manual configuration is needed as values come directly from the blockchain'
      ];
      
      logger.info('Available endpoints:');
      endpoints.forEach(endpoint => logger.info(endpoint));
      
      logger.info('\nTo login, send a POST request to /api/login with:');
      loginInstructions.forEach(instruction => logger.info(instruction));
      
      logger.info('\nRODiT Configuration:');
      configInfo.forEach(info => logger.info(info));
    });
    
    // Graceful shutdown handling
    process.on("SIGTERM", gracefulShutdown);
    process.on("SIGINT", gracefulShutdown);
    
  } catch (error) {
    logger.errorWithContext("Server initialization failed", {
      component: "AppLifecycle",
      error: error.message
    }, error);
    process.exit(1);
  }
}

// Graceful shutdown function
function gracefulShutdown() {
  logger.infoWithContext("Shutting down gracefully", {
    component: "AppLifecycle",
    time: new Date().toISOString()
  });
  
  if (server) {
    server.close(() => {
      logger.infoWithContext("Server closed", {
        component: "AppLifecycle",
        time: new Date().toISOString()
      });
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

/**
 * @swagger
 * /api/webhooks:
 *   post:
 *     summary: Webhook endpoint
 *     description: Receives and processes webhook events
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - event
 *               - data
 *             properties:
 *               event:
 *                 type: string
 *                 description: Event type
 *               data:
 *                 type: object
 *                 description: Event data
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       400:
 *         description: Invalid webhook payload
 *       401:
 *         description: Webhook authentication failed
 */
app.post('/api/webhooks',
  // Apply webhook-specific middleware
  webhookBodyParser,
  webhookFlagMiddleware,
  webhookPublicKeyMiddleware,
  webhookAuthMiddleware,
  async (req, res) => {
    const requestId = req.requestId || ulid();
    const logContext = {
      requestId,
      endpoint: req.path,
      method: req.method,
      component: 'WebhookHandler'
    };
    
    try {
      // Extract the event from the request
      const event = auth.webhook.processWebhookEvent(req, logContext);
      
      if (!event || !event.event) {
        logger.warnWithContext('Invalid webhook event format', logContext);
        return res.status(400).json({
          success: false,
          error: 'Invalid webhook event format'
        });
      }
      
      logger.infoWithContext(`Processing webhook event: ${event.event}`, {
        ...logContext,
        eventType: event.event
      });
      
      // Handle the event using the factory
      const result = await webhookEventHandlerFactory.handleEvent(event, req, res);
      
      return res.status(200).json({
        success: true,
        message: `Webhook ${event.event} processed successfully`,
        result
      });
    } catch (error) {
      logger.errorWithContext('Error processing webhook', {
        ...logContext,
        error: error.message
      });
      
      return res.status(500).json({
        success: false,
        error: 'Error processing webhook',
        message: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/send-webhook:
 *   post:
 *     summary: Send a webhook notification
 *     description: Sends a webhook notification to a configured endpoint
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - event
 *               - data
 *             properties:
 *               event:
 *                 type: string
 *                 description: Event type
 *               data:
 *                 type: object
 *                 description: Event data
 *     responses:
 *       200:
 *         description: Webhook sent successfully
 *       400:
 *         description: Invalid webhook payload
 */
app.post('/api/send-webhook', auth.authenticate, async (req, res) => {
  const requestId = req.requestId || ulid();
  const logContext = {
    requestId,
    endpoint: req.path,
    method: req.method,
    component: 'WebhookSender',
    userId: req.user ? req.user.id : 'anonymous'
  };
  
  try {
    const { event, data } = req.body;
    
    if (!event || !data) {
      logger.warnWithContext('Invalid webhook payload', logContext);
      return res.status(400).json({
        success: false,
        error: 'Invalid webhook payload'
      });
    }
    
    logger.infoWithContext(`Sending webhook event: ${event}`, {
      ...logContext,
      eventType: event
    });
    
    // In a real application, this would send to an actual endpoint
    // For this example, we'll mock the webhook sending
    const result = await auth.webhook.send_webhook(event, data, false, false, req);
    
    return res.status(200).json({
      success: true,
      message: `Webhook ${event} sent successfully`,
      requestId: result.requestId
    });
  } catch (error) {
    logger.errorWithContext('Error sending webhook', {
      ...logContext,
      error: error.message
    });
    
    return res.status(500).json({
      success: false,
      error: 'Error sending webhook',
      message: error.message
    });
  }
});

// Start the server
startServer();

// Export for testing purposes
module.exports = { app, startServer };
