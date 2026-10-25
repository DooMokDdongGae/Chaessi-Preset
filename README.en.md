# CHAESSI PRESET v3.8.0

[Windows x64 Portable](https://github.com/DooMokDdongGae/Chaessi-Preset/releases/download/v3.8.0/Chaessi-Preset-v3.8.0-x64.exe) · [v3.8.0 Release](https://github.com/DooMokDdongGae/Chaessi-Preset/releases/tag/v3.8.0) · [SHA256SUMS.txt](https://github.com/DooMokDdongGae/Chaessi-Preset/releases/download/v3.8.0/SHA256SUMS.txt) · [English camera guide](docs/CAMERA.en.md)

[한국어](README.ko.md) · [English](README.en.md) · [日本語](README.ja.md)

<a id="user-en"></a>
## English

### v3.8.0: a camera you can calibrate and edit

Explore another composition from an existing image’s conditions. **Start with automatic tag mapping, then calibrate strength at the position you want and edit the text yourself.**

- Start from History, the latest result or readable NAI image metadata. Confirm only missing baseline information. Selecting an image does not automatically make it I2I input.
- Drag the sphere handle or choose eight directions, including both front diagonals, sides, rear diagonals and back, with intermediate positions. Adjust pan/tilt in place, height, framing, roll and output aspect ratio.
- At +40°, changing diagonal 1.1 to 1.5 keeps the camera and other weights unchanged. The correction continues at +50° and reproduces at +40°. Multiple correction points and individual removal are supported.
- Edit identity, clothing, action, background and camera text. Keep manual text or reconnect camera control. Disabling camera retains the valid current text in the ordinary workbench.
- Reset camera, disable calibration, restore the source or undo. Resume source-specific work and History camera records. A result becomes a new source only when explicitly selected.

**Quick start:** select image → Explore with camera → move a handle → edit weights or text for the next generation → Generate this view → compare, edit or restore. Controls alone never generate. Exact pose, gaze, background and physical 3D reconstruction are not guaranteed. Pan/tilt/height and the gaze experiment can be unstable.

[English camera guide](docs/CAMERA.en.md) · [Detailed trilingual release notes](.github/releases/v3.8.0.md)

**Generate with NovelAI. Organize and finish with CHAESSI PRESET.** One connected workspace for prompts, character and outfit presets, image generation, composition editing, inpainting, finishing tools, and reusable results.

Choose a preset → edit prompts → generate with NovelAI → inspect → edit, expand and finish → save in History → reuse for the next task

### Composition, pixels and image sizes

- **Expand composition:** keep the familiar round brush while dragging the picture, resizing corners and using a rotation handle. Extend frame edges to select empty space automatically. Carry the mask from existing Inpaint, then paint or erase extra areas.
- **Review and continue:** inspect the actual source, generation mask and result application area; add character descriptions and positions. Compare preserved-original and full-generated variants from one response. Adopt a result to keep painting, or try another arrangement from the source. Restore saved placement from History or reopen a JSON editing session saved before generation.
- **Pixel Snap:** locally clean up an existing pixel-art grid. Use automatic suggestions and confidence, manual spacing/offsets, palette/color/transparency/edge settings, zoomed comparison, PNG export scale and History chaining. It costs 0 Anlas and needs no account. It does not generate pixel art from ordinary photos and is independent of the official NovelAI algorithm/output.
- **Official-style image sizes:** choose Small / Normal / Large / Wallpaper / Custom and an orientation, inspect exact W×H, then apply or cancel. Wallpaper Square is unavailable. Custom uses multiples of 64 and at most 3,145,728 pixels; values are never rounded silently. High/Medium switches preserve dimensions and large generations show an estimated-cost confirmation.
- **42-chapter Help Center:** Korean, English and Japanese guides follow open → manipulate → review masks → process → compare → save/continue. Contents, search, contextual links and image zoom work offline. Fresh greenhouse-gardener and hand-coded pixel examples illustrate the workflow.

### Generation, presets and finishing

Manage full/Base Prompt/Character/outfit presets, categories/subcategories, search/sorting, Wildcards and Character Prompt/Position as reusable production assets. Save / Save As, unsaved indicators, previous-work recovery and Saved revisions help revisit edits. Generated and processed results become separate History PNGs that can be reused as sources, settings or the next editing step.

New generation supports **NovelAI V5 Full High / Medium**, Text to Image / Image to Image / existing round-brush Inpaint, Seed and Character Prompt/Position. Medium uses fixed generation settings and does not apply custom Base/Character undesired prompts. Editing text is retained for a return to High.

Server-based tools: **Upscale, Enhance / Max✨ Enhance, Remove Background, Line Art, Sketch, Colorize, Emotion, Declutter, Outpainting and Focused Inpaint**. Each has its own input/output limits and service conditions. **Canvas drawing and Pixel Snap are local**. Composition generation and server finishing tools make NovelAI requests.

### Start, update and compatibility

Place the Windows x64 Portable EXE in a folder and run it; no installer or separate Node.js is required. Choose a language and supply your own NovelAI token in API Settings for online generation. Edit a preset, generate one image, continue in image tools, then save PNG. Find current instructions in App info → Help Center. The old v3.4.0 PDFs are historical references.

Existing full/Base/Character/outfit presets, categories, Wildcards, History and language remain usable without a forced library-wide conversion. Legacy V4.5 presets, History and PNG metadata remain readable, editable and savable; **new V4.5 generation is unsupported**. Choose V5 for new generation.

Before updating, save presets and editing JSON, close the app and back up **%APPDATA%\Chaessi Preset** (or the actual customized data folder). Keep external data and replace only the EXE. To roll back, close the app and use **the old EXE together with a backup from that version**. Do not assume an old version understands every new composition/processing record. There is no automatic updater or recovery of unsaved edits after quitting. [Update and rollback](https://github.com/DooMokDdongGae/Chaessi-Preset/blob/main/docs/UPDATING.md)

### Account, cost and limits

The app is free; your NovelAI account, generation access and service usage are separate. Server requests may use Anlas or V5 Stamina depending on settings and account conditions. Estimates may differ from actual debit; large images or small masks are not always free. Never share tokens, personal History or backups. Failed paid requests are not retried automatically.

V5 Precise Reference, Vibe Transfer, ControlNet, a general-generation V5 Curated selector, video and multi-image batches are unsupported. Generation makes one image at a time. Preservation protects the transformed source outside the result application area; it does not mean every tool leaves the entire original unchanged. Seams, subject counts, marker accuracy and automatic grid detection are not guaranteed. Composition editing arranges a single image plane; it is not a 3D rotation, multilayer or perspective editor.

The Windows EXE is unsigned and Windows may warn. Verify the repository download and SHA-256 below; do not disable security protections wholesale. No macOS/Linux distribution, code-signing certificate or automatic updater is provided.
