/**
 * Complete sdk Usage Example
 * 
 * This example demonstrates:
 * 1. Initializing the sdk with credentials
 * 2. Validating token metadata
 * 3. Making authenticated API requests
 * 4. Handling errors
 * 5. Working with token permissions
 */

const { RoditClient, utils, createClient } = require('../index');

async function main() {
  try {
    console.log('RODiT sdk Complete Example');
    console.log('=========================\n');
    
    // STEP 1: Initialize the client
    console.log('Step 1: Initializing client...');
    const client = createClient({
      credentialsPath: '../sdk/lib/servicescredentials.json'
    });
    
    await client.init();
    console.log('✓ Client initialized successfully\n');
    
    // STEP 2: Check subscription status
    console.log('Step 2: Checking subscription status...');
    if (!client.isSubscriptionActive()) {
      console.error('✗ Service subscription is not active');
      console.log('  Please check your subscription dates in the token metadata');
      return;
    }
    console.log('✓ Service subscription is active\n');
    
    // STEP 3: Display token metadata
    console.log('Step 3: Retrieving token metadata...');
    const metadata = client.getRoditMetadata();
    console.log('Token Metadata:');
    console.log('  API Endpoint:', metadata.subjectuniqueidentifier_url);
    console.log('  Subscription Period:', metadata.not_before, 'to', metadata.not_after);
    console.log('  Allowed IP Range:', metadata.allowed_cidr || 'Not specified');
    console.log('  OpenAPI Docs:', metadata.openapijson_url || 'Not specified');
    
    // STEP 4: Parse and display permissions
    console.log('\nStep 4: Analyzing API permissions...');
    if (metadata.permissioned_routes) {
      const routes = utils.parseMetadataJson(metadata.permissioned_routes, {});
      console.log('Permissioned Routes:');
      
      if (routes.entities && routes.entities.methods) {
        const methods = routes.entities.methods;
        Object.keys(methods).forEach(route => {
          const permission = methods[route];
          const isAllowed = permission.startsWith('+');
          console.log(`  ${route}: ${isAllowed ? '✓ Allowed' : '✗ Denied'}`);
        });
      } else {
        console.log('  No specific route permissions defined');
      }
    } else {
      console.log('  No permission restrictions specified');
    }
    
    // STEP 5: Check IP authorization (example)
    console.log('\nStep 5: Checking IP authorization...');
    const exampleIp = '192.168.1.1';
    const isAuthorized = utils.isClientIpAuthorized(
      exampleIp, 
      metadata.allowed_cidr || '0.0.0.0/0'
    );
    console.log(`  IP ${exampleIp} authorization: ${isAuthorized ? '✓ Authorized' : '✗ Unauthorized'}`);
    
    // STEP 6: Make an API request
    console.log('\nStep 6: Making API request...');
    try {
      // Health check endpoint is commonly available
      const response = await client.request('GET', '/api/health');
      console.log('  API Response:', JSON.stringify(response, null, 2));
      console.log('✓ API request successful\n');
    } catch (error) {
      console.error('✗ API request failed:', error.message);
    }
    
    // STEP 7: Demonstrate error handling
    console.log('Step 7: Demonstrating error handling...');
    try {
      // Intentionally request a non-existent endpoint
      await client.request('GET', '/api/non-existent');
    } catch (error) {
      console.log('  Expected error caught successfully:');
      console.log(`  ${error.message}`);
      console.log('✓ Error handling works correctly\n');
    }
    
    // STEP 8: Check OpenAPI specification if available
    console.log('Step 8: Checking API documentation...');
    if (metadata.openapijson_url) {
      try {
        const endpoints = await client.getAvailableEndpoints();
        const endpointCount = Object.keys(endpoints).length;
        console.log(`  Found ${endpointCount} endpoints in the API documentation`);
        console.log('  First 3 endpoints:');
        
        Object.keys(endpoints).slice(0, 3).forEach(path => {
          console.log(`  - ${path}`);
          Object.keys(endpoints[path]).forEach(method => {
            console.log(`    ${method.toUpperCase()}: ${endpoints[path][method].summary || 'No description'}`);
          });
        });
        
        console.log('✓ API documentation retrieved successfully\n');
      } catch (error) {
        console.log('  Could not retrieve API documentation:', error.message);
      }
    } else {
      console.log('  No OpenAPI documentation URL specified in token metadata\n');
    }
    
    // STEP 9: Demonstrate webhook registration (if available)
    console.log('Step 9: Checking webhook capabilities...');
    if (metadata.webhook_url) {
      console.log('  Webhook URL available:', metadata.webhook_url);
      console.log('  To register a webhook:');
      console.log('  client.registerWebhook("event_name", "https://your-callback-url.com")');
      console.log('  To verify a webhook signature:');
      console.log('  client.verifyWebhookSignature(payload, signature, timestamp)');
    } else {
      console.log('  No webhook URL specified in token metadata');
    }
    
    console.log('\nExample completed successfully');
    
  } catch (error) {
    console.error('\nExample failed with error:');
    console.error(error.message);
    console.error(error.stack);
  }
}

// Run the example
main().catch(console.error);
