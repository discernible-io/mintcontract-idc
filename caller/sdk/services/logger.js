const winston = require("winston");
const path = require("path");
const config = require("config");
const fs = require('fs');

// Configuration
const LOG_DIR = config.get("API_DEFAULT_OPTIONS.LOG_DIR");
const SERVICE_NAME = config.get("SERVICE_NAME");

// Ensure log directory exists
fs.mkdirSync(LOG_DIR, { recursive: true });

// Custom format to standardize and enhance logs for Grafana
const grafanaFormat = winston.format.combine(
  // Convert errors to serializable objects with proper stack traces
  winston.format((info) => {
    // Handle Error objects
    if (info.error instanceof Error) {
      info.error = {
        message: info.error.message,
        stack: info.error.stack,
        name: info.error.name
      };
    }
    // Standardize log level names to uppercase
    if (info.level) {
      info.level = info.level.toUpperCase();
    }
    // Add standard fields if not present
    info.service_name = SERVICE_NAME;
    info.context = info.context || {};
    // Add hostname for better filtering
    info.hostname = require('os').hostname();
    return info;
  })(),
  // Add timestamp in ISO format for better time-based queries
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  // Convert to JSON with proper spacing
  winston.format.json()
);

// Create the logger
const logger = winston.createLogger({
  level: "debug", // Default level
  format: grafanaFormat,
  defaultMeta: {
    service_name: SERVICE_NAME
  },
  levels: winston.config.npm.levels,
  transports: [
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'signroditserror.log'),
      level: 'ERROR'
    }),
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'signroditcombined.log')
    }),
  ],
});

// Add console transport for non-production environments
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...rest }) => {
          // Extract error for better console display
          const errorStr = rest.error ?
            `\n${JSON.stringify(rest.error, null, 2)}` : '';
          // Extract context for cleaner display
          const contextStr = rest.context && Object.keys(rest.context).length ?
            `\n${JSON.stringify(rest.context, null, 2)}` : '';
          return `${timestamp} [${level}]: ${message}${errorStr}${contextStr}`;
        })
      )
    })
  );
}

// Add helper methods for consistent context logging
logger.logWithContext = (level, message, context = {}, error = null) => {
  logger.log({
    level,
    message,
    context,
    ...(error && { error })
  });
};

// Helper methods for each log level with context support
['error', 'warn', 'info', 'debug'].forEach(level => {
  logger[`${level}WithContext`] = (message, context = {}, error = null) => {
    logger.logWithContext(level, message, context, error);
  };
  
  // Add conditional logging helpers to avoid verbose if-statements
  logger[`${level}If`] = (condition, message, context = {}, error = null) => {
    if (condition) {
      if (level === 'error') {
        logger[level](message, context, error);
      } else {
        logger[level](message, context);
      }
    }
  };
  
  // Add conditional context-based logging helpers
  logger[`${level}WithContextIf`] = (condition, message, context = {}, error = null) => {
    if (condition) {
      logger[`${level}WithContext`](message, context, error);
    }
  };
});

// Add metric function for Grafana/Prometheus style metrics
logger.metric = (name, value, labels = {}) => {
  // Log metrics as debug level with additional context
  logger.debug(`METRIC: ${name}=${value}`, {
    context: {
      metric_name: name,
      metric_value: value,
      metric_labels: labels,
      metric_type: 'gauge'
    }
  });
  
  // In a production environment, this would send metrics to a system like Prometheus
  // This is a minimal implementation to resolve the error
};

// Add helper to log error and metrics in a standardized way to avoid duplication
logger.logErrorWithMetrics = (message, context = {}, error = null, metricName = 'error_count', metricLabels = {}) => {
  // Log the error with context
  logger.errorWithContext(message, context, error);
  
  // Record the metric
  logger.metric(metricName, 1, {
    error_type: error?.name || "Unknown",
    error_message: error?.message?.substring(0, 100) || "Unknown",
    ...metricLabels
  });
};

/**
 * Creates a standardized context object for logging
 * 
 * @param {string} component - The component/module name
 * @param {string} event - The event name/description
 * @param {Object} data - Additional data to include in the context
 * @param {Error|string|null} error - Optional error object or message
 * @returns {Object} - Standardized context object
 */
logger.createLogContext = function(component, event, data = {}, error = null) {
  return {
    component,
    event,
    ...(error && { error: typeof error === 'string' ? error : error.message }),
    ...data
  };
};

/**
 * Helper function to log events with standardized format
 * Consolidated from authentication.js
 * 
 * @param {string} event - Event name
 * @param {Object} data - Event data
 * @param {boolean} isError - Whether this is an error event
 */
logger.logEvent = function(event, data, isError = false) {
  try {
    const logLevel = isError ? "error" : "info";
    const context = logger.createLogContext(
      "EventLogger",
      event,
      {
        isError,
        dataType: typeof data,
        dataKeys: typeof data === 'object' && data !== null ? Object.keys(data) : null,
        ...(typeof data === 'object' && data !== null ? data : { value: data })
      }
    );
    
    logger[`${logLevel}WithContext`](event, context);
  } catch (error) {
    logger.errorWithContext("Error logging event", logger.createLogContext("EventLogger", event, {}, error));
  }
};

// Export both the logger and the SERVICE_NAME constant
module.exports = logger;
module.exports.SERVICE_NAME = SERVICE_NAME;

// Export helper functions from the consolidated loghelpers
module.exports.createLogContext = logger.createLogContext;
module.exports.logEvent = logger.logEvent;
module.exports.logErrorWithMetrics = logger.logErrorWithMetrics;
module.exports.debugWithContextIf = logger.debugWithContextIf;
module.exports.infoWithContextIf = logger.infoWithContextIf;
module.exports.warnWithContextIf = logger.warnWithContextIf;
module.exports.errorWithContextIf = logger.errorWithContextIf;