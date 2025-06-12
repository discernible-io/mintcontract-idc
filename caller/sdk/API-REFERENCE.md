# RODiT SDK API Reference

This document provides a comprehensive reference for all classes, methods, and utilities available in the RODiT SDK.

> **Last Updated: May 30, 2025** - Documentation reflects the latest security enhancements and project structure.

## Table of Contents

- [RoditClient](#roditclient)
- [Authentication](#authentication)
- [Session Management](#session-management)
- [Configuration](#configuration)
- [Utility Functions](#utility-functions)
- [Middleware](#middleware)
- [Security Features](#security-features)
- [Project Structure](#project-structure)
- [Error Handling](#error-handling)

## RoditClient

The main client class for interacting with RODiT services.

### Constructor

```javascript
const client = new RoditClient(options);
```

**Parameters:**
- `options` (Object, optional): Configuration options
  - `credentialsFilePath` (string, optional): Path to credentials file

### Methods

#### init(options)

Initialize the client with credentials.

```javascript
await client.init(options);
```

**Parameters:**
- `options` (Object, optional): Initialization options
  - `credentialsPath` (string, optional): Path to credentials file
  - `token` (string, optional): RODiT token
  - `apiEndpoint` (string, optional): API endpoint

**Returns:** Promise<void>

#### login(options)

Authenticate and obtain a session token.

```javascript
const loginResult = await client.login(options);
```

**Parameters:**
- `options` (Object, optional): Login options
  - `roditId` (string, optional): RODiT ID to use for login

**Returns:** Promise<Object> - Login result with token and expiration information

#### logout()

Invalidate the current session token.

```javascript
await client.logout();
```

**Returns:** Promise<boolean> - True if logout was successful

#### request(method, path, data, options)

Make an authenticated API request.

```javascript
const response = await client.request(method, path, data, options);
```

**Parameters:**
- `method` (string): HTTP method (GET, POST, PUT, DELETE, etc.)
- `path` (string): API path
- `data` (any, optional): Request body data
- `options` (Object, optional): Request options
  - `headers` (Object, optional): Additional headers
  - `timeout` (number, optional): Request timeout in milliseconds

**Returns:** Promise<any> - API response

#### isTokenValid()

Check if the token is valid.

```javascript
const isValid = client.isTokenValid();
```

**Returns:** boolean - True if token is valid

#### isSubscriptionActive()

Check if the subscription is active.

```javascript
const isActive = client.isSubscriptionActive();
```

**Returns:** boolean - True if subscription is active

#### getRoditMetadata()

Get the token metadata.

```javascript
const metadata = client.getRoditMetadata();
```

**Returns:** Object - Token metadata

#### isOperationPermitted(method, path)

Check if an operation is permitted.

```javascript
const isPermitted = client.isOperationPermitted(method, path);
```

**Parameters:**
- `method` (string): HTTP method
- `path` (string): API path

**Returns:** boolean - True if operation is permitted

#### refreshToken()

Refresh the session token.

```javascript
await client.refreshToken();
```

**Returns:** Promise<Object> - Refresh result

#### getAvailableEndpoints()

Get available API endpoints from OpenAPI spec and includes the RODiT configured endpoint (subjectuniqueidentifier_url).

```javascript
const endpoints = await client.getAvailableEndpoints();
```

**Returns:** Promise<Object> - Available endpoints including the RODiT configured endpoint



## Authentication

Authentication-related classes and functions.

### authentication.js

Core authentication functionality.

#### verifyToken(token, options)

Verify a JWT token.

```javascript
const payload = authentication.verifyToken(token, options);
```

**Parameters:**
- `token` (string): JWT token
- `options` (Object, optional): Verification options

**Returns:** Object - Token payload if valid

### tokenservice.js

Token management service.

#### createToken(subject, claims)

Create a new token.

```javascript
const token = tokenService.createToken(subject, claims);
```

**Parameters:**
- `subject` (string): Token subject
- `claims` (Object): Token claims

**Returns:** string - JWT token

#### validateToken(token)

Validate a token.

```javascript
const isValid = tokenService.validateToken(token);
```

**Parameters:**
- `token` (string): JWT token

**Returns:** boolean - True if token is valid

## Session Management

Session management functionality.

### sessionmanager.js

Session management service.

#### createSession(userId, metadata)

Create a new session.

```javascript
const session = sessionManager.createSession(userId, metadata);
```

**Parameters:**
- `userId` (string): User ID
- `metadata` (Object, optional): Session metadata

**Returns:** Object - Session information

#### validateSession(sessionId, token)

Validate a session.

```javascript
const isValid = sessionManager.validateSession(sessionId, token);
```

**Parameters:**
- `sessionId` (string): Session ID
- `token` (string): Session token

**Returns:** boolean - True if session is valid

#### terminateSession(sessionId)

Terminate a session.

```javascript
sessionManager.terminateSession(sessionId);
```

**Parameters:**
- `sessionId` (string): Session ID

**Returns:** boolean - True if session was terminated

#### removeExpiredSessions()

Remove expired sessions.

```javascript
const count = sessionManager.removeExpiredSessions();
```

**Returns:** number - Number of sessions removed

### sessioncleanup.js

Session cleanup utilities.

#### startAutomaticCleanup(options)

Start automatic session cleanup.

```javascript
sessionCleanup.startCleanupJob(options);
```

**Parameters:**
- `options` (Object, optional): Cleanup options
  - `interval` (number, optional): Cleanup interval in milliseconds

**Returns:** void

#### stopAutomaticCleanup()

Stop automatic session cleanup.

```javascript
sessionCleanup.stopCleanupJob();
```

**Returns:** void

#### cleanupExpiredSessions()

Clean up expired sessions.

```javascript
const result = await sessionCleanup.runManualCleanup();
```

**Returns:** Promise<Object> - Cleanup results

## Token Management

Token management functionality.

### roditmanager.js

RODiT token management.

#### getInstance()

Get the RODiT manager singleton instance.

```javascript
const roditManager = roditManager.getInstance();
```

**Returns:** Object - RODiT manager instance

#### getRoditId()

Get the current RODiT ID.

```javascript
const roditId = roditManager.getRoditId();
```

**Returns:** string - RODiT ID

#### getRoditMetadata()

Get the token metadata.

```javascript
const metadata = roditManager.getRoditMetadata();
```

**Returns:** Object - Token metadata

## Configuration

Configuration management functionality.

### statemanager.js

State management service.

#### getInstance()

Get the state manager singleton instance.

```javascript
const stateManager = stateManager.getInstance();
```

**Returns:** Object - State manager instance

#### getConfig(key)

Get a configuration value.

```javascript
const value = stateManager.getConfig(key);
```

**Parameters:**
- `key` (string): Configuration key

**Returns:** any - Configuration value

#### setConfig(key, value)

Set a configuration value.

```javascript
stateManager.setConfig(key, value);
```

**Parameters:**
- `key` (string): Configuration key
- `value` (any): Configuration value

**Returns:** void

## Utility Functions

Utility functions for common tasks.

### utils.js

General utility functions.

#### isValidIpRange(cidr)

Validate an IP range in CIDR format.

```javascript
const isValid = utils.isValidIpRange(cidr);
```

**Parameters:**
- `cidr` (string): CIDR notation IP range

**Returns:** boolean - True if valid

#### isClientIpAuthorized(ip, cidr)

Check if a client IP is authorized.

```javascript
const isAuthorized = utils.isClientIpAuthorized(ip, cidr);
```

**Parameters:**
- `ip` (string): Client IP address
- `cidr` (string): CIDR notation IP range

**Returns:** boolean - True if authorized

#### parseMetadataJson(jsonString, defaultValue)

Parse a JSON string from RODiT token metadata. RODiT tokens contain specific metadata fields that may be JSON-encoded strings, such as `permissioned_routes` which contains the allowed API routes and methods.

```javascript
// Example: Parse permissioned routes from token metadata
const metadata = client.getRoditMetadata();
const permissionedRoutes = utils.parseMetadataJson(metadata.permissioned_routes, {});

// RODiT permissioned_routes structure example:
// {
//   "/api/health": ["GET"],
//   "/api/data": ["GET", "POST"],
//   "/api/users": ["GET"]
// }
```

**Parameters:**
- `jsonString` (string): JSON string from RODiT token metadata
- `defaultValue` (any): Default value if parsing fails

**Returns:** Object - Parsed RODiT metadata structure or default value

## Middleware

Middleware for Express applications.

### authenticationmw.js

Authentication middleware.

#### authenticate(options)

Middleware to authenticate requests.

```javascript
app.use(authenticationmw.authenticate(options));
```

**Parameters:**
- `options` (Object, optional): Authentication options
  - `required` (boolean, optional): Whether authentication is required

**Returns:** Function - Express middleware

### filestore-credentials.js

File-based credential storage.

#### loadCredentials(filePath)

Load credentials from a file.

```javascript
const credentials = filestoreCredentials.loadCredentials(filePath);
```

**Parameters:**
- `filePath` (string): Path to credentials file

**Returns:** Object - Credentials

## Error Handling

The SDK implements internal error handling for various operations. As a user of the SDK, you should handle errors that may be thrown from SDK methods.

### SDK Error Handling

The SDK internally handles various error types:

- Authentication errors (token validation, login failures)
- Network errors (connection issues, timeouts)
- Configuration errors (missing required values)
- Permission errors (unauthorized operations)

## Security Features

### Timestamp Validation

The SDK implements timestamp validation to prevent replay attacks. Authentication requests include a timestamp that must be within a configurable time window (default: 5 minutes) of the server's current time.

```javascript
// Example of timestamp validation in authentication requests
const timestamp = Math.floor(Date.now() / 1000); // Current Unix timestamp in seconds
const authData = {
  roditid: "your-rodit-id",
  timestamp: timestamp,
  signature: signData(`${roditid}${timestamp}`)
};
```

### JWT-Based Authentication

The SDK uses modern JWT (JSON Web Token) for authentication, providing a stateless, secure method for transmitting information between parties.

```javascript
// Example of JWT token verification
const tokenData = decodeJwt(token);
const isValid = await verifyJwtSignature(token);
```

### Webhook Security

Webhooks are secured using cryptographic signatures to ensure the authenticity of webhook deliveries.

```javascript
// Example of webhook signature verification
const isValid = await authenticate_webhook(
  payload,
  signature_hex_ofpayload,
  timestamp,
  server_public_key_base64url
);
```

## Project Structure

The RODiT SDK is organized into the following directory structure:

```
sdk/
├── lib/                  # Core library files
│   ├── auth/             # Authentication modules
│   │   ├── authentication.js
│   │   ├── roditmanager.js
│   │   ├── sessionmanager.js
│   │   ├── tokenservice.js
│   │   └── sessioncleanup.js
│   ├── blockchain/       # Blockchain interaction
│   │   ├── blockchainservice.js
│   │   └── statemanager.js
│   └── middleware/       # Express middleware
│       ├── authenticationmw.js
│       ├── loggingmw.js
│       ├── performancemw.js
│       ├── ratelimit.js
│       └── validatepermissions.js
├── utils.js              # Utility functions
├── README.md             # SDK documentation
└── API-REFERENCE.md      # API reference
```

### Module Dependencies

The SDK is designed to minimize circular dependencies by using direct function imports and careful module organization.

```javascript
// Example of importing specific functions to avoid circular dependencies
const { login_server } = require("../middleware/authenticationmw");
```

### Client-Side Error Handling

When using the SDK, implement error handling for SDK method calls:

```javascript
try {
  // Initialize the client
  const client = await createClient({
    credentialsPath: './credentials.json'
  });
  
  // Make an API request
  const response = await client.request('GET', '/api/endpoint');
  console.log('Response:', response);
} catch (error) {
  console.error('Error:', error.message);
  
  // Check for specific error messages if needed
  if (error.message.includes('authentication')) {
    console.error('Authentication error - please check your credentials');
  } else if (error.message.includes('network')) {
    console.error('Network error - please check your connection');
  }
}
```

The SDK handles token refresh and other internal operations automatically.
