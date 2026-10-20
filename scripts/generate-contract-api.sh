#!/usr/bin/env bash
# Regenerate NEAR ABI + human Markdown API reference under docs/.
#
# Usage (from repo root):
#   ./scripts/generate-contract-api.sh
#
# Requires: cargo-near, Node.js (for Markdown render)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

mkdir -p docs

echo "→ Generating NEAR ABI..."
cargo near abi --out-dir docs

# cargo-near names the file from the crate; normalize to the stable path.
ABI_SRC="$(find docs -maxdepth 1 -type f -name '*_abi.json' ! -name 'contract-abi.json' | head -n 1 || true)"
if [[ -n "${ABI_SRC}" ]]; then
  mv -f "${ABI_SRC}" docs/contract-abi.json
elif [[ ! -f docs/contract-abi.json ]]; then
  echo "error: expected docs/*_abi.json or docs/contract-abi.json after cargo near abi" >&2
  exit 1
fi

echo "→ Rendering docs/CONTRACT_API.md..."
node scripts/abi-to-markdown.mjs docs/contract-abi.json docs/CONTRACT_API.md

echo "✓ Wrote docs/contract-abi.json and docs/CONTRACT_API.md"
