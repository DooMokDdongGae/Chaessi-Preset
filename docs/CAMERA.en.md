# CHAESSI PRESET v3.8.2

[Online camera guide](https://doomokddonggae.github.io/Chaessi-Preset/v3.8.2/?lang=en&chapter=camera-absolute)

## Absolute camera from the first image

Choose a target view from front 0° for both new and reused images.

1. Prepare Base and Character prompts, then open Absolute camera on the left. No source image is required.
2. The camera is OFF when the app starts. Turn Camera ON or choose New camera · front 0°. A new camera starts at front 0°, elevation 0°, upper body and strength 1, without asking for the source viewing angle.
3. Drag horizontally for direction and vertically for elevation. Direction buttons and arrow keys also work; Home returns to front.
4. Turn Camera OFF to use the ordinary manual prompt without an added camera block.

![Absolute camera from the first image](../assets/manuals/en/camera-absolute.png)

v3.8.2 example after setting direction to 45° and its strength to 1.5. A new camera starts at front 0° and strength 1.

The sphere is a control for choosing a view. It does not rotate a physical scene or move individual Character Position markers.

## Direction, shot size and framing

Control independent axes without blending contradictory directions.

1. Direction chooses front, three-quarter front, side, three-quarter rear or behind. Both left and right side may use from side.
2. Use the distance slider or choose close-up, upper body, cowboy shot, full body or wide shot. This describes framing, not meters.
3. Elevation adds from above or from below. The neutral band adds no elevation phrase.
4. Additional framing controls express camera height, horizontal placement (pan), aiming upward or downward (tilt), and a tilted frame (roll). Image size is selected separately; I2I/Inpaint source dimensions are not changed automatically.

![Direction, shot size and framing](../assets/manuals/en/camera-absolute.png)

v3.8.2 example after setting direction to 45° and its strength to 1.5. A new camera starts at front 0° and strength 1.

Exact left/right orientation, physical angles and independent pan/tilt effects are not guaranteed. Height, pan and tilt wording is experimental.

## Base-only wording and direct editing

Keep your editable Base text intact while reviewing the wording used for generation.

1. Camera phrases precede Base in this order: shot, direction, elevation, height, pan, tilt, roll. Character text is never moved or rewritten.
2. Edit each strength between -10 and 10. One is neutral; zero omits that row. Negative emphasis can suppress or invert an idea and may oppose the intended view.
3. Edit wording directly. Manual text survives sphere movement; Auto on that row returns to coordinate-derived wording.
4. An incomplete number such as 1. remains visible and blocks saving/generation. Complete or correct it. Weight edits never move the sphere.
5. Enter plain text of up to 300 characters. Braces, brackets, colons, vertical bars (|), Wildcards and line breaks are unsupported; use the adjacent strength control for emphasis.

![Base-only wording and direct editing](../assets/manuals/en/camera-absolute.png)

Use the per-axis wording, strength and Auto controls on the right. English prompt text is not translated when the UI language changes.

![Base-only wording and direct editing](../assets/manuals/en/camera-wording.png)

Scroll down to inspect the camera block and generated Base preview.

Weights emphasize wording; they are not direction-mixing ratios. One is the neutral default. Higher values do not necessarily improve framing or quality.

## Manual conflicts and final review

Read and decide which prompts will actually be sent.

1. Explicit camera tags in Base and Character are listed with their locations. Pose, head and gaze prose is not interpreted or deleted.
2. Optionally exclude recognized standalone camera tags from the Base used for generation, including a single emphasized tag. Originals stay intact. Groups containing multiple tags and Character tags remain.
3. Return to the workbench and press Generate. Wildcards resolve once and final prompts include quality and UC. Explicitly check to retain remaining manual expressions, or cancel and edit the originals.
4. Only Generate reviewed image sends the request. Later edits do not change the request already in progress.

![Manual conflicts and final review](../assets/manuals/en/camera-review.png)

Final wording review with no remaining conflicts. An additional acknowledgement appears when camera tags remain.

The app cannot detect every conflict in free prose, so read the final wording. Camera settings send composition and viewpoint instructions; results depend on your prompt and the model’s interpretation.

## Reuse images, History and saved work

Distinguish a new camera from resuming a saved v3.8.2 camera.

1. Start from image metadata accepts a PNG/WebP with readable generation data. It imports prompts/settings and starts a new camera at front 0° without automatic I2I.
2. Open History and choose New absolute camera to start at 0° regardless of the old view. Legacy camera metadata can be inspected read-only.
3. Resume v3.8.2 camera restores its recorded state and original editing prompts. v3.8.0/1 calibration is never converted.
4. Save camera work writes prompts/settings/camera to a separate file. Resume selected work after restarting. Resuming uses Text to Image; prepare source images/masks separately.

![Reuse images, History and saved work](../assets/manuals/en/camera-reuse.png)

Name and save the camera work at the bottom, then select saved work to resume it.

Existing presets, History and old camera files remain intact. Legacy camera details can be read in History, but old sessions/calibration cannot be edited, rerun or converted. Work does not resume automatically after restart: save and explicitly resume it. People, framing and backgrounds may change in the result.
