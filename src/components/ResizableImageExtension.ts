import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer } from '@tiptap/react';
import ResizableImage from './ResizableImage';

export const ResizableImageExtension = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: 200,
        parseHTML: (el) => el.getAttribute('data-width') || el.getAttribute('width') || 200,
        renderHTML: (attrs) => ({ 'data-width': attrs.width, style: `width: ${attrs.width}px` }),
      },
      alignment: {
        default: 'right',
        parseHTML: (el) => el.getAttribute('data-alignment') || 'right',
        renderHTML: (attrs) => ({ 'data-alignment': attrs.alignment }),
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImage);
  },
});
