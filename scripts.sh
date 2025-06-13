/usr/bin/near contract deploy 20250613-rodit-org.testnet use-file ./target/wasm32-unknown-unknown/release/rodit_near.wasm without-init-call network-config testnet sign-with-keychain send

"init": "source ./account.env && /usr/local/lib/node_modules/near-cli/bin/near call $CONTRACT_NAME init '{\"owner_id\": \"'$CONTRACT_NAME'\"}' --accountId $CONTRACT_NAME"
