/**
 * Configuration Management Example for RODiT SDK
 * 
 * This example demonstrates how to:
 * 1. Configure the SDK with a credentials file
 * 2. Access token metadata from the RODiT token
 * 3. View available permissions and endpoints
 */

const { createClient } = require('../index');
const fs = require('fs');
const path = require('path');

async function main() {
  try {
    console.log('RODiT SDK Configuration Example');
    console.log('==============================\n');
    
    // Step 1: Configure the SDK with a credentials file
    console.log('Step 1: Configuring the SDK with a credentials file');
    const credentialsPath = '../sdk/lib/servicescredentials.json';
    
    // Check if credentials file exists
    if (!fs.existsSync(path.resolve(__dirname, credentialsPath))) {
      console.log('  Creating example credentials file...');
      const exampleCredentials = {
        roditId: 'example-rodit-id',
        apiEndpoint: 'https://api.example.com',
        token: 'example-token'
      };
      
      fs.writeFileSync(
        path.resolve(__dirname, credentialsPath), 
        JSON.stringify(exampleCredentials, null, 2)
      );
      console.log('  ✓ Example credentials file created');
    }
    
    // Initialize the client with the credentials file
    console.log('  Initializing client with credentials file...');
    const client = await createClient({ credentialsPath });
    console.log('  ✓ Client initialized successfully\n');
    
    // Step 2: Access token metadata from the RODiT token
    console.log('Step 2: Accessing token metadata');
    const metadata = client.getRoditMetadata();
    console.log('  ✓ Token metadata retrieved:');
    console.log('  - API Endpoint:', metadata.subjectuniqueidentifier_url || 'Not specified');
    console.log('  - Valid From:', metadata.not_before ? new Date(metadata.not_before * 1000).toLocaleString() : 'Not specified');
    console.log('  - Valid Until:', metadata.not_after ? new Date(metadata.not_after * 1000).toLocaleString() : 'Not specified');
    console.log('  - Rate Limit:', metadata.max_requests || 'Not specified', 'requests per', 
                metadata.maxrq_window || 'Not specified', 'seconds');
    
    // Step 3: View available permissions
    console.log('\nStep 3: Viewing available permissions');
    if (metadata.permissioned_routes) {
      try {
        // Parse the permissioned routes from the token metadata
        const routes = JSON.parse(metadata.permissioned_routes);
        console.log('  ✓ Available permissions:');
        
        // Display the routes and their allowed methods
        Object.entries(routes).forEach(([route, methods]) => {
          console.log(`  - ${route}: ${methods.join(', ')}`);
        });
      } catch (error) {
        console.log(`  ✗ Error parsing permissioned routes: ${error.message}`);
      }
    } else {
      console.log('  ✗ No permissioned routes found in token metadata');
    }
    
    // Step 4: View available endpoints
    console.log('\nStep 4: Viewing available endpoints');
    try {
      // Get available endpoints from OpenAPI spec
      const endpoints = await client.getAvailableEndpoints();
      console.log('  ✓ Available endpoints:');
      
      // Display the first 5 endpoints
      const endpointPaths = Object.keys(endpoints);
      endpointPaths.slice(0, 5).forEach(path => {
        console.log(`  - ${path}`);
      });
      
      if (endpointPaths.length > 5) {
        console.log(`  ... and ${endpointPaths.length - 5} more`);
      }
    } catch (error) {
      console.log(`  ✗ Error fetching available endpoints: ${error.message}`);
    }
    
    console.log('\nExample completed successfully');
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error(error.stack);
  }
}

// Run the example
main().catch(console.error);
