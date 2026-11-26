# Release signatures and publisher custody

The canonical producer supports `chaessi.preset.release/1` and `chaessi.preset.keys/1`. It signs printable-ASCII canonical JSON with Node Ed25519. The signature covers the schema ASCII bytes, one NUL byte and the original canonical JSON. A signature file is exactly 88 standard-Base64 ASCII bytes plus one LF. The public key is raw32 bytes and its ID is lowercase SHA-256.

The issuer is `chaessi-studio`, product is `chaessi-preset`, and supported transfer protocol is `chaessi.prompt-transfer/1`. Existing APIs default to the private realm; public validation/signing must explicitly pass `{channel:'public'}`. The generic encrypted-PKCS8 CLI uses `--channel public`. Public/private key sets cannot authorize releases across realms. Reader pins the trusted public anchor independently; sidecars never introduce a trusted root.

## Full-package binding

`createRelease()` inventories a completed runtime, including native modules, receiver, resources and app content, and separately hashes the Portable launcher. Paths reject traversal, ADS, case collisions, Windows device names and reparse entries. `verifyPackage()` rechecks the exact tree and launcher; authoring uses the original artifact name. Reader additionally validates a user-selected stable path, actual process handles/PIDs/creation time/ancestry, extracted receiver and socket. A renamed Portable keeps its signed JSON bytes and uses companion files beside the actual selected name.

After signing, no executable or runtime byte may change. File modifications require a fresh manifest and signature. Reader retains nonce/HMAC, revision/stale checks, preview, explicit user apply/cancel and atomic Undo. A signature is not a replacement for live process authentication.

## Windows publisher custody

`production-key-vault.mjs` is the Windows DPAPI provider. `init --primary VAULT --backup BACKUP` is a one-time, explicitly authorized operation that refuses existing content. It creates separate Ed25519 root/release keys and independently DPAPI CurrentUser encrypts each copy. Exact new directory roots receive current-user ownership, blocked inheritance and current-user-only FullControl. Existing ACLs are never loosened. Reparse paths and overlap of either entire custody root with source/runtime/output/deployment are rejected before key use.

The fixed Windows PowerShell provider receives binary PKCS8 only through a process pipe. No secret is supplied in arguments/environment or logged. Unrelated credential variables and PowerShell7 module paths are not inherited. Controlled plaintext buffers are cleared; guaranteed deletion of every crypto/GC memory copy is not claimed.

`recover-check --primary VAULT --backup BACKUP` decrypts the independent backup in memory, compares public identities and verifies a signing challenge. This proves same-profile backup key recovery, not a destructive primary-folder/whole-machine recovery drill. Both copies require the user's Windows DPAPI profile/master keys. A second local drive is not physically offline or independent-user disaster recovery. Separate cryptographic roles currently share one Windows custodian; two-person control is an organizational procedure, not enforced by this tool. Same-user malware and administrator compromise are outside this boundary.

## Subsequent releases, rotation and expiry

- `keyset --primary VAULT --backup BACKUP --output NEW-DIRECTORY` issues the next root-signed public key set.
- `sign-release --primary VAULT --backup BACKUP --runtime FROZEN-RUNTIME --launcher FROZEN-EXE --receiver RELATIVE-EXE --release-id UNIQUE-ID --version SEMVER` verifies and signs the next public release.
- `add-release-key --primary VAULT --backup BACKUP` creates a protected replacement key. Issue a higher key set before signing with it.
- `keyset ... --revoke KEYID[,KEYID]` adds cumulative revocations. Do not remove a previously accepted revocation by lowering counters.

Ordinary Preset updates and release-key rotation keep the same root and do not require Reader rebuilding. Root compromise requires a verified Reader trust-anchor update. Old-code rollback is issued as a new higher-sequence signed release. Never regenerate a root to fix an ordinary build/signing failure.

An exclusive lock and mirrored primary/backup public ledgers serialize issuance. Pending operations, stale locks, divergent ledgers and output collisions fail closed. Preserve attempted files and both ledgers for the signing owner. Do not erase locks/pending records or reuse reserved sequences. Recovery must reconcile exact issued bytes and retain/burn the highest reservation before issuing a higher sequence; automatic counter reset is unavailable.

The current policy is annual custody/recovery review, at most365 days for release keys/key sets and at most180 days for releases, additionally capped by signer/key-set expiry. The publisher renews and distributes signed metadata before expiry. Offline consumers cannot know unseen revocations; expiry is a bound, not instant revocation distribution. The production trust fingerprint is published with the official Reader and release metadata.

## Alternative encrypted-PKCS8 provider

`sign-preset-release.mjs` accepts existing encrypted Ed25519 PKCS8 outside source and deployment paths. A dedicated inherited fd3 pipe provides its passphrase; argv/environment passphrases are refused. `sign-keyset --metadata INPUT.json --key-file ENCRYPTED-KEY --passphrase-fd 3 --output NEW-DIRECTORY --channel public` signs a strict key set. `sign-release --metadata INPUT.json --key-file ENCRYPTED-KEY --passphrase-fd 3 --runtime RUNTIME --launcher EXE --keyset KEYS.json --keyset-signature KEYS.sig --root-public ROOT.bin --channel public` constructs hashes itself and writes the four external sidecars. Release inputs contain only releaseId/version/sequence/issuedAt/expiresAt/keyId/minKeysetSequence/receiver/layout.

The user Portable ZIP contains the EXE and four companion files at one root. Users extract the ZIP and run the EXE; they do not handle an unpacked runtime. Publisher private keys, credential stores and personal data are excluded from the bundle. Public keys/metadata/signatures are public; private keys never belong in source, artifacts or general logs.

Synthetic regressions are `tests/signed-release.test.mjs`, `tests/signed-release-cli.test.mjs` and `tests/public-release.test.mjs`. They use disposable generated test keys and do not replace the actual packaged Reader/Preset acceptance checks.
