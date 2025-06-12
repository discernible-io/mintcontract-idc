/**
 * RODiT Authentication API Server
 * 
 * This application demonstrates the implementation of RODiT-based authentication
 * using the RODiT Authentication SDK.
 * 
 * Copyright (c) 2025 Rodit Technologies Inc. All rights reserved.
 */

const express = require('express');
const { ulid } = require('ulid');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const config = require('config');

// Import the unified auth module from SDK
// In a real app with npm package, this would be: const auth = require('rodit-auth');
const auth = require('../sdk');

// Import logger from config
const logger = require('../sdk/lib/serviceslogger');

// Import required services
const roditManager = require('../sdk/lib/auth/roditmanager');
const stateManager = require('../sdk/lib/blockchain/statemanager');

// Import routes
const echoprotectedRoute = require('./protected/echo');
const crudaprotectedRoute = require('./protected/cruda');
const signclientRoute = require('./routes/signclient');
const metricsRoutes = require('./routes/metricsroutes');
const mcpRoutes = require('./routes/mcproutes');
const homeRoute = require('./routes/home');
const sessionRoutes = require('./routes/sessionroutes');

// Import rate limiting middleware
const ratelimitmw = require('../sdk/lib/middleware/ratelimit');

// Default rate limits - will be updated from RODiT metadata
let ratelimiter = ratelimitmw(100, 15);

