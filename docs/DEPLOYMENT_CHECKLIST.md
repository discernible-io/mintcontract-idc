# Deployment checklist

> **Before editing:** Review [`documentation-standard.md`](../docs/docs/documentation-standard.md).

**Created:** 2026-10-22

Use this list before every contract deploy or upgrade. Prefer testnet first.

## Before build

- [ ] Working tree is clean or the exact commit under review is recorded
- [ ] `Cargo.lock` matches the intended dependency set
- [ ] `account.env` is local-only (not tracked) if you use it for convenience
- [ ] Signer list for this environment is reviewed (`AUTHORIZED_SIGNERS.md`)

## Build

- [ ] Build with the documented canonical path (`cargo near` / `deploy.sh`)
- [ ] Record WASM SHA-256 of the artifact you intend to deploy
- [ ] Confirm network selection is explicit (`NEAR_NETWORK_CONFIG`, named connection, or `rpc_url` argument) — see `deploy.sh` RPC selection log lines

## Pre-upgrade / pre-deploy checks

- [ ] `get_contract_status` / `get_config` / `get_upgrade_status` look sane on the target account
- [ ] Upgrade delay is at least 24 hours for mainnet (`86400` seconds)
- [ ] Fee and minting status match operator intent
- [ ] Testnet rehearsal of the same artifact completed when changing mainnet

## Deploy / upgrade

- [ ] Deploy or propose upgrade with owner credentials and 1 yocto where required
- [ ] Wait the full upgrade delay before finalizing a mainnet upgrade
- [ ] Re-run `./deploy.sh verify <account> <network>` (or `status`) after the change

## Post-deploy

- [ ] Spot-check mint / pause / resume paths appropriate to the change
- [ ] Confirm authorized signers still match the intended set
- [ ] Archive the WASM hash and commit SHA in the operator log
