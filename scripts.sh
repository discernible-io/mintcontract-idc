"deploy": "source ./account.env && /usr/local/lib/node_modules/near-cli/bin/near deploy --accountId $CONTRACT_NAME --wasmFile build/contract.wasm -f"
"init": "source ./account.env && /usr/local/lib/node_modules/near-cli/bin/near call $CONTRACT_NAME init '{\"owner_id\": \"'$CONTRACT_NAME'\"}' --accountId $CONTRACT_NAME"
