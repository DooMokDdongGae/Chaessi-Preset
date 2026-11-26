# v3.9.0 release specification

This source is the PUBLIC product preparation candidate. Final signature, build and publication belong to the release integrator.

| Field | Value |
| --- | --- |
| Package / displayed version | 3.9.0 |
| Windows build version | 3.9.0.1 |
| Product / app ID | Chaessi Preset / app.chaessi.preset |
| Entry point / receiver | electron/main.mjs / Chaessi Preset.exe |
| Portable launcher | Chaessi-Preset-v3.9.0-x64.exe |
| Portable distribution bundle | Chaessi-Preset-v3.9.0-x64.zip |
| Planned tag | v3.9.0 |
| Channel / protocol | public / chaessi.prompt-transfer/1 |
| Reader baseline | official PUBLIC Reader 1.1.0 with matching production trust root |
| User profile | existing %APPDATA%/Chaessi Preset; preserve configured data path and secure saved tokens |

3.8.5 is the existing public patch line. Precise Reference and the independent library add supported functionality, so 3.9.0 is a minor release. Do not replace old tags/releases or publish PRIVATE ancestry. Project reviewed files onto the existing PUBLIC lineage, using the supplied source allowlist, then integrate the signing owner's separately reviewed production tooling.

The final ZIP contains exactly these five files at its root:

- Chaessi-Preset-v3.9.0-x64.exe
- Chaessi-Preset-v3.9.0-x64.exe.chaessi-release.json
- Chaessi-Preset-v3.9.0-x64.exe.chaessi-release.sig
- chaessi-publisher-keys.json
- chaessi-publisher-keys.sig

Publish the ZIP, its SHA-256 and the Portable EXE checksum. If exposing the EXE as a separate asset, expose its four companion files together as well; the ZIP is the user download entry. The launcher and internal extracted runtime are signed only after all content and dependencies are frozen. The existing Portable layout stays intact; no user handles an unpacked runtime manually.

The production signer must set channel public, the approved production keyset and monotonic sequence. No test key/root, A/B fixture metadata, review profile, private history, credential, user image or personal History is public. Release sequence and keyset sequence belong to signing authority and are independent of Windows build version. Production key fingerprints, final checksums, signature expiry and actual PUBLIC commit must be filled by the integrator after signing; this candidate intentionally does not invent them.

Release order: Reader 1.1.0 PUBLIC and trust-root confirmation; source projection and packaging checks; final Portable/runtime build; production signing and rejection tests; minimum Reader connection/preview/apply/cancel/Undo confirmation; ZIP and checksum validation; PUBLIC source/tag/Release/Latest; anonymous HTTPS file-size/hash checks. Never edit signed bytes after signing.

Existing 45 generated images / 239 Anlas and accepted feature regressions are reused, with no additional paid generation. Windows OS file-drop GUI, development verification timings (connection about 14.35 s, preview about 6.97 s), and Chrome/Inspect online retest remain documented practical-use follow-ups. Actual signature or repeated connection/transfer defects must be corrected before publication.

Installed apps, Downloads and real profile data are outside this preparation. No source worktree or development profile is copied to the installed app folder.
