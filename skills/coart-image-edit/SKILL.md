---
name: coart-image-edit
description: Use a Coart annotation screenshot to create a clean revised image beside the original content.
---

# Coart Annotation Edit

1. If the user refers to an image just edited in the standalone Coart window, call `get_coart_latest_image` first so the model receives the actual project-local image content. Otherwise read the annotation screenshot path from the user's prompt; it should be inside the active project's `canvas/assets/` directory.
2. Treat arrows, circles, freehand marks, and nearby text as revision instructions.
3. Generate a clean bitmap without annotation marks, blue selection boxes, toolbars, or editor chrome.
4. Preserve the requested subject, composition, and aspect ratio unless the annotations explicitly change them.
5. Call `insert_coart_image` with the active project. Do not set `replaceHolder: true` unless the anchor is an actual `ai-image` holder.
6. Insert the result beside the selected source and keep the original content unchanged.
