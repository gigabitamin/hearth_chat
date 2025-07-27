// ai_message_renderer.tsx
import React, { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import 'katex/dist/katex.min.css'
import 'highlight.js/styles/github.css'
import { Bar, Line, Pie } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement)

interface MessageRendererProps {
  message: string
}

const ChartRenderer = ({ chart }: any) => {
  switch (chart.type) {
    case 'bar': return <Bar data={chart.data} />
    case 'line': return <Line data={chart.data} />
    case 'pie': return <Pie data={chart.data} />
    default: return <div>지원하지 않는 차트 유형입니다.</div>
  }
}

const AiMessageRenderer = ({ message }: MessageRendererProps) => {
  try {
    const parsed = JSON.parse(message)

    if (parsed.type === 'chart') {
      return <ChartRenderer chart={parsed.chart} />
    }

    if (parsed.type === 'image') {
      return (
        <figure>
          <img src={parsed.url} alt={parsed.caption || 'AI image'} style={{ maxWidth: '100%' }} />
          {parsed.caption && <figcaption>{parsed.caption}</figcaption>}
        </figure>
      )
    }
  } catch (e) {
    // not JSON - treat as markdown
  }

  return (
    <ReactMarkdown
      children={message}
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex, rehypeHighlight, rehypeRaw]}
      components={{
        img: ({ node, ...props }) => (
          <img {...props} style={{ maxWidth: '100%' }} />
        )
      }}
    />
  )
}

export default AiMessageRenderer
