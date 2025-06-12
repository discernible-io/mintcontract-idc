// eventhandler.js
// Webhook event handler for RODiT SDK

const logger = require("../../../sdk/lib/serviceslogger");
const crypto = require("crypto");

/**
 * Base class for webhook event handlers
 */
class WebhookEventHandler {
  /**
   * Create a new webhook event handler
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Handle a webhook event
   * @param {Object} event - Event data
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<Object>} Response data
   */
  async handleEvent(event, req, res) {
    throw new Error("Method not implemented");
  }
}

/**
 * Handler for test configuration update events
 */
class TestConfigUpdateHandler extends WebhookEventHandler {
  /**
   * Create a new test configuration update handler
   * @param {Object} configManager - Configuration manager
   * @param {Object} options - Configuration options
   */
  constructor(configManager, options = {}) {
    super(options);
    this.configManager = configManager;
  }

  /**
   * Handle a test configuration update event
   * @param {Object} event - Event data
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<Object>} Response data
   */
  async handleEvent(event, req, res) {
    const requestId = req.webhookAuthResult?.requestId || crypto.randomUUID();
    const logContext = {
      requestId,
      endpoint: req.path,
      method: req.method,
      event: event.event,
      component: "TestConfigUpdateHandler"
    };

    try {
      if (event.data && event.data.config) {
        await this.configManager.updateConfig(event.data.config);
        logger.infoWithContext("Configuration updated successfully", logContext);
        return {
          success: true,
          message: "Configuration updated successfully"
        };
      } else {
        logger.warnWithContext("Invalid configuration data", logContext);
        return {
          success: false,
          error: "Invalid configuration data"
        };
      }
    } catch (error) {
      logger.errorWithContext("Error updating configuration", {
        ...logContext,
        error: error.message
      });
      return {
        success: false,
        error: "Failed to update configuration",
        message: error.message
      };
    }
  }
}

/**
 * Handler for test suite execution events
 */
class TestSuiteHandler extends WebhookEventHandler {
  /**
   * Create a new test suite handler
   * @param {Function} runTestSuite - Function to run a test suite
   * @param {Object} options - Configuration options
   */
  constructor(runTestSuite, options = {}) {
    super(options);
    this.runTestSuite = runTestSuite;
  }

  /**
   * Handle a test suite execution event
   * @param {Object} event - Event data
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<Object>} Response data
   */
  async handleEvent(event, req, res) {
    const requestId = req.webhookAuthResult?.requestId || crypto.randomUUID();
    const logContext = {
      requestId,
      endpoint: req.path,
      method: req.method,
      event: event.event,
      component: "TestSuiteHandler"
    };

    try {
      if (event.data && event.data.suiteName) {
        // Run the test suite asynchronously
        this.runTestSuite(event.data.apiEndpoint, event.data.suiteName).catch((error) => {
          logger.errorWithContext(`Error running test suite ${event.data.suiteName}`, {
            ...logContext,
            error: error.message
          });
        });

        logger.infoWithContext(`Test suite ${event.data.suiteName} started`, logContext);
        return {
          success: true,
          message: `Test suite ${event.data.suiteName} started`
        };
      } else {
        logger.warnWithContext("Invalid test suite data", logContext);
        return {
          success: false,
          error: "Invalid test suite data"
        };
      }
    } catch (error) {
      logger.errorWithContext("Error starting test suite", {
        ...logContext,
        error: error.message
      });
      return {
        success: false,
        error: "Failed to start test suite",
        message: error.message
      };
    }
  }
}

/**
 * Handler for single test execution events
 */
class SingleTestHandler extends WebhookEventHandler {
  /**
   * Create a new single test handler
   * @param {Function} runSingleTest - Function to run a single test
   * @param {Object} options - Configuration options
   */
  constructor(runSingleTest, options = {}) {
    super(options);
    this.runSingleTest = runSingleTest;
  }

  /**
   * Handle a single test execution event
   * @param {Object} event - Event data
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<Object>} Response data
   */
  async handleEvent(event, req, res) {
    const requestId = req.webhookAuthResult?.requestId || crypto.randomUUID();
    const logContext = {
      requestId,
      endpoint: req.path,
      method: req.method,
      event: event.event,
      component: "SingleTestHandler"
    };

    try {
      if (event.data && event.data.suiteName && event.data.testName) {
        // Run the test asynchronously
        this.runSingleTest(
          event.data.apiEndpoint,
          event.data.suiteName,
          event.data.testName
        ).catch((error) => {
          logger.errorWithContext(`Error running test ${event.data.testName}`, {
            ...logContext,
            error: error.message
          });
        });

        logger.infoWithContext(`Test ${event.data.suiteName}.${event.data.testName} started`, logContext);
        return {
          success: true,
          message: `Test ${event.data.suiteName}.${event.data.testName} started`
        };
      } else {
        logger.warnWithContext("Invalid test data", logContext);
        return {
          success: false,
          error: "Invalid test data"
        };
      }
    } catch (error) {
      logger.errorWithContext("Error starting test", {
        ...logContext,
        error: error.message
      });
      return {
        success: false,
        error: "Failed to start test",
        message: error.message
      };
    }
  }
}

