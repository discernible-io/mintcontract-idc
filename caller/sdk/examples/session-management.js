/**
 * Session Management Example for RODiT SDK
 * 
 * This example demonstrates how to:
 * 1. Initialize the client
 * 2. Login to obtain a session token
 * 3. Make authenticated requests
 * 4. Refresh tokens when needed
 * 5. Logout to invalidate the session
 * 6. Handle session cleanup
 */

const { RoditClient, createClient } = require('../index');
const sessionCleanup = require('../lib/auth/sessioncleanup');

async function main() {
  try {
    console.log('RODiT SDK Session Management Example');
    console.log('====================================\n');
    
    // Step 1: Initialize the client
    console.log('Step 1: Initializing client...');
    const client = await createClient({
      credentialsPath: '../sdk/lib/servicescredentials.json'
    });
    console.log('✓ Client initialized successfully\n');
    
    // Step 2: Login to obtain a session token
    console.log('Step 2: Logging in...');
    const loginResult = await client.login();
    console.log('✓ Login successful');
    console.log('  Session token expires at:', new Date(loginResult.expiresAt).toLocaleString());
    console.log('  Session ID:', loginResult.sessionId);
    
    // Step 3: Make authenticated requests
    console.log('\nStep 3: Making authenticated requests...');
    try {
      const response = await client.request('GET', '/api/health');
      console.log('✓ API request successful:', response);
    } catch (error) {
      console.error('✗ API request failed:', error.message);
    }
    
    // Step 4: Check if token refresh is needed
    console.log('\nStep 4: Checking if token refresh is needed...');
    if (client.isTokenRefreshNeeded()) {
      console.log('Token refresh needed, refreshing...');
      await client.refreshToken();
      console.log('✓ Token refreshed successfully');
    } else {
      console.log('✓ Token is still valid, no refresh needed');
    }
    
    // Step 5: Get active sessions info
    console.log('\nStep 5: Getting active sessions info...');
    const activeSessionsCount = client.getActiveSessionsCount();
    console.log(`✓ Active sessions: ${activeSessionsCount}`);
    
    // Step 6: Manually trigger session cleanup
    console.log('\nStep 6: Running manual session cleanup...');
    const cleanupResult = await sessionCleanup.runManualCleanup();
    console.log('✓ Cleanup completed:');
    console.log(`  - Removed sessions: ${cleanupResult.removedSessionsCount}`);
    console.log(`  - Removed tokens: ${cleanupResult.removedTokensCount}`);
    console.log(`  - Remaining sessions: ${cleanupResult.remainingSessions}`);
    console.log(`  - Duration: ${cleanupResult.duration}ms`);
    
    // Step 7: Logout to invalidate the session
    console.log('\nStep 7: Logging out...');
    await client.logout();
    console.log('✓ Logout successful');
    
    // Step 8: Demonstrate automatic session cleanup
    console.log('\nStep 8: Setting up automatic session cleanup...');
    // Start cleanup job with a shorter interval for demonstration (30 seconds)
    sessionCleanup.startCleanupJob(30 * 1000);
    console.log('✓ Automatic session cleanup scheduled (every 30 seconds)');
    console.log('  In a production environment, use a longer interval (e.g., 1 hour)');
    
    // Wait for 5 seconds to demonstrate
    console.log('\nWaiting for 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Stop the cleanup job
    sessionCleanup.stopCleanupJob();
    console.log('✓ Automatic session cleanup stopped');
    
    console.log('\nExample completed successfully');
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error(error.stack);
  }
}

// Run the example
main().catch(console.error);
