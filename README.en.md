# CHAESSI PRESET v3.8.5

The v3.8.5 source and review build are ready. The v3.8.5 GitHub Release awaits separate approval and has not been published. The current public download is [v3.8.4 Windows Portable and SHA-256 checksums](https://github.com/DooMokDdongGae/Chaessi-Preset/releases/tag/v3.8.4).

[한국어](https://github.com/DooMokDdongGae/Chaessi-Preset/blob/main/README.ko.md) · [English](https://github.com/DooMokDdongGae/Chaessi-Preset/blob/main/README.en.md) · [日本語](https://github.com/DooMokDdongGae/Chaessi-Preset/blob/main/README.ja.md)

v3.8.5 adds wide and tall image sizes and lets you bring selected text from Metadata Reader into the current draft. [Read all 41 chapters online](https://doomokddonggae.github.io/Chaessi-Preset/v3.8.5/?lang=en&chapter=start)

**A local workbench for reusing your prompts, characters, outfits and results across generation and editing.** Generate with your NovelAI account, then organize the materials and continue the work in Chaessi Preset.

“The creator controls and revises the prompts and process to finish the result, instead of asking AI to decide everything.” Saved presets, reviewable generation text, manual weights, source recovery and History reuse serve that purpose.

[v3.8.5 release notes](.github/releases/v3.8.5.en.md) · [Camera guide](docs/CAMERA.en.md)

## Wide and tall image sizes

Choose **Image size** at the bottom of the workbench, then **Normal** or **Large**. Check the width × height on the button and choose **Apply size**. The new Wide landscape and Tall portrait buttons are workbench shortcuts for V5 custom dimensions.

| Size | Standard landscape | Wide landscape | Standard portrait | Tall portrait | Square |
| --- | --- | --- | --- | --- | --- |
| Normal | 1216 × 832 | 1344 × 768 | 832 × 1216 | 768 × 1344 | 1024 × 1024 |
| Large | 1536 × 1024 | 1664 × 960 | 1024 × 1536 | 960 × 1664 | 1472 × 1472 |

Try Wide landscape for a group or a broad background. Tall portrait gives you more vertical space for a full-length figure. Framing depends on the prompt and the generated result. The starting size is 832 × 1216. Small, Wallpaper, Custom and width/height swap are still available. Your saved sizes, prompts and camera settings stay as you set them. Large uses more pixels and can change the cost. Check the estimate before generating. [Image size guide](https://doomokddonggae.github.io/Chaessi-Preset/v3.8.5/?lang=en&chapter=settings)

<a id="reader-setup"></a>

## Set up and connect Metadata Reader

Chaessi Metadata Reader is distributed separately. Obtain a package that can **select running Preset windows** and supports **chaessi.prompt-transfer/1** from your Reader provider. The compatibility reference is Reader revision **4dbdd1d**. On Windows, use Python 3.10 or later with Tcl/Tk, Chrome 120 or later, and Reader bridge extension 0.3.1.

### First-time setup

1. Run `python -B chrome_bridge/extension/prepare.py` in the Reader folder. In your usual Chrome profile, open `chrome://extensions`, enable Developer mode, choose **Load unpacked** and select the Reader package’s `chrome_bridge/extension` folder.
2. Run **Start Reader.cmd**. Find the locally generated connection key as described in **docs/INSTALL.ko.md** in the Reader package. In the extension’s setup page, enter it in **리더의 연결 키** (Reader connection key) and choose **최초 연결 저장** (save pairing).
3. Choose **NovelAI Inspect 접근 허용** (allow NovelAI Inspect access) and approve the Chrome permission. Once Reader shows Chrome is connected, you can import from Inspect.

### Send text to Preset

1. Select an image in NovelAI Inspect in Chrome and choose **Import from NovelAI Inspect** in Reader. Edit the prompt, highlight the words you want, and choose **Add selection**.
2. Choose **Send to Preset → Connect to Preset**. Open the single-file Portable yourself first. Under **Running Presets**, check the version, executable path and PID, then choose **Connect to this Preset**. For a folder build, you can register the directly running EXE and approve its launch when it is closed.
3. Assign a Base or Character field and **Append** or **Replace** to each row. Choose **Review changes in Preset**. In the receiving window, compare the current and final text, then choose **Apply to draft** or **Cancel**.
4. Use **Undo Reader transfer** to reverse the last transfer. Choose **Save** at the top of the workbench yourself to keep the edits. Transfer needs no NovelAI token or paid generation and does not automatically save, write History or generate an image.

[Nine-step Reader connection guide](https://doomokddonggae.github.io/Chaessi-Preset/v3.8.5/?lang=en&chapter=reader-transfer)

## v3.8.4 — Inpaint zoom and outpaint canvas controls

Use the wheel or +/− to zoom the Inpaint view. Wheel zoom follows the cursor. Toggle Pan view or drag with the middle button. Use Fit view or 100% to reset the view. Brush and eraser strokes stay aligned to source pixels at every zoom level, with Undo/Redo available.

Choose **Outpaint with custom canvas** in workbench Inpaint or Image tools → Outpainting. Select 1:1, 9:16 or 16:9, or enter Width and Height and apply the output size. Drag the source to position it and use a corner handle to resize it. Check the empty area to be filled, then review the image and mask before generating.

Base and each numbered Character prompt field now remember their own preset display limit, Show all mode, scroll position, and sorting. Applying a preset or reopening the picker restores that field's last position. **Load more** adds 50 presets at a time, and **Show all** displays every matching item. Changing search, categories, or sorting scrolls only the current field's list to the top. Restarting the app resets each field to 50 items and the top of the list.

[Release Notes](https://github.com/DooMokDdongGae/Chaessi-Preset/blob/main/.github/releases/v3.8.4.en.md)

## 2026-10-28 — Wildcard selection update

Choose Random or Sequential in the existing Wildcard manager. Sequential cycles through the saved order and shows the next candidate. It advances once after generation and History saving succeed; Sample, preview, cancellation and failure do not consume a position. Restarting retains the position; **Start from first** resets it. Existing Wildcards remain Random. [Wildcard guide](https://doomokddonggae.github.io/Chaessi-Preset/v3.8.4/?lang=en&chapter=wildcards)

## Continue a piece of work

Build a preset → edit prompts → generate with V5 → inspect → adjust camera and text → use image tools → keep in History → reuse.

**Image provenance:** The workflow below is a historical v3.8.1 example, not an image-quality result from the v3.8.2 camera.

![Real workflows from user-provided artwork](assets/manuals/examples/workflow.webp)

① User source ② actual generation with changed camera text ③ source scaled and rotated with newly generated empty space ④ actual background removal. These are branches from the same source, not one linear processing chain. The camera does not automatically send the selected picture as I2I input.

## Features

| Task | Available controls |
|---|---|
| Reusable materials | Full, Base, Character, negative and settings presets; character/outfit categories and subcategories; search, sorting and Wildcards |
| Editing and recovery | Save / Save As, unsaved indicators, previous work and saved revisions, expanded prompt editor |
| V5 Full generation | High / Medium, one image per request, seed, Character Prompt/Position, text to image, I2I and round-brush Inpaint |
| Camera | Absolute front 0° before the first generation; sphere, direction, elevation, shot size, height, pan, tilt and roll; per-axis weights/manual text; ON/OFF, Base conflict review and separate saved work |
| Expand composition | Move, scale and rotate; extend the frame; automatic gaps and round-brush masks; add characters; review source/masks; compare preserved/full results; restore editing JSON and History |
| Image tools | Upscale, Enhance / Max✨ Enhance, Remove Background, Line Art, Sketch, Colorize, Emotion, Declutter, Outpainting and Focused Inpaint |
| Local editing | Canvas pen, eraser, fill, crop, resize and Undo/Redo; Pixel Snap grid cleanup. Both run locally for 0 Anlas |
| Reuse | History PNGs, settings and operation records; PNG/WebP metadata import; compare, save and hand results to I2I/Inpaint |
| Help | 41 chapters in Korean, English and Japanese, with search, contents, contextual links and image zoom; available offline in the app |

![Actual workbench](web/help/assets/manuals/en/docs-workbench.png)

v3.8.2 workbench displaying user-provided help artwork. The text and settings illustrate controls; they are not this artwork’s original generation settings or a result of the new camera.

## Absolute camera in v3.8.2

The camera was rebuilt from v3.7.0. Instead of confirming a source angle and applying relative moves and position-specific corrections as in v3.8.0/3.8.1, you choose an absolute target view relative to front 0°.

The camera is OFF at app startup. **New camera** starts ON at front 0°, elevation 0°, upper body and strength 1. Move the sphere horizontally for direction and vertically for elevation. Shot size, height, pan, tilt and roll have separate controls.

Per-axis strength emphasizes wording; 1 is the default. Manual wording remains until you select Auto for that row. Camera text is added before the Base used for generation. Your editable Base, Character text and Position stay intact.

You can exclude recognized standalone camera tags from the generation Base. This can include a single emphasized tag; multi-tag groups and Character tags remain. Known remaining conflicts require acknowledgement in the final text review. Turn Camera OFF to return to ordinary generation.

Starting a new camera from an image or History starts in T2I at front 0°. Explicitly resuming saved v3.8.2 camera work restores its angles and wording. Work does not resume automatically after restart. Camera work does not save input images or masks: prepare those separately for I2I/Inpaint.

![v3.8.2](assets/manuals/en/camera-absolute.png)

Camera settings send composition and viewpoint instructions to the image model. Results depend on your prompt and the model’s interpretation. Actual NovelAI image quality has not yet been evaluated for the new camera.

Exact 3D rotation, left/right distinction and fixed identity, pose or background are not guaranteed. Both sides may produce the same wording; height, pan and tilt wording is experimental. Read the final text because the app cannot detect every semantic conflict in free prose.

[The new absolute camera](https://github.com/DooMokDdongGae/Chaessi-Preset/blob/main/docs/CAMERA.en.md)

## Generation settings and stored data

High exposes adjustable V5 settings. Medium uses fixed settings and does not apply handwritten Base/Character negative prompts to generation. Your text is retained so you can return to High and use it again.

Presets, History images/settings and camera work are normally stored in `%APPDATA%\Chaessi Preset`. Check the actual folder if you use a custom location. Close the app and back up the whole folder before updating.

The app encrypts saved NovelAI tokens using operating-system protection. Generation and server image tools send the relevant images, text and settings to NovelAI. Canvas, Pixel Snap, saved materials and bundled help are available locally. Optional MCP integration can read saved presets and History.

## Start, update and back up

1. Download the Windows x64 Portable EXE and SHA256SUMS.txt from [Official releases](https://github.com/DooMokDdongGae/Chaessi-Preset/releases).
2. Run the EXE and choose a language. Portable users do not need Node.js. Online work requires your own NovelAI account, token and generation entitlement. In settings, open the NovelAI connection, enter and save your own token, then check the connection status. Treat the token like a password and never share it.
3. Load or write a preset, review High/Medium, size and cost, and generate one image. Continue from the latest result or History with Camera or Image tools. Open App info → Help Center for the controls.
4. Before updating, save edits, close the app and back up the complete actual data directory separately. Keep the data and replace the EXE. To roll back, use the earlier EXE together with a backup appropriate for that version.

Existing presets, categories, Wildcards and History are not batch-converted. V4.5 records remain readable, editable and saveable, but **new V4.5 generation is unsupported: explicitly switch to V5**. Older releases may not understand newer camera/composition records. Automatic updates and automatic recovery of unsaved edits after exit are not provided.

[Update details](https://github.com/DooMokDdongGae/Chaessi-Preset/blob/main/docs/UPDATING.md) · [Third-party notices](THIRD_PARTY_NOTICES.md) · [License](LICENSE)

## Cost and limitations

The app and NovelAI fees are separate. Server requests may use Anlas or V5 Stamina depending on settings and your account. Displayed costs are estimates; large images and small Inpaint masks are not always free. Failed paid requests are not retried automatically.

Custom dimensions must be multiples of 64 and total at most 3,145,728 pixels; they are not rounded automatically. Wallpaper has no Square option. Composition is 2D placement, not 3D reconstruction, a multilayer editor or perspective editing. Pixel Snap cleans an existing grid; it does not create new pixel art from ordinary illustrations. Subject counts, seams, expressions, marker locations and grid suggestions are not guaranteed.

V5 Precise Reference, Vibe Transfer, ControlNet, V5 Curated as a normal generation choice, video and multi-image batches are unsupported. Distribution targets Windows x64; macOS/Linux builds, code signing and automatic updates are not provided. If the unsigned EXE triggers a warning, verify the official source and checksum rather than disabling security protections wholesale.

Keep public artwork copies separate from originals. Check ordinary PNG metadata and hidden alpha-channel generation data. Do not share tokens, personal History, original prompts or the entire data directory.