/**
 * Handler for comment events
 */
class CommentEventHandler extends WebhookEventHandler {
  /**
   * Create a new comment event handler
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    super(options);
  }

  /**
   * Handle a comment event
   * @param {Object} event - Event data
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<Object>} Response data
   */
  async handleEvent(event, req, res) {
    const requestId = req.webhookAuthResult?.requestId || crypto.randomUUID();
    const logContext = {
      requestId,
      endpoint: req.path,
      method: req.method,
      event: event.event,
      component: "CommentEventHandler",
      commentId: event.data?.id,
      title: event.data?.title,
      count: event.data?.count,
      isTest: !!event.data?.test_id,
      testId: event.data?.test_id
    };

    let message;
    switch (event.event) {
      case "comment_created":
        message = "Comment creation acknowledged";
        break;
      case "comment_updated":
        message = "Comment update acknowledged";
        break;
      case "comment_deleted":
        message = "Comment deletion acknowledged";
        break;
      case "comments_listed":
        message = "Comments listing acknowledged";
        break;
      case "create_comment_error":
      case "update_comment_error":
      case "delete_comment_error":
      case "read_comment_error":
        logger.warnWithContext(`Error event received: ${event.event}`, {
          ...logContext,
          error: event.data?.error
        });
        message = "Error event acknowledged";
        break;
      default:
        message = `${event.event} acknowledged`;
    }

    logger.infoWithContext(`${event.event} webhook received`, logContext);
    return {
      success: true,
      message
    };
  }
}

/**
 * Factory for creating webhook event handlers
 */
class WebhookEventHandlerFactory {
  /**
   * Create a new webhook event handler factory
   * @param {Object} dependencies - Dependencies for event handlers
   * @param {Object} options - Configuration options
   */
  constructor(dependencies = {}, options = {}) {
    this.dependencies = dependencies;
    this.options = options;
    this.handlers = new Map();
    
    // Register default handlers if dependencies are provided
    if (dependencies.configManager) {
      this.registerHandler("test_config_update", new TestConfigUpdateHandler(dependencies.configManager, options));
    }
    
    if (dependencies.runTestSuite) {
      this.registerHandler("run_test_suite", new TestSuiteHandler(dependencies.runTestSuite, options));
    }
    
    if (dependencies.runSingleTest) {
      this.registerHandler("run_single_test", new SingleTestHandler(dependencies.runSingleTest, options));
    }
    
    // Register comment event handlers
    const commentHandler = new CommentEventHandler(options);
    this.registerHandler("comment_created", commentHandler);
    this.registerHandler("comment_updated", commentHandler);
    this.registerHandler("comment_deleted", commentHandler);
    this.registerHandler("comments_listed", commentHandler);
    this.registerHandler("create_comment_error", commentHandler);
    this.registerHandler("update_comment_error", commentHandler);
    this.registerHandler("delete_comment_error", commentHandler);
    this.registerHandler("read_comment_error", commentHandler);
  }

  /**
   * Register a handler for an event type
   * @param {string} eventType - Event type
   * @param {WebhookEventHandler} handler - Event handler
   */
  registerHandler(eventType, handler) {
    this.handlers.set(eventType, handler);
  }

  /**
   * Get a handler for an event type
   * @param {string} eventType - Event type
   * @returns {WebhookEventHandler|null} Event handler or null if not found
   */
  getHandler(eventType) {
    return this.handlers.get(eventType) || null;
  }

  /**
   * Handle a webhook event
   * @param {Object} event - Event data
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<Object>} Response data
   */
  async handleEvent(event, req, res) {
    const handler = this.getHandler(event.event);
    
    if (handler) {
      return await handler.handleEvent(event, req, res);
    } else {
      logger.warnWithContext(`Unhandled event type: ${event.event}`, {
        requestId: req.webhookAuthResult?.requestId || crypto.randomUUID(),
        endpoint: req.path,
        method: req.method,
        event: event.event
      });
      
      return {
        success: true,
        message: "Event acknowledged"
      };
    }
  }
}

module.exports = {
  WebhookEventHandler,
  TestConfigUpdateHandler,
  TestSuiteHandler,
  SingleTestHandler,
  CommentEventHandler,
  WebhookEventHandlerFactory
};
