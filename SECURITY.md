# Security Policy

> **Before editing:** Review [`documentation-standard.md`](../docs/docs/documentation-standard.md).

**Created:** 2026-10-22

## Reporting a vulnerability

**Do not** open public GitHub issues for security vulnerabilities in this contract or its operator scripts.

Email **rodit@identityclaw.com** with:

- Affected contract account / network (testnet or mainnet)
- A clear description of the issue and impact
- Steps to reproduce or a proof of concept when safe to share
- Your preferred contact for follow-up

We aim to acknowledge reports within a few business days and coordinate a fix and disclosure timeline.

## Scope

In scope:

- On-chain contract logic under `src/`
- Operator scripts in this repository (`deploy.sh`, `monitor_contract.sh`, signer helpers)
- Committed CI configuration and release artifacts described in the README

Out of scope unless they lead to a contract compromise:

- Third-party NEAR RPC providers, wallets, or explorers
- Social engineering against operators
- Denial-of-service against public RPC endpoints

## Operator expectations

- Keep `account.env` and NEAR credentials out of git (see `.gitignore` and `AUTHORIZED_SIGNERS.md`)
- Prefer testnet validation before mainnet upgrades
- Use the 24-hour upgrade delay and `DEPLOYMENT_CHECKLIST.md` before mainnet changes
