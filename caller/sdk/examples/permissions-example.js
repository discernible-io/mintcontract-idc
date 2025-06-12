/**
 * Permissions Example for RODiT SDK
 * 
 * This example demonstrates how to:
 * 1. Initialize the client
 * 2. View available permissions from token metadata
 * 3. Check if specific operations are permitted
 * 4. Handle permission-related errors
 */

const { createClient } = require('../index');

async function main() {
  try {
    console.log('RODiT SDK Permissions Example');
    console.log('============================\n');
    
    // Step 1: Initialize the client
    console.log('Step 1: Initializing client...');
    const client = await createClient({
      credentialsPath: '../sdk/lib/servicescredentials.json'
    });
    console.log('✓ Client initialized successfully\n');
    
    // Step 2: View available permissions from token metadata
    console.log('Step 2: Viewing available permissions');
    const metadata = client.getRoditMetadata();
    
    if (metadata.permissioned_routes) {
      try {
        // Parse the permissioned routes from the token metadata
        const routes = JSON.parse(metadata.permissioned_routes);
        console.log('✓ Available permissions:');
        
        // Display the routes and their allowed methods
        Object.entries(routes).forEach(([route, methods]) => {
          console.log(`  - ${route}: ${methods.join(', ')}`);
        });
        
        // Count total permissions
        const totalEndpoints = Object.keys(routes).length;
        const totalPermissions = Object.values(routes).reduce((sum, methods) => sum + methods.length, 0);
        console.log(`\n  Total: ${totalEndpoints} endpoints with ${totalPermissions} permissions`);
      } catch (error) {
        console.log(`✗ Error parsing permissioned routes: ${error.message}`);
      }
    } else {
      console.log('✗ No permissioned routes found in token metadata');
    }
    
    // Step 3: Check if specific operations are permitted
    console.log('\nStep 3: Checking specific operation permissions');
    
    // Define some operations to check
    const operationsToCheck = [
      { method: 'GET', path: '/api/health' },
      { method: 'POST', path: '/api/data' },
      { method: 'PUT', path: '/api/users/profile' },
      { method: 'DELETE', path: '/api/resources/123' }
    ];
    
    // Check each operation
    operationsToCheck.forEach(op => {
      const isPermitted = client.isOperationPermitted(op.method, op.path);
      console.log(`  ${op.method} ${op.path}: ${isPermitted ? '✓ Permitted' : '✗ Not permitted'}`);
    });
    
    // Step 4: Handle permission-related errors
    console.log('\nStep 4: Handling permission-related errors');
    
    // Try to make a request that might not be permitted
    try {
      // Find an operation that is not permitted
      const unauthorizedOp = operationsToCheck.find(op => !client.isOperationPermitted(op.method, op.path));
      
      if (unauthorizedOp) {
        console.log(`  Attempting unauthorized operation: ${unauthorizedOp.method} ${unauthorizedOp.path}`);
        
        // Attempt the unauthorized operation
        await client.request(unauthorizedOp.method, unauthorizedOp.path);
      } else {
        console.log('  All example operations are permitted, skipping unauthorized request test');
      }
    } catch (error) {
      console.log(`  ✓ Permission error handled correctly: ${error.message}`);
      console.log('  This is expected behavior when attempting an unauthorized operation');
    }
    
    // Step 5: Best practices for permission handling
    console.log('\nStep 5: Permission handling best practices');
    console.log('  1. Always check permissions before attempting operations');
    console.log('  2. Handle permission errors gracefully');
    console.log('  3. Only show UI elements for permitted operations');
    console.log('  4. Permissions are defined in the RODiT token and cannot be modified by the client');
    
    console.log('\nExample completed successfully');
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error(error.stack);
  }
}

// Run the example
main().catch(console.error);
