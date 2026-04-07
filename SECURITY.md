# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| Discernible-2026v1-identyclaw-com-20260404 | :white_check_mark: |

---

## Security Features

### 1. **Access Control**
- **Owner-only functions**: All administrative functions require caller to be contract owner
- **1 yoctoNEAR protection**: State-changing functions require exactly 1 yoctoNEAR deposit to prevent function-call access key misuse
- **Rate limiting**: Maximum 100 mints per hour per account to prevent spam

### 2. **Cryptographic Security**
- **Ed25519 signature verification**: All fee signatures verified using Ed25519
- **Signature binding**: Signatures bound to specific parameters (token_id, accounts) to prevent replay attacks
- **Multiple authorized signers**: Support for multiple signing keys with any-of verification

### 3. **Smart Contract Security Patterns**
- **Checks-Effects-Interactions**: All state changes before external calls to prevent reentrancy
- **Arithmetic overflow protection**: All arithmetic uses checked operations
- **Time-locked upgrades**: 24-hour delay for contract upgrades (mainnet)
- **Comprehensive input validation**: All metadata fields validated before storage

### 4. **Storage & Fee Security**
- **Automatic storage calculation**: Based on actual usage, not estimates
- **Storage refunds on burn**: Direct refunds to token owner
- **Configurable fees**: Owner can adjust fees within safe bounds
- **Fee distribution transparency**: Events emitted for all fee transfers

---

## Known Security Considerations

### 1. **Upgrade Mechanism**
- Contract upgrades require 24-hour delay on mainnet (30 seconds on testnet)
- Only contract owner can propose/finalize upgrades
- Contract enters "Upgrading" state during the delay period
- Users should monitor upgrade proposals via `get_upgrade_status()`

### 2. **Authorized Signers**
- Authorized signers can sign fee data for ANY minting operation
- Owner should carefully manage the authorized signer list
- Compromised signer keys should be removed immediately via `remove_authorized_signer()`
- Signer list is publicly viewable via `view_authorized_signers()`

### 3. **Rate Limiting**
- Rate limits apply per account, not per IP or device
- Users can create multiple accounts to bypass rate limits
- **Rate limit window**: 1 hour (3600 seconds)
- **Maximum mints per window**: 100 mints per account
- Consider additional off-chain rate limiting for production

### 4. **Token Recovery**
- Owner can recover tokens via `recover_token()` function
- This is intended for lost/stuck tokens only
- Users should be aware of this administrative capability
- All recovery operations emit events for transparency

---

## Security Best Practices for Operators

### 1. **Key Management**
- **Never commit private keys** to version control
- Store credentials in `~/.near-credentials/` with proper permissions (600)
- Use hardware wallets for mainnet owner accounts when possible
- Rotate authorized signer keys periodically

### 2. **Deployment Security**
- Always test upgrades on testnet first
- Review all code changes before proposing upgrades
- Monitor contract events for suspicious activity
- Keep deployment scripts (`deploy.sh`) updated

### 3. **Monitoring**
- Monitor `get_contract_status()` regularly
- Track authorized signer changes via events
- Review fee configuration changes
- Monitor rate limit violations

### 4. **Incident Response**
- If signer key compromised: immediately call `remove_authorized_signer()`
- If contract bug found: use `pause_contract()` to halt operations
- Document all security incidents
- Notify users of any security-related changes

---

## Reporting a Vulnerability

**DO NOT** open public issues for security vulnerabilities.

Instead, please report security issues via:
- Email: security@identityclaw.com (if available)
- Private disclosure to contract owner: `2026v1-identyclaw-com.near`

### What to Include
1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact assessment
4. Suggested fix (if available)

### Response Timeline
- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 7 days
- **Fix deployment**: Depends on severity (critical issues within 24-48 hours)

---

## Security Audit Status

**Status**: Self-audited  
**Last Review**: April 2026  
**Auditor**: Internal team

### Audit Scope
- Smart contract code review
- Access control verification
- Arithmetic overflow checks
- Reentrancy protection
- Input validation
- Storage management

### Known Issues
None at this time.

---

## Security Checklist for Deployment

Before deploying to mainnet:

- [ ] All private keys secured in `~/.near-credentials/` with 600 permissions
- [ ] `account.env` added to `.gitignore`
- [ ] Authorized signers documented in `AUTHORIZED_SIGNERS.md`
- [ ] Contract tested on testnet with real-world scenarios
- [ ] Upgrade delay set to 24 hours (mainnet)
- [ ] Fee configuration reviewed and set appropriately
- [ ] Rate limits configured for expected usage
- [ ] Monitoring and alerting configured
- [ ] Incident response plan documented
- [ ] Backup of contract state available

---

## Dependencies Security

### Current Dependencies
- `near-sdk = "5.14.0"` - Official NEAR SDK
- `ed25519-dalek = "1.0.1"` - Cryptographic signatures
- `serde_json = "1.0"` - JSON parsing
- `sha2 = "0.10.8"` - Hashing

### Dependency Management
- Dependencies pinned to specific versions in `Cargo.toml`
- Build script pins transitive dependencies to Rust 1.86.0-compatible versions
- Regular dependency updates should be tested on testnet first

### Known Dependency Issues
- `ed25519-dalek 1.0.1` is older but stable; consider upgrading to 2.x in future
- `base64 0.13.0` is older; newer versions available but require testing

---

## Contact

For security-related questions:
- Contract Owner: `2026v1-identyclaw-com.near`
- Repository: Check README.md for contact information
