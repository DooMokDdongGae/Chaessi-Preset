# Chaessi Preset local MCP

한국어: 다른 작업 세션에서 저장된 카테고리·프리셋·History·원본 이미지를 읽을 수 있게 하는 로컬 연결입니다. 앱을 실행하지 않아도 사용할 수 있습니다. 생성·삭제·JPG 변환·게시글 작성·업로드는 이 MCP의 범위에 포함하지 않습니다.

English: A local, read-only connection to saved categories, presets, History and original images. The application may be open or closed. Image generation, deletion, conversion and post creation/upload remain separate workflows.

日本語: 保存済みのカテゴリ・プリセット・履歴・元画像を読み取るローカル接続です。アプリの起動中・終了後のどちらでも利用できます。生成・削除・画像変換・投稿作成は別の作業です。

## Connect in Codex

Requires Node.js 20 or later. Run `npm ci` in the application source checkout once. Codex starts the MCP process on demand over stdio; no web port or public server is opened.

In Codex's MCP settings, add a STDIO server:

- Name: `chaessi-preset`
- Command: the local Node.js executable (`node` if it is on PATH)
- Arguments: the absolute path to `mcp/server.mjs`, followed by `--data-root` and the app's user-data directory.

The user-data directory **contains `data/`**. Do not select `data/` itself. On Windows the packaged app normally uses `%APPDATA%\Chaessi Preset`. Verify the actual data directory if you use a development or customized launch. Explicit `--data-root` takes precedence over `CHAESSI_USER_DATA_DIR`. Without either setting, this MCP uses `%APPDATA%\Chaessi Preset` on Windows and reports missing data rather than silently creating a new library.

Equivalent CLI example (replace the placeholders; do not copy them literally):

```powershell
codex mcp add chaessi-preset -- node '<absolute checkout>/mcp/server.mjs' --data-root '<app user-data directory>'
codex mcp get chaessi-preset
```

Restart the MCP connection / refresh the local client after adding it. Existing active sessions may need to be reopened before newly configured tools appear. This is a local Codex connection, not a remote ChatGPT web connector.

## Available tools

| Tool | Data |
| --- | --- |
| `get_status` | Selected data directory, availability and read-only status |
| `list_categories` | All built-in/custom Character categories, subcategories and counts |
| `list_presets` | Names and prompts, category filters, search, locale/name/date sorting and pagination |
| `get_preset` | One Character/full/Base/negative/settings preset |
| `list_history` | Current saved images, ids, timestamps, original paths; oldest/newest order |
| `get_history` | Actual final prompts, Character prompts, saved prompt parts and image path |
| `get_history_image` | Unchanged PNG as an MCP image, up to 6 MiB; larger images use the local path |

## Multiple categories and stable ordering

No category is hard-coded. Use exact `name` values from `list_categories`, including bilingual subcategory names. `list_presets.filters` is an array: each element matches a category and/or subcategory, and multiple elements are combined as a union. Make separate calls when separate category groups are needed.

```json
{
  "kind": "character",
  "filters": [
    {"category": "<first category>", "subcategory": "<first subcategory>"},
    {"category": "<another category>"}
  ],
  "sort": "name-asc",
  "locale": "ko",
  "limit": 100
}
```

Sort modes: `name-asc`, `name-desc`, `created-asc`, `created-desc`, `updated-asc`, `updated-desc`. Locales: `ko`, `en`, `ja`. Preset name comparison is shared with the app, including numeric names and id tie-breaks.

History defaults to **oldest-first**; the app gallery displays **newest-first**. `ordinal` is the position in the requested ordering, not a stored preset/image association. Category names of individual applied Character Presets are not reliably stored in existing History. An agreed creation order can be used by the caller, but it must not be presented as verified provenance. Check counts, timestamps and final prompts where appropriate.

Lists include `total`, `next_offset` and `snapshot`. For additional pages pass `offset: next_offset` and `expected_snapshot: snapshot`. If saved records change while paging, the tool reports `snapshot_changed`; restart at offset 0. Invalid/incomplete records are skipped and counted. These snapshots detect changes between reads; they do not lock the live app or freeze its data. Text responses are limited to 2 MiB; reduce the page size or narrow the filter if a response is too large.

History reads preserve the final random/Wildcard resolution from the saved request. Preset reads show the currently saved definition. Original PNGs still contain their original metadata; a separate workflow must create sanitized JPGs before publication. The MCP never changes the original files.

## Maintenance

```powershell
npm run test:mcp
```

`mcp/` and its runtime SDK dependencies are included in future app packaging. A source-based connection remains independently launchable with Node.js and does not need an app build. This change assigns no new application release version.

Only selected data sections are read. Credentials, `.env`, imported raw metadata, raw generation payloads, source images, masks and references are excluded. File paths and junctions are checked against the permitted section before access. STDOUT is reserved for the MCP protocol; startup errors use STDERR.

Connection reference: [official Codex MCP documentation](https://developers.openai.com/codex/mcp).
