#!/usr/bin/env bash
# Pause the mint contract immediately (owner-only, 1 yoctoNEAR).
# Usage: ./scripts/emergency_pause.sh <account_id> [network]
# Network defaults to NEAR_NETWORK_CONFIG, then mainnet.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ACCOUNT_ID="${1:-}"
NETWORK="${2:-${NEAR_NETWORK_CONFIG:-mainnet}}"

if [[ -z "$ACCOUNT_ID" ]]; then
  if [[ -f "$REPO_ROOT/account.env" ]]; then
    # shellcheck disable=SC1091
    source "$REPO_ROOT/account.env"
  fi
  ACCOUNT_ID="${CONTRACT_NAME:-}"
fi

if [[ -z "$ACCOUNT_ID" ]]; then
  echo "Usage: $0 <account_id> [network]" >&2
  echo "Or set CONTRACT_NAME / provide a local account.env" >&2
  exit 1
fi

if ! command -v near >/dev/null 2>&1; then
  echo "Error: near CLI not found in PATH" >&2
  exit 1
fi

echo "Pausing contract ${ACCOUNT_ID} on ${NETWORK}..."
near call "${ACCOUNT_ID}" pause_contract '{}' \
  --accountId "${ACCOUNT_ID}" \
  --networkId "${NETWORK}" \
  --depositYocto 1 \
  --gas 300000000000000

echo "Pause submitted. Verify with: near view ${ACCOUNT_ID} get_contract_status --networkId ${NETWORK}"
