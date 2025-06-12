const { decodeJwt } = require("jose");
const logger = require("../../services/logger");
const { createLogContext, logErrorWithMetrics } = logger;
const crypto = require("crypto");
const { ulid } = require("ulid");

class PermissionValidator {
  constructor() {
    this.methodPermissionMap = {
      create: ["entityAndProperties"],
      destroy: ["entityAndProperties"],
      read: ["entityAndProperties", "entityOnly"],
      update: ["entityAndProperties", "entityOnly"],
      list: ["entityAndProperties", "entityOnly"],
      list_all: ["entityAndProperties", "entityOnly"],
      sessions: ["entityAndProperties"],
      delete: ["entityAndProperties"],
      cleanup: ["entityAndProperties"],
      logout: ["entityAndProperties"],
    };
  }

  getPermissionScope(rateValue) {
    if (rateValue.startsWith("+")) {
      return "entityAndProperties";
    } else if (rateValue.startsWith("-")) {
      return "propertiesOnly";
    }
    return "entityOnly";
  }

  isMethodAllowed(method, permissionScope) {
    const startTime = Date.now();
    const requestId = ulid();
    
    // Create a base context for this method
    const baseContext = createLogContext(
      "PermissionValidator",
      "isMethodAllowed",
      {
        requestId,
        requestedMethod: method,
        permissionScope
      }
    );

    if (!this.methodPermissionMap[method]) {
      logErrorWithMetrics(
        "Unknown method type detected", 
        {
          ...baseContext,
          duration: Date.now() - startTime
        },
        new Error(`Unknown method type: ${method}`),
        "permission_validation_error",
        { error_type: "unknown_method" }
      );
      return false;
    }

    const isAllowed =
      this.methodPermissionMap[method].includes(permissionScope);

    logger.debugWithContext("Method permission check completed", {
      ...baseContext,
      isAllowed,
      duration: Date.now() - startTime
    });

    return isAllowed;
  }

  findMatchingEntity(entities, fullPath, requestId) {
    const startTime = Date.now();
    // Use provided requestId or generate a new one
    const contextRequestId = requestId || ulid();

    // Handle entities as an object with name and methods
    const entity = entities.name;
    const methods = entities.methods;
    
    // Create a base context for this method
    const baseContext = createLogContext(
      "PermissionValidator",
      "findMatchingEntity",
      {
        requestId: contextRequestId,
        fullPath,
        entity
      }
    );
    
    // Log available methods for debugging
    logger.debugWithContext("Checking permission for path", {
      ...baseContext,
      availableMethods: Object.keys(methods)
    });

    // Check for an exact match in the methods
    if (methods.hasOwnProperty(fullPath)) {
      const rateValue = methods[fullPath];
      // Extract the operation name (last part of the path)
      const operation = fullPath.split("/").pop();

      logger.infoWithContext("Processing permission request", {
        ...baseContext,
        requestedMethod: operation,
      });

      const permissionScope = this.getPermissionScope(rateValue);
      const isPermitted = this.isMethodAllowed(operation, permissionScope);

      logger.debugWithContext("Permission check result", {
        ...baseContext,
        requestedMethod: operation,
        permissionScope,
        rateValue,
        isPermitted,
        duration: Date.now() - startTime
      });

      if (isPermitted) {
        return {
          isPermitted: true,
          commentsRate: rateValue,
          permissionScope,
        };
      }
    }
    
    // For session routes, map them to specific operations
    // This is a fallback for when the exact path is not in methods
    // Ideally, these paths should be added to the methods object in the token
    const sessionRouteMappings = {
      '/api/sessions': 'sessions',
      '/api/sessions/logout': 'logout',
      '/api/sessions/cleanup': 'cleanup',
      '/api/sessions/close': 'delete'  // Static path for session termination
    };
    
    if (sessionRouteMappings[fullPath]) {
      const operation = sessionRouteMappings[fullPath];
      const rateValue = '+sessions'; // Default permission value
      
      // Create a session-specific context
      const sessionContext = createLogContext(
        "PermissionValidator",
        "findMatchingEntity",
        {
          requestId: contextRequestId,
          fullPath,
          entity: 'sessions',
          requestedMethod: operation
        }
      );
      
      logger.infoWithContext("Processing session permission request", sessionContext);
      
      const permissionScope = this.getPermissionScope(rateValue);
      const isPermitted = this.isMethodAllowed(operation, permissionScope);
      
      logger.debugWithContext("Session permission check result", {
        ...sessionContext,
        entity: 'sessions',
        permissionScope,
        rateValue,
        isPermitted,
        duration: Date.now() - startTime,
        requestId,
      });
      
      if (isPermitted) {
        return {
          isPermitted: true,
          commentsRate: rateValue,
          permissionScope,
        };
      }
    }

    logger.warnWithContext("No matching permission found", {
      ...baseContext,
      duration: Date.now() - startTime
    });

    return {
      isPermitted: false,
      commentsRate: null,
      permissionScope: null,
    };
  }

