# Read-only local MCP verification

The optional local MCP exposes seven read-only tools. It is checked with `npm run test:mcp` and the v3.6.0 release candidate. See the root `VERIFICATION.md` for current results.

It reads saved categories, presets and History. It does not generate images, modify the library, or upload files. The packaged distribution includes the source and dependency licenses. Configure an explicit local data root as described in `mcp/README.md`.
