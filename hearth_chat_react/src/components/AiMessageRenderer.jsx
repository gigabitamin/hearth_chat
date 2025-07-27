// src/components/AiMessageRenderer.jsx (표준 위치로 복사)
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github.css';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement } from 'chart.js';
import MermaidRenderer from './MermaidRenderer';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement);

const ChartRenderer = ({ chart }) => {
  switch (chart.type) {
    case 'bar': return <Bar data={chart.data} />;
    case 'line': return <Line data={chart.data} />;
    case 'pie': return <Pie data={chart.data} />;
    default: return <div>지원하지 않는 차트 유형입니다.</div>;
  }
};

const AiMessageRenderer = ({ message }) => {
  // Mermaid 코드 블록 자동 감지
  if (typeof message === 'string' && message.match(/```mermaid[\s\S]*?```/)) {
    const mermaidCode = message.match(/```mermaid\n([\s\S]*?)```/);
    if (mermaidCode && mermaidCode[1]) {
      return <MermaidRenderer chart={mermaidCode[1]} />;
    }
  }
  try {
    const parsed = typeof message === 'string' ? JSON.parse(message) : message;
    if (parsed && typeof parsed === 'object') {
      if (parsed.type === 'chart') {
        return <ChartRenderer chart={parsed.chart} />;
      }
      if (parsed.type === 'image') {
        return (
          <figure>
            <img src={parsed.url} alt={parsed.caption || 'AI image'} style={{ maxWidth: '100%' }} />
            {parsed.caption && <figcaption>{parsed.caption}</figcaption>}
          </figure>
        );
      }
      if (parsed.type === 'mermaid' && parsed.data) {
        return <MermaidRenderer chart={parsed.data} />;
      }
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
  );
};

export default AiMessageRenderer;
