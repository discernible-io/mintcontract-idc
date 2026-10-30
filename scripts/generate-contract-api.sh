#!/usr/bin/env bash
# Regenerate the NEAR ABI JSON under docs/.
#
# Usage (from repo root):
#   ./scripts/generate-contract-api.sh
#
# Requires: cargo-near
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

mkdir -p docs

echo "→ Generating NEAR ABI..."
cargo near abi --out-dir docs

# cargo-near names the file from the crate; normalize to the stable path.
ABI_SRC="$(find docs -maxdepth 1 -type f -name '*_abi.json' ! -name 'abi-contract.json' | head -n 1 || true)"
if [[ -n "${ABI_SRC}" ]]; then
  mv -f "${ABI_SRC}" docs/abi-contract.json
elif [[ ! -f docs/abi-contract.json ]]; then
  echo "error: expected docs/*_abi.json or docs/abi-contract.json after cargo near abi" >&2
  exit 1
fi

echo "✓ Wrote docs/abi-contract.json"
