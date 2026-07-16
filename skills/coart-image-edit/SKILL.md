---
name: coart-image-edit
description: Use a Coart annotation screenshot to create a clean revised image beside the original content.
---

# Coart Annotation Edit

1. If the standalone editor was used, call `get_coart_pending_request` first when a pending request exists; do not ask the user to paste a prompt. If the user refers to an image just edited in Coart, call `get_coart_latest_image`; otherwise use the named annotation screenshot path inside the active project's `canvas/assets/` directory.
2. Treat arrows, circles, freehand marks, and nearby text as revision instructions.
3. Generate a clean bitmap without annotation marks, blue selection boxes, toolbars, or editor chrome.
4. Preserve the requested subject, composition, and aspect ratio unless the annotations explicitly change them.
5. If the user asks to update the existing image, call `update_coart_image` with the exact generated image path and the selected image shape id. This preserves the shape's position, size, and id while keeping the previous asset protected.
6. For annotation-led revisions where the original must remain unchanged, call `insert_coart_image` with the active project and place the result beside the selected source. Do not set `replaceHolder: true` unless the anchor is an actual `ai-image` holder.
7. After a queued standalone request is handled successfully, call `clear_coart_pending_request` with its request id.
