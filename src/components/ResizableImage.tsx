import { useState, useRef, useCallback, useEffect } from 'react';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';

export default function ResizableImage({ node, updateAttributes, selected }: NodeViewProps) {
  const { src, width, alignment } = node.attrs;
  const imgRef = useRef<HTMLImageElement>(null);
  const [resizing, setResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = imgRef.current?.offsetWidth || width || 200;
  }, [width]);

  useEffect(() => {
    if (!resizing) return;
    const onMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startXRef.current;
      const newWidth = Math.max(80, Math.min(800, startWidthRef.current + diff));
      updateAttributes({ width: newWidth });
    };
    const onMouseUp = () => setResizing(false);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [resizing, updateAttributes]);

  const justify = alignment === 'center' ? 'center' : alignment === 'right' ? 'flex-end' : 'flex-start';

  return (
    <NodeViewWrapper
      className="note-image-wrapper"
      style={{ display: 'flex', justifyContent: justify }}
      data-drag-handle
    >
      <div className="relative inline-block group" style={{ width: width || 200 }}>
        <img
          ref={imgRef}
          src={src}
          className={`note-resizable-img ${selected ? 'ring-2 ring-teal/50' : ''}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          draggable={false}
        />
        {/* Alignment buttons — shown on hover/selection */}
        <div className={`absolute top-1 left-1 flex gap-0.5 bg-black/60 rounded p-0.5 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          {(['left', 'center', 'right'] as const).map(a => (
            <button
              key={a}
              onClick={() => updateAttributes({ alignment: a })}
              className={`w-5 h-5 rounded text-[10px] flex items-center justify-center transition-colors ${alignment === a ? 'bg-teal text-cream' : 'text-steel hover:text-cream hover:bg-white/10'}`}
            >
              {a === 'left' ? '◧' : a === 'center' ? '◫' : '◨'}
            </button>
          ))}
        </div>
        {/* Resize handle — bottom-right corner */}
        <div
          onMouseDown={onMouseDown}
          className={`absolute bottom-0 right-0 w-3 h-3 cursor-se-resize rounded-tl transition-opacity ${selected || resizing ? 'opacity-100 bg-teal' : 'opacity-0 group-hover:opacity-70 bg-steel'}`}
        />
      </div>
    </NodeViewWrapper>
  );
}