// Swagger API documentation setup
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "RODiT Authentication API",
      version: "1.0.0",
      description: `# API using RODiT authentication system

## Service Description
The RODiT Authentication API provides secure authentication services using the RODiT authentication system. This API enables applications to implement robust user authentication, session management, and access control using RODiT's cryptographic identity verification.

## Key Features
- Secure user authentication via RODiT credentials
- Session management and token-based authorization
- User identity verification
- Access control for protected resources
- Metrics and monitoring capabilities

## Data Handling and Privacy
All user data is handled in accordance with our privacy policy. We implement industry-standard encryption for data in transit and at rest. Personal information is processed only for the purposes of authentication and is not shared with third parties without explicit consent.

We comply with applicable data protection regulations including GDPR and CCPA. In the event of a data breach, we will notify affected users within 72 hours of discovery.
      `,
      termsOfService: "https://dev-api.aparejos.net:3443/terms",
      contact: {
        name: "Rodit Technologies Inc.",
        url: "https://dev-api.aparejos.net:3443/home.js",
        email: "support@rodit-tech.com"
      },
      license: {
        name: "Proprietary",
        url: "https://dev-api.aparejos.net:3443/license"
      },
      "x-api-id": "rodit-auth-api-v1"
    },
    servers: [
      {
        url: "https://dev-api.aparejos.net:3443",
        description: "RODiT Development server",
      },
      {
        url: "https://api.aparejos.net:3443",
        description: "RODiT Production server"
      },
      {
        url: "https://sandbox-api.aparejos.net:3443",
        description: "RODiT Sandbox environment for testing"
      }
    ],
    externalDocs: {
      description: "Additional API Documentation",
      url: "https://docs.rodit-tech.com"
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT token obtained after successful authentication"
        }
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "Error code"
            },
            message: {
              type: "string",
              description: "Error message"
            }
          }
        }
      }
    },
    "x-terms-and-conditions": {
      "usage-rights": "This API is provided for use by authorized clients only. Usage rights are granted upon acceptance of the terms and conditions.",
      "intellectual-property": "All intellectual property rights in the API, including but not limited to copyright, patents, and trademarks, are owned by Rodit Technologies Inc.",
      "liability": "Rodit Technologies Inc. shall not be liable for any direct, indirect, incidental, special, or consequential damages resulting from the use or inability to use the API.",
      "termination": "Rodit Technologies Inc. reserves the right to terminate API access for any user who violates these terms and conditions."
    },
    "x-subscription-plans": {
      "free": {
        "description": "Limited access for development and testing",
        "rate-limits": "100 requests per day",
        "features": ["Basic authentication", "Limited API access"]
      },
      "basic": {
        "description": "Standard access for small applications",
        "rate-limits": "1000 requests per day",
        "features": ["Full authentication features", "Standard support"],
        "price": "$49/month"
      },
      "premium": {
        "description": "Enhanced access for enterprise applications",
        "rate-limits": "10000 requests per day",
        "features": ["Full authentication features", "Priority support", "Advanced analytics"],
        "price": "$199/month"
      }
    },
    "x-rate-limits": {
      "default": {
        "rate": "100 requests per 15 minutes",
        "burst": "150 requests"
      },
      "premium": {
        "rate": "1000 requests per 15 minutes",
        "burst": "1500 requests"
      }
    },
    "x-sla": {
      "uptime": "99.9% guaranteed uptime for premium subscribers",
      "response-time": "Average response time under 200ms",
      "support": {
        "standard": "24-hour response time",
        "premium": "4-hour response time"
      }
    },
    "x-versioning": {
      "current": "v1.0.0",
      "supported": ["v1.0.0"],
      "deprecation-policy": "APIs are supported for at least 12 months after deprecation notice"
    },
    "x-monitoring": {
      "metrics": "Available via /api/metrics endpoint for authenticated users",
      "status": "Service status available at https://status.rodit-tech.com"
    },
    "x-compliance": {
      "gdpr": "Compliant with EU General Data Protection Regulation",
      "ccpa": "Compliant with California Consumer Privacy Act",
      "security": "Regular security audits and penetration testing"
    }
  },
  apis: ["./src/app.js", "./src/routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Create Express app
const app = express();

// Configure Express to trust proxies for correct client IP detection
// Using a specific configuration instead of 'true' to prevent IP spoofing
app.set('trust proxy', 1);

// Log server startup
logger.info("Server starting", {
  component: "AppLifecycle",
  startTime: new Date().toISOString(),
  nodeEnv: process.env.NODE_ENV || 'development',
  pid: process.pid
});

// Configure middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Setup Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Performance monitoring middleware
app.use((req, res, next) => {
  req.startTime = Date.now();
  req.requestId = req.headers['x-request-id'] || ulid();
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    logger.debug(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`, {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      requestId: req.requestId
    });
  });
  next();
});

// Apply rate limiting to all routes
// app.use((req, res, next) => ratelimiter(req, res, next));

// Action logging middleware - tracks user actions
app.use((req, res, next) => {
  if (req.logAction) {
    logger.info(`Action executed`, {
      action: req.logAction,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: req.user ? req.user.id : "anonymous",
      requestId: req.requestId
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
app.use("/", homeRoute);

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
  logger.info("Login request received", {
    component: "API",
    method: "login",
    requestId: req.requestId || ulid(),
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Use the SDK's login function
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

// Legacy login route - redirects to new endpoint
app.post("/login", (req, res) => {
  req.logAction = "legacy-login-attempt";
  res.redirect(307, '/api/login');
});

// Legacy logout route - redirects to new endpoint
app.post("/logout", auth.authenticate, (req, res) => {
  req.logAction = "legacy-logout-attempt";
  res.redirect(307, '/api/logout');
});

// Mount session routes for backward compatibility
app.use("/api/sessions", sessionRoutes);

// Protected routes
app.use("/api/echo", auth.authenticate, echoprotectedRoute);
app.use("/api/cruda", auth.authenticate, auth.validatePermissions, crudaprotectedRoute);

// Public routes
app.use("/api/metrics", metricsRoutes);
app.use("/api/mcp", mcpRoutes);
app.use("/api", signclientRoute);

// Enhanced error handling middleware
app.use((err, req, res, next) => {
  logger.error(
    "Server error occurred",
    {
      method: req.method,
      url: req.originalUrl,
      userIP: req.ip,
      userId: req.user ? req.user.id : "anonymous",
      errorCode: "106",
      route: req.route ? req.route.path : "unknown",
      requestId: req.requestId || ulid()
    },
    err // Pass the error object directly
  );
  
  res.status(500).json({ 
    error: "Error 106: Internal Server Error",
    requestId: req.requestId || ulid()
  });
});

// Update rate limit once obtained config
function updateRateLimit(maxRequests, maxRqWindow) {
  ratelimiter = ratelimitmw(maxRequests, maxRqWindow);
  logger.info("Rate limit settings updated", { 
    maxRequests: maxRequests, 
    windowDuration: maxRqWindow 
  });
}

// Store server instance for graceful shutdown
let server;
let db;

// Start the server with proper initialization
async function startServer() {
  try {
    // Initialize performance service
    const performanceService = require('../sdk/lib/servicesperformanceservice');
    performanceService.initialize();
    
    logger.info("Initializing RODiT configuration", {
      component: "AppLifecycle",
      status: "initializing"
    });
    
    // Initialize vault and configuration
    await roditManager.initializeCredentialsStore();
    await roditManager.initializeRoditConfig("server");

    logger.info("Server initialization successful", {
      component: "vault",
      status: "initialized"
    });

    // Get and apply configuration
    const configObject = await stateManager.getConfigOwnRodit();
    if (!configObject) {
      throw new Error("Failed to initialize RODiT configuration");
    }

    // Update rate limits if applicable
    const own_rodit = configObject.own_rodit;
    if (own_rodit.metadata.maxrequests && own_rodit.metadata.maxrqwindow) {
      updateRateLimit(
        own_rodit.metadata.maxrequests,
        own_rodit.metadata.maxrqwindow
      );
    }

    // Start the HTTP server
    const port = configObject.port || 8080;
    server = app.listen(port, () => {
      logger.info("Server started", {
        port: port,
        env: process.env.NODE_ENV || "development",
        protocol: "http",
        swagger: `http://localhost:${port}/api-docs`
      });
      
      console.log(`\nRODiT Authentication API Server running on port ${port}`);
      console.log('');
      console.log('Available endpoints:');
      console.log('  GET  / - Public welcome page');
      console.log('  POST /api/login - Login with RODiT credentials');
      console.log('  POST /api/logout - Logout (requires authentication)');
      console.log('  GET  /api/echo - Echo service (requires authentication)');
      console.log('  GET  /api/cruda - CRUD operations (requires authentication + permissions)');
      console.log('  GET  /api-docs - Swagger API documentation');
      console.log('');
    });
    
    // Graceful shutdown handling
    process.on("SIGTERM", gracefulShutdown);
    process.on("SIGINT", gracefulShutdown);
    
  } catch (error) {
    logger.error("Server initialization failed", {
      component: "AppLifecycle",
      error: error.message
    }, error);
    process.exit(1);
  }
}

