# Authorized signers

> **Before editing:** Review [`documentation-standard.md`](../docs/docs/documentation-standard.md).

**Created:** 2026-10-22

Fee signatures for minting are checked against the contract’s authorized signer public keys. This document covers operator practice only — never commit private keys or seed phrases.

## What is stored on-chain

- Authorized signers are **64-character lowercase hex** Ed25519 public keys
- Management methods are owner-only and require a 1 yoctoNEAR deposit
- List current keys with `view_authorized_signers` or `./list_authorized_signers.sh`

## Local convenience file

`account.env` may hold `CONTRACT_NAME=<account>.near` for local scripts. It must stay **untracked** (see `.gitignore`). Prefer:

```bash
export CONTRACT_NAME=your-contract.near
./list_authorized_signers.sh
# or
./list_authorized_signers.sh your-contract.near
```

## Adding or removing a signer

Use `deploy.sh add-signers` or the NEAR CLI `add_authorized_signer` / `remove_authorized_signer` calls documented in the README. After any change:

1. Re-list signers from chain
2. Confirm signing services (SignPortal / signclient) use a key that remains authorized
3. Rotate any key that may have been exposed

## Do not

- Commit `account.env`, `~/.near-credentials/`, or signer private material
- Share signer private keys in issues, chat, or CI logs
- Leave unused or unknown public keys authorized on mainnet