  async validate(req) {
    const requestId = req.headers["x-request-id"] || ulid();
    const startTime = Date.now();
    
    // Create a base context for this method
    const baseContext = createLogContext(
      "PermissionValidator",
      "validate",
      {
        requestId,
        path: req.path,
        method: req.method,
        ip: req.ip
      }
    );

    const token = req.header("Authorization");
    if (!token) {
      logger.warnWithContext("Authorization token missing", {
        ...baseContext,
        userAgent: req.headers["user-agent"],
        duration: Date.now() - startTime
      });

      return {
        isValid: false,
        status: 401,
        message: "Access denied. No token provided.",
      };
    }

    try {
      const decodedToken = decodeJwt(token);
      
      // Update context with user information
      const contextWithUser = {
        ...baseContext,
        userId: decodedToken.sub || "unknown"
      };

      logger.infoWithContext("Endpoint access attempt", contextWithUser);

      let permissionedRoutes;
      try {
        if (typeof decodedToken.rodit_permissionedroutes === 'string') {
          permissionedRoutes = JSON.parse(decodedToken.rodit_permissionedroutes);
        } else {
          permissionedRoutes = decodedToken.rodit_permissionedroutes;
        }
      } catch (error) {
        logErrorWithMetrics(
          "Failed to parse permissioned routes", 
          contextWithUser,
          error,
          "permission_validation_error",
          { 
            error_type: "parse_error",
            permissionedRoutesType: typeof decodedToken.rodit_permissionedroutes,
            valuePreview: decodedToken.rodit_permissionedroutes ? 
              decodedToken.rodit_permissionedroutes.substring(0, 100) : "undefined"
          }
        );
        throw error;
      }

      // Add debug logging for permission routes content
      logger.debugWithContext("Permission routes content", {
        ...contextWithUser,
        permissionedRoutes: JSON.stringify(permissionedRoutes).substring(0, 200) + "..."
      });

      // Use entities directly, assuming it's an object
      const entities = permissionedRoutes.entities;
      
      // Construct the full path for permission checking
      // This must exactly match what's defined in the RODiT token
      const fullPath = req.baseUrl + req.path;
      
      logger.debugWithContext("Validating permission for full path", {
        ...contextWithUser,
        baseUrl: req.baseUrl,
        path: req.path,
        fullPath
      });
      
      const { isPermitted, commentsRate, permissionScope } =
        this.findMatchingEntity(entities, fullPath, requestId);

      if (!isPermitted) {
        logger.warnWithContext("Permission denied", {
          ...contextWithUser,
          path: req.path,
          fullPath,
          userId: decodedToken.sub || "unknown",
          duration: Date.now() - startTime,
          requestId,
        });

        return {
          isValid: false,
          status: 403,
          message: "Permission denied",
        };
      }

      logger.infoWithContext("Authorization successful", {
        ...contextWithUser,
        fullPath,
        permissionScope,
        rateValue: commentsRate,
        duration: Date.now() - startTime
      });

      return {
        isValid: true,
        commentsRate,
        permissionScope,
      };
    } catch (error) {
      // Use logErrorWithMetrics for better error tracking
      logErrorWithMetrics(
        "Permission check failed", 
        {
          ...baseContext,
          duration: Date.now() - startTime
        },
        error,
        "permission_validation_error",
        { 
          error_type: "validation_error",
          errorCode: "112"
        }
      );

      return {
        isValid: false,
        status: 400,
        message: "Error 119: Invalid token or permissions.",
      };
    }
  }
}

const permissionValidator = new PermissionValidator();

/**
 * @swagger
 * /authorize:
 *   get:
 *     summary: Authorize user and check JWT token fields
 *     description: Verify the JWT token and check specific fields before granting access
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Authorization successful
 *       401:
 *         description: Unauthorized - Invalid token or missing required fields
 */
async function validatepermissions(req, res, next) {
  const startTime = Date.now();
  const requestId = req.headers["x-request-id"] || ulid();

  if (!req.headers["x-request-id"]) {
    req.headers["x-request-id"] = requestId;
  }
  
  // Create a base context for this middleware
  const baseContext = createLogContext(
    "validatepermissions",
    "middleware",
    {
      requestId,
      path: req.path,
      baseUrl: req.baseUrl,
      fullPath: req.baseUrl + req.path,
      method: req.method,
      ip: req.ip
    }
  );

  logger.debugWithContext("Permission validation started", baseContext);

  const result = await permissionValidator.validate(req);

  if (!result.isValid) {
    logger.warnWithContext("Permission validation failed", {
      ...baseContext,
      status: result.status,
      message: result.message,
      duration: Date.now() - startTime
    });

    return res.status(result.status).json({ message: result.message });
  }

  if (result.commentsRate) {
    req.commentsRate = result.commentsRate;
    req.permissionScope = result.permissionScope;
  }

  logger.debugWithContext("Permission validation successful", {
    ...baseContext,
    permissionScope: result.permissionScope,
    duration: Date.now() - startTime
  });

  next();
}

module.exports = validatepermissions;