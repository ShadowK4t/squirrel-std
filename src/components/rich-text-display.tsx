type Props = { html: string; className?: string }

export default function RichTextDisplay({ html, className }: Props) {
  if (!html) return null

  // Legacy plain text (no HTML tags) — render with @mention highlighting
  if (!html.trim().startsWith('<')) {
    return (
      <p className={`text-white/80 text-sm leading-relaxed ${className ?? ''}`}>
        {html.split(/(@\S+)/).map((part, i) =>
          part.startsWith('@')
            ? <span key={i} className="text-sq-accent font-semibold">{part}</span>
            : part
        )}
      </p>
    )
  }

  return (
    <div
      className={`rich-text text-white/80 text-sm leading-relaxed ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}