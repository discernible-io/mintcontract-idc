# CC-0004 — CodeCome audit package (local)

**Date:** 2026-10-20  
**Harness:** `/home/dedalo47/CodeCome`  
**Local repo:** `/home/dedalo47/mintcontract-idc`  
**Status:** EXPLOITED · HIGH  

Mint fee signature optional `owneraccount_id` enables front-run redirect on `rodit_mint`.

## Reports in this directory

| Artifact | Path |
|---|---|
| Finding (full write-up) | [finding.md](./finding.md) |
| Evidence README | [evidence/README.md](./evidence/README.md) |
| Static proof | [evidence/static-proof.md](./evidence/static-proof.md) |
| Limitations | [evidence/limitations.md](./evidence/limitations.md) |
| Phase 4 summary | [runs/](./runs/) |
| Phase 5 summary | [runs/](./runs/) |

## Linked exploit artifacts (CodeCome; do not commit)

Symlink (absolute) to harness evidence:

- **Exploits:** [`exploits/`](./exploits/) → `/home/dedalo47/CodeCome/itemdb/evidence/CC-0004/exploits`
- **Full evidence tree:** [`evidence-codecome/`](./evidence-codecome/) → `/home/dedalo47/CodeCome/itemdb/evidence/CC-0004`

Harness originals:

- Finding: `/home/dedalo47/CodeCome/itemdb/findings/EXPLOITED/` (`CC-0004-*.md`)
- Evidence: `/home/dedalo47/CodeCome/itemdb/evidence/CC-0004/`

## Path map (CodeCome `src/` → this machine)

| CodeCome audit path | Local checkout |
|---|---|
| `src/mintcontract-idc/...` | `~/mintcontract-idc/...` |

Primary code:

- `~/mintcontract-idc/src/lib.rs`
- `~/mintcontract-idc/README.md`

## Git hygiene

`security-audit/` is listed in `.gitignore` so exploit PoCs, captures, and logs are not committed. Keep remediation patches in normal source; treat this folder as a local working copy of the audit package.
