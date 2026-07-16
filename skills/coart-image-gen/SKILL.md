---
name: coart-image-gen
description: Generate and insert an AI image into Coart, replacing a selected AI image holder when present.
---

# Coart Image Generation

## Workflow

1. Call `get_coart_pending_request` when the user says "繼續處理" after using the standalone editor; otherwise call `get_coart_selection` for the active project.
2. When exactly one selected shape has `meta.coartKind: "ai-image"`, treat its `props.w` and `props.h` as the generation contract.
3. Generate the bitmap with the available image generation capability. The prompt must state target width, height, and aspect ratio.
4. Resolve the exact local output image created for this request. Never reuse an older unrelated generated file.
5. When the user is asking to update an existing image shape, call `update_coart_image` so its shape, position, and display size remain stable:

```json
{
  "projectDir": "<active-project>",
  "imagePath": "<exact-local-generated-image>",
  "shapeId": "<selected-image-shape-id>"
}
```

For an AI image holder or a new image, call `insert_coart_image`:

```json
{
  "projectDir": "<active-project>",
  "imagePath": "<exact-local-generated-image>",
  "anchorShapeId": "<selected-holder-id>",
  "replaceHolder": true
}
```

6. When no AI image holder is selected, still generate and insert a standalone image. Use the current page and selected shape as placement context.
7. Keep the original selected image and annotations when the request is an annotation-led revision; insert the new result beside them instead of replacing them.
8. After handling a queued standalone request, call `clear_coart_pending_request` with its request id.
9. Report the updated or inserted `shapeId`, asset path, dimensions, and replaced holder id when applicable.
