import { BaseBoxShapeUtil, HTMLContainer, T, useIsEditing } from 'tldraw'

export class CoartHtmlShapeUtil extends BaseBoxShapeUtil {
  static type = 'coart-html'

  static props = {
    w: T.number,
    h: T.number,
    html: T.string,
    title: T.string,
    assetUrl: T.string
  }

  getDefaultProps() {
    return {
      w: 1024,
      h: 576,
      html: '<!doctype html><html><body><h1>Coart HTML</h1></body></html>',
      title: 'AI HTML',
      assetUrl: ''
    }
  }

  canEdit() {
    return true
  }

  component(shape) {
    const isEditing = useIsEditing(shape.id)
    return (
      <HTMLContainer className="coart-html-shape" style={{ pointerEvents: isEditing ? 'all' : 'none' }}>
        <iframe
          title={shape.props.title || 'Coart HTML'}
          srcDoc={shape.props.html}
          sandbox="allow-scripts allow-forms allow-modals allow-popups"
          referrerPolicy="no-referrer"
        />
      </HTMLContainer>
    )
  }

  getIndicatorPath(shape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }
}
