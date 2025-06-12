// webhook/index.js
// Entry point for the webhook module

const webhookHandler = require('./webhookhandler');
const eventHandler = require('./eventhandler');

module.exports = {
  // Export all webhook handler functionality
  ...webhookHandler,
  
  // Export all event handler functionality
  ...eventHandler
};
