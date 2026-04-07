# Pre-Deployment Security Checklist

Use this checklist before deploying to mainnet or making significant changes.

## Pre-Deployment Checks

### 1. Code Security
- [ ] All code reviewed for security vulnerabilities
- [ ] No hardcoded private keys or secrets in code
- [ ] All `TODO` and `FIXME` comments addressed
- [ ] Debug logging disabled in production build (`#[cfg(debug_assertions)]`)
- [ ] Arithmetic operations use checked math
- [ ] Input validation on all user-supplied data

### 2. Access Control
- [ ] Owner account verified and secured
- [ ] Authorized signers list reviewed and documented
- [ ] All admin functions require owner check
- [ ] 1 yoctoNEAR protection on state-changing functions
- [ ] Rate limits configured appropriately

### 3. Upgrade Safety
- [ ] Upgrade delay set to 24 hours for mainnet
- [ ] Upgrade mechanism tested on testnet
- [ ] State migration tested (if applicable)
- [ ] Rollback plan documented

### 4. Fee Configuration
- [ ] Initialize fee set appropriately (default: 0.0001 NEAR)
- [ ] Contract fee percentage reviewed (default: 1%)
- [ ] Storage cost per byte verified (default: 0.00001 NEAR)
- [ ] Fee bounds enforced in code

### 5. Environment Security
- [ ] `account.env` in `.gitignore`
- [ ] Private keys stored in `~/.near-credentials/` only
- [ ] File permissions set to 600 for credential files
- [ ] No credentials in environment variables or scripts
- [ ] Deployment scripts reviewed for security

### 6. Testing
- [ ] All functions tested on testnet
- [ ] Edge cases tested (overflow, underflow, empty inputs)
- [ ] Rate limiting tested
- [ ] Signature verification tested with valid/invalid signatures
- [ ] Token minting, transfer, and burning tested
- [ ] Upgrade process tested end-to-end

### 7. Documentation
- [ ] `README.md` updated with current version
- [ ] `SECURITY.md` reviewed and current
- [ ] `AUTHORIZED_SIGNERS.md` updated with current signers
- [ ] API documentation complete
- [ ] Deployment guide tested and accurate

### 8. Monitoring & Incident Response
- [ ] Contract status monitoring configured
- [ ] Event monitoring configured
- [ ] Alerting for suspicious activity
- [ ] Incident response plan documented
- [ ] Contact information for security issues published

### 9. Backup & Recovery
- [ ] Contract state backup available
- [ ] Recovery procedures documented
- [ ] Token recovery process tested
- [ ] Owner account recovery plan in place

### 10. Network Configuration
- [ ] Correct network selected (mainnet vs testnet)
- [ ] RPC endpoint verified and reliable
- [ ] Network connection tested
- [ ] Gas limits appropriate for all functions

## Post-Deployment Verification

After deployment, verify:

- [ ] Contract deployed to correct account
- [ ] Contract initialized successfully
- [ ] Owner set correctly
- [ ] Authorized signers added
- [ ] Fee configuration correct
- [ ] Contract status is "Active"
- [ ] Test mint operation successful
- [ ] Events emitting correctly
- [ ] View functions returning expected data

## Mainnet-Specific Checks

Additional checks for mainnet deployment:

- [ ] Sufficient NEAR balance for deployment (~1-2 NEAR)
- [ ] Owner account uses hardware wallet or secure key management
- [ ] Testnet deployment successful and stable for 7+ days
- [ ] Security audit completed (if required)
- [ ] User communication plan for upgrade notifications
- [ ] Legal/compliance review (if applicable)

## Emergency Procedures

Know how to:

- [ ] Pause the contract: `near call <account> pause_contract '{}' --accountId <owner> --depositYocto 1`
- [ ] Resume the contract: `near call <account> resume_contract '{}' --accountId <owner> --depositYocto 1`
- [ ] Remove compromised signer: `near call <account> remove_authorized_signer '{"public_key_hex":"..."}' --accountId <owner> --depositYocto 1`
- [ ] Propose emergency upgrade: `near call <account> propose_upgrade '{}' --accountId <owner>`

## Sign-Off

- [ ] Developer sign-off: _________________ Date: _______
- [ ] Security reviewer sign-off: _________________ Date: _______
- [ ] Operations sign-off: _________________ Date: _______

---

## Notes

Use this space to document any deployment-specific notes, exceptions, or special considerations:

```
[Add notes here]
```
