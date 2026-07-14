---
name: coart-image-gen
description: Generate and insert an AI image into Coart, replacing a selected AI image holder when present.
---

# Coart Image Generation

## Workflow

1. Call `get_coart_selection` for the active project.
2. When exactly one selected shape has `meta.coartKind: "ai-image"`, treat its `props.w` and `props.h` as the generation contract.
3. Generate the bitmap with the available image generation capability. The prompt must state target width, height, and aspect ratio.
4. Resolve the exact local output image created for this request. Never reuse an older unrelated generated file.
5. Call `insert_coart_image`:

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
8. Report the inserted `shapeId`, asset path, dimensions, and replaced holder id.
