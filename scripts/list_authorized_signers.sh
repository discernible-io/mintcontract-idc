#!/usr/bin/env bash
# List authorized fee-signer public keys for a RODiT mint contract.
# Usage: ./scripts/list_authorized_signers.sh [account_id] [network]
# account_id may also come from CONTRACT_NAME or a local (untracked) account.env.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ACCOUNT_ID="${1:-}"
NETWORK="${2:-${NEAR_NETWORK_CONFIG:-mainnet}}"

if [[ -z "$ACCOUNT_ID" ]]; then
  if [[ -n "${CONTRACT_NAME:-}" ]]; then
    ACCOUNT_ID="$CONTRACT_NAME"
  elif [[ -f "$REPO_ROOT/account.env" ]]; then
    # Load only CONTRACT_NAME=value lines (no arbitrary shell from the file).
    while IFS= read -r line || [[ -n "$line" ]]; do
      case "$line" in
        ''|\#*) continue ;;
        CONTRACT_NAME=*)
          ACCOUNT_ID="${line#CONTRACT_NAME=}"
          ACCOUNT_ID="${ACCOUNT_ID%\"}"
          ACCOUNT_ID="${ACCOUNT_ID#\"}"
          ;;
      esac
    done < "$REPO_ROOT/account.env"
  fi
fi

if [[ -z "$ACCOUNT_ID" ]]; then
  echo "Usage: $0 [account_id] [network]" >&2
  echo "Provide account_id, set CONTRACT_NAME, or create a local account.env" >&2
  exit 1
fi

if ! command -v near >/dev/null 2>&1; then
  echo "Error: near CLI not found in PATH" >&2
  exit 1
fi

echo "=========================================="
echo "RODiT Contract Authorized Signers"
echo "=========================================="
echo ""
echo "Contract: ${ACCOUNT_ID}"
echo "Network:  ${NETWORK}"
echo ""

echo "Contract Configuration:"
echo "----------------------------------------"
near view "${ACCOUNT_ID}" get_config --networkId "${NETWORK}"
echo ""

echo "Authorized Signers (Public Keys):"
echo "----------------------------------------"
SIGNERS_OUTPUT="$(near view "${ACCOUNT_ID}" view_authorized_signers --networkId "${NETWORK}" 2>&1)" || {
  echo "Failed to query view_authorized_signers" >&2
  echo "${SIGNERS_OUTPUT}" >&2
  exit 1
}

mapfile -t SIGNERS < <(printf '%s\n' "${SIGNERS_OUTPUT}" | grep -oE '"[0-9a-f]{64}"' | tr -d '"' || true)

if [[ ${#SIGNERS[@]} -eq 0 ]]; then
  echo "No authorized signers found or unexpected CLI output"
  echo ""
  echo "Debug output:"
  echo "${SIGNERS_OUTPUT}"
  exit 1
fi

COUNT=0
for signer in "${SIGNERS[@]}"; do
  COUNT=$((COUNT + 1))
  echo "${COUNT}. ${signer}"
done

echo ""
echo "Total authorized signers: ${COUNT}"
echo ""
echo "=========================================="
echo ""
echo "To add a new signer:"
echo "  near call ${ACCOUNT_ID} add_authorized_signer \\"
echo "    '{\"public_key_hex\": \"YOUR_64_CHAR_HEX_KEY\"}' \\"
echo "    --accountId ${ACCOUNT_ID} \\"
echo "    --networkId ${NETWORK} \\"
echo "    --depositYocto 1 \\"
echo "    --gas 300000000000000"
echo ""
echo "To remove a signer:"
echo "  near call ${ACCOUNT_ID} remove_authorized_signer \\"
echo "    '{\"public_key_hex\": \"YOUR_64_CHAR_HEX_KEY\"}' \\"
echo "    --accountId ${ACCOUNT_ID} \\"
echo "    --networkId ${NETWORK} \\"
echo "    --depositYocto 1 \\"
echo "    --gas 300000000000000"
echo ""