// Graceful shutdown function
async function gracefulShutdown(signal) {
  logger.info("Shutting down gracefully", {
    component: "AppLifecycle",
    signal: signal || "unknown",
    time: new Date().toISOString()
  });
  
  if (server) {
    server.close(async () => {
      logger.info("HTTP server closed", { component: "http-server" });
      
      // Close database connections
      await closeAllDatabases();
      
      process.exit(0);
    });
  } else {
    await closeAllDatabases();
    process.exit(0);
  }
}

// Helper function to close all database connections
async function closeAllDatabases() {
  // Check if db exists and has a close method before calling it
  if (db && typeof db.close === 'function') {
    try {
      await db.close();
      logger.info("Database connection closed", { component: "main-db" });
    } catch (error) {
      logger.error(
        "Error closing database", 
        { component: "main-db" },
        error
      );
    }
  }
  
  // Close the CRUDA database connection
  try {
    if (crudaprotectedRoute.closeDatabase) {
      await crudaprotectedRoute.closeDatabase();
      logger.info("CRUDA database connection closed", { component: "cruda-db" });
    }
  } catch (error) {
    logger.error(
      "Error closing CRUDA database", 
      { component: "cruda-db" },
      error
    );
  }
}

// Start the server
startServer();

// Export for testing purposes
module.exports = { app, startServer };
