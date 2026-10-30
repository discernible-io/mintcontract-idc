#!/bin/bash

# secure_credentials.sh - Ensures NEAR credential files have proper permissions
# This script should be run after creating or updating NEAR credentials

set -e

echo "=== NEAR Credentials Security Check ==="
echo ""

# Check if .near-credentials directory exists
CREDS_DIR="$HOME/.near-credentials"

if [ ! -d "$CREDS_DIR" ]; then
    echo "Warning: NEAR credentials directory not found at $CREDS_DIR"
    echo "No credentials to secure."
    exit 0
fi

echo "Checking credentials in: $CREDS_DIR"
echo ""

# Function to secure a directory
secure_directory() {
    local dir=$1
    local network=$(basename "$dir")
    
    if [ ! -d "$dir" ]; then
        return
    fi
    
    echo "Securing $network credentials..."
    
    # Set directory permissions to 700 (rwx------)
    chmod 700 "$dir"
    echo "  ✓ Directory permissions set to 700"
    
    # Find all JSON files and set permissions to 600 (rw-------)
    local count=0
    while IFS= read -r -d '' file; do
        chmod 600 "$file"
        count=$((count + 1))
    done < <(find "$dir" -type f -name "*.json" -print0)
    
    if [ $count -gt 0 ]; then
        echo "  ✓ Secured $count credential file(s)"
    else
        echo "  ⚠ No credential files found"
    fi
    echo ""
}

# Secure mainnet credentials
if [ -d "$CREDS_DIR/mainnet" ]; then
    secure_directory "$CREDS_DIR/mainnet"
else
    echo "No mainnet credentials found"
    echo ""
fi

# Secure testnet credentials
if [ -d "$CREDS_DIR/testnet" ]; then
    secure_directory "$CREDS_DIR/testnet"
else
    echo "No testnet credentials found"
    echo ""
fi

# Check for any other network directories
for network_dir in "$CREDS_DIR"/*; do
    if [ -d "$network_dir" ]; then
        network=$(basename "$network_dir")
        if [ "$network" != "mainnet" ] && [ "$network" != "testnet" ]; then
            secure_directory "$network_dir"
        fi
    fi
done

echo "=== Security Check Complete ==="
echo ""
echo "Summary:"
echo "  • All credential directories set to 700 (owner read/write/execute only)"
echo "  • All credential files set to 600 (owner read/write only)"
echo ""
echo "IMPORTANT: Never commit files from ~/.near-credentials/ to version control!"
echo ""

# Verify account.env is in .gitignore
if [ -f ".gitignore" ]; then
    if grep -q "account.env" .gitignore; then
        echo "✓ account.env is in .gitignore"
    else
        echo "⚠ WARNING: account.env is NOT in .gitignore!"
        echo "  Run: echo 'account.env' >> .gitignore"
    fi
else
    echo "⚠ WARNING: No .gitignore file found"
fi

echo ""
