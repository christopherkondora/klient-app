import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Strip markdown syntax for plain-text previews (lists, truncations).
 */
export function stripMarkdown(md: string): string {
  if (!md) return '';
  return md
    .replace(/```[\s\S]*?```/g, '') // code blocks
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '') // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/^#{1,6}\s+/gm, '') // headings
    .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
    .replace(/__([^_]+)__/g, '$1') // bold alt
    .replace(/\*([^*]+)\*/g, '$1') // italic
    .replace(/_([^_]+)_/g, '$1') // italic alt
    .replace(/^[\s]*[-*+]\s+/gm, '') // bullet markers
    .replace(/^[\s]*\d+\.\s+/gm, '') // ordered markers
    .replace(/^>\s?/gm, '') // blockquote markers
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Renders an AI summary as styled markdown. Designed to match the Klient design
 * language (dark surface, teal accents, calm whitespace).
 */
export default function MarkdownSummary({ content, className = '' }: { content: string; className?: string }) {
  return (
    <div className={`markdown-summary text-sm text-cream/85 leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h3 className="text-sm font-semibold text-cream mt-3 mb-1.5 first:mt-0">{children}</h3>
          ),
          h2: ({ children }) => (
            <h3 className="text-sm font-semibold text-cream mt-3 mb-1.5 first:mt-0">{children}</h3>
          ),
          h3: ({ children }) => (
            <h4 className="text-xs font-semibold text-cream/90 uppercase tracking-wide mt-3 mb-1 first:mt-0">{children}</h4>
          ),
          p: ({ children }) => (
            <p className="mb-2 last:mb-0 text-cream/80">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 mb-2 space-y-0.5 marker:text-teal/60 text-cream/80">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 mb-2 space-y-0.5 marker:text-teal/60 text-cream/80">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-snug">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-cream">{children}</strong>,
          em: ({ children }) => <em className="italic text-cream/90">{children}</em>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-teal hover:underline">{children}</a>
          ),
          code: ({ children }) => (
            <code className="px-1 py-0.5 rounded bg-surface-700 text-cream/90 text-[0.85em]">{children}</code>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-teal/40 pl-3 text-cream/70 italic my-2">{children}</blockquote>
          ),
          hr: () => <hr className="border-teal/15 my-3" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
