// AiMessageRenderer.tsx
import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeMathjax from 'rehype-mathjax'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import MermaidRenderer from './MermaidRenderer'

interface AiMessageRendererProps {
  content: string
}

const AiMessageRenderer: React.FC<AiMessageRendererProps> = ({ content }) => {
  return (
    <div className="prose prose-neutral max-w-none dark:prose-invert">
      <ReactMarkdown
        children={content}
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeMathjax]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            const codeContent = String(children).replace(/\n$/, '')

            if (match?.[1] === 'mermaid') {
              return <MermaidRenderer chart={codeContent} />
            }

            return !inline && match ? (
              <SyntaxHighlighter
                style={oneDark}
                language={match[1]}
                PreTag="div"
                {...props}
              >
                {codeContent}
              </SyntaxHighlighter>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            )
          },
        }}
      />
    </div>
  )
}

export default AiMessageRenderer


// MermaidRenderer.tsx
import React, { useEffect, useRef } from 'react'
import mermaid from 'mermaid'

interface MermaidRendererProps {
  chart: string
}

const MermaidRenderer: React.FC<MermaidRendererProps> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false })
    if (containerRef.current) {
      containerRef.current.innerHTML = ''
      mermaid.render('theGraph', chart, (svgCode) => {
        if (containerRef.current) {
          containerRef.current.innerHTML = svgCode
        }
      })
    }
  }, [chart])

  return <div ref={containerRef} className="mermaid" />
}

export default MermaidRenderer
