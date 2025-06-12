# RODiT Authentication System

This npm package provides the RODiT-based authentication system for Express.js applications. It exports the exact same authentication functionality without adding unnecessary abstraction layers.

## Features

- Exclusive RODiT-based authentication with blockchain verification
- JWT-based token management through HTTP headers (no cookies)
- Permission validation for protected routes based on RODiT token permissions
- Session management with secure token handling
- Comprehensive logging and error handling

## Installation

```bash
npm install rodit-auth
```

For local development:

```bash
npm install /path/to/servertestapi/sdk
```

## Usage

### Basic Setup

```javascript
const express = require('express');
const app = express();
const auth = require('rodit-auth');

// Configure authentication with default options
auth.configure({
  logger: require('./sdk/lib/serviceslogger')
});

// Mount the authentication routes
app.post('/api/login', auth.login);
app.post('/api/logout', auth.authenticate, auth.logout);

// Protect routes with authentication
app.use('/api/protected', auth.authenticate, protectedRoutes);

// Add permission validation to routes that require specific permissions
app.use('/api/admin', auth.authenticate, auth.validatePermissions, adminRoutes);

// Example of a protected route with permission validation
app.get('/api/entities/:entityId', auth.authenticate, auth.validatePermissions, (req, res) => {
  // This route is protected and requires specific permissions from the RODiT token
  // The validatePermissions middleware will check if the user has permission to access this entity
  const entityId = req.params.entityId;
  // Process the request...
});

app.listen(3000, () => {
  console.log('Server started on port 3000');
});
```

### Custom Configuration

```javascript
const auth = require('rodit-auth');

// Configure authentication with custom options
auth.configure({
  // Use a custom logger
  logger: myCustomLogger,
  
  // Set token expiry time to 1 hour (in seconds)
  tokenExpiry: 3600,
  
  // Customize header names
  headerName: 'X-Auth-Token',
  tokenPrefix: '',
  newTokenHeader: 'X-New-Token',
  
  // Customize user property name on request object
  userProperty: 'currentUser'
});
```

## API Reference

### Core Middleware Functions

- `authenticate(req, res, next)` - Middleware to authenticate API calls
- `validatePermissions(req, res, next)` - Middleware to validate permissions for protected routes

### Authentication Handlers

- `login(req, res)` - Handle client login
- `logout(req, res)` - Handle client logout
- `loginWithNEP413(req, res)` - Handle client login with NEP-413 standard

### Token Functions

- `validateToken(token)` - Validate a JWT token
- `generateToken(payload, options)` - Generate a JWT token

### Services

- `sessionManager` - Session management service
- `blockchainService` - Blockchain interaction service
- `stateManager` - State management service

### Configuration

- `configure(config)` - Configure the authentication system

#### Configuration Options

- `logger` - Logger instance (optional, will use default if not provided)
- `tokenExpiry` - JWT token expiry time in seconds (default: 3600)
- `headerName` - Name of the header to use for the token (default: 'Authorization')
- `tokenPrefix` - Prefix to use for the token in the header (default: 'Bearer ')
- `newTokenHeader` - Name of the header to use for the new token (default: 'New-Token')
- `userProperty` - Name of the property to attach the user object to on the request (default: 'user')

## RODiT Authentication

RODiT-based authentication uses the RODiT system to authenticate users. It requires the following parameters in the login request:

- `roditid` - RODiT ID
- `timestamp` - Timestamp (optional, defaults to current time)
- `roditid_base64url_signature` - Signature

The system also supports NEP-413 standard authentication with the `loginWithNEP413` function, which requires:

- `message` - Message to sign
- `nonce` - Nonce value
- `recipient` - Recipient identifier
- `callbackUrl` - Callback URL
- `signature` - Signature

## Permission System

The permission system allows you to control access to protected routes based on the user's permissions. The permissions are stored in the JWT token and are checked by the `validatePermissions` middleware.

### RODiT-based Permissions

RODiT-based permissions use the `permissioned_routes` property in the JWT token. This property contains an array of objects with the following structure:

```json
[
  {
    "route": "^/api/admin/.*$",
    "methods": ["get", "post", "put", "delete"]
  },
  {
    "route": "^/api/users/.*$",
    "methods": ["get"]
  }
]
```

The permission validator checks if the requested route matches any of the patterns in the `permissioned_routes` array and if the HTTP method is allowed for that route.

## Error Handling

All methods in this module handle errors gracefully and return appropriate HTTP status codes and error messages. Errors are also logged using the provided logger.

## Logging

This module uses the provided logger to log important events. If no logger is provided, it uses the default logger from the SDK.

## Security Considerations

- Tokens are transmitted via HTTP headers only, not cookies
- Tokens are validated on every request
- Permissions are checked on protected routes
- Session invalidation is supported via logout
- Token expiry is configurable

## Backward Compatibility

For backward compatibility, the package also exports the original function names:

- `authenticate_apicall` - Original name for `authenticate`
- `login_client` - Original name for `login`
- `logout_client` - Original name for `logout`
- `login_client_withnep413` - Original name for `loginWithNEP413`

## License

Copyright (c) 2025 Rodit Technologies Inc. All rights reserved.
