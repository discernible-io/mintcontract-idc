# Compatible Dependency Versions for Rust 1.86.0

This document lists compatible versions of dependencies that work with Rust 1.86.0 (MSRV).

## Darling Crate Family

| Package | Version | MSRV | Compatible with 1.86.0 |
|---------|---------|------|------------------------|
| darling | 0.22.0 | 1.56.0 | ✅ Yes |
| darling | 0.21.0 | 1.56.0 | ✅ Yes |
| darling | 0.20.x | 1.56.0 | ✅ Yes |
| darling | 0.23.0 | 1.88.0 | ❌ No (requires 1.88.0) |

### Recommended Version
**darling = "0.22.0"** - Latest version compatible with Rust 1.86.0

## Serde_with Crate Family

| Package | Version | MSRV | Compatible with 1.86.0 |
|---------|---------|------|------------------------|
| serde_with | 3.16.0 | 1.76.0 | ✅ Yes |
| serde_with | 3.15.0 | 1.76.0 | ✅ Yes |
| serde_with | 3.14.x | 1.76.0 | ✅ Yes |
| serde_with | 3.17.0 | 1.82.0 | ✅ Yes |
| serde_with | 3.18.0 | 1.88.0 | ❌ No (requires 1.88.0) |

### Recommended Version
**serde_with = "3.17.0"** - Latest version compatible with Rust 1.86.0

## Summary

For Rust 1.86.0 compatibility, use:

```toml
[dependencies]
darling = "0.22"
serde_with = "3.17"
```

These versions have MSRVs of 1.56.0 and 1.82.0 respectively, both well below the 1.86.0 requirement.
