// src/components/AiMessageRenderer.jsx (표준 위치로 복사)
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github.css';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement } from 'chart.js';
import MermaidRenderer from './MermaidRenderer';
import { CopyToClipboard } from 'copy-to-clipboard';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement);

const ChartRenderer = ({ chart }) => {
  switch (chart.type) {
    case 'bar': return <Bar data={chart.data} />;
    case 'line': return <Line data={chart.data} />;
    case 'pie': return <Pie data={chart.data} />;
    default: return <div>지원하지 않는 차트 유형입니다.</div>;
  }
};

// 코드/수식/차트/mermaid 블록 카드
const BlockCard = ({ type, value, language }) => {
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    window.navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  };
  return (
    <div style={{ background: '#23272f', borderRadius: 8, margin: '12px 0', position: 'relative', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: 0 }}>
      <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4, zIndex: 2 }}>
        <button onClick={() => setShowRaw(v => !v)} style={{ fontSize: 13, background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', marginRight: 2 }}>{showRaw ? '렌더링' : '원본'}</button>
        <button onClick={handleCopy} style={{ fontSize: 13, background: 'none', border: 'none', color: copied ? '#4caf50' : '#bbb', cursor: 'pointer' }}>{copied ? '복사됨' : '복사'}</button>
      </div>
      <div style={{ padding: '18px 16px 16px 16px', minHeight: 40 }}>
        {showRaw ? (
          <pre style={{ background: 'transparent', color: '#fff', fontFamily: 'Fira Mono, Consolas, Menlo, monospace', fontSize: 15, border: 'none', margin: 0, padding: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{value}</pre>
        ) : (
          type === 'code' ? (
            <ReactMarkdown
              children={"```" + (language || '') + "\n" + value + "\n```"}
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeHighlight, rehypeRaw, rehypeSanitize]}
            />
          ) : type === 'latex' ? (
            <ReactMarkdown
              children={"$$" + value + "$$"}
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex, rehypeRaw, rehypeSanitize]}
            />
          ) : type === 'chart' ? (
            (() => {
              try {
                const parsed = typeof value === 'string' ? JSON.parse(value) : value;
                return <ChartRenderer chart={parsed.chart || parsed} />;
              } catch {
                return <pre>{value}</pre>;
              }
            })()
          ) : type === 'mermaid' ? (
            <MermaidRenderer chart={value} />
          ) : null
        )}
      </div>
    </div>
  );
};

// 메시지 내 블록 파싱 (코드, 수식, 차트, mermaid 등)
function parseBlocks(text) {
  if (!text || typeof text !== 'string') return [{ type: 'text', value: text }];
  const blocks = [];
  let lastIndex = 0;
  // $$...$$ (블록 수식)
  const blockMathRegex = /\$\$([\s\S]+?)\$\$/g;
  // ```mermaid ... ```
  const mermaidRegex = /```mermaid\n([\s\S]+?)```/g;
  // ```json ... ``` (차트 데이터)
  const chartRegex = /```json\s*([\s\S]+?)```/g;
  // ```언어 ... ``` (코드블록)
  const codeBlockRegex = /```(\w+)?\s*([\s\S]+?)```/g;

  // 모든 블록을 한 번에 파싱 (출현 순서대로)
  let match;
  const matches = [];
  while ((match = blockMathRegex.exec(text)) !== null) {
    matches.push({ type: 'latex', value: match[1], index: match.index, length: match[0].length });
  }
  while ((match = mermaidRegex.exec(text)) !== null) {
    matches.push({ type: 'mermaid', value: match[1], index: match.index, length: match[0].length });
  }
  while ((match = chartRegex.exec(text)) !== null) {
    matches.push({ type: 'chart', value: match[1], index: match.index, length: match[0].length });
  }
  while ((match = codeBlockRegex.exec(text)) !== null) {
    // mermaid, chart와 중복되는 부분은 제외
    if (match[1] === 'mermaid' || match[1] === 'json') continue;
    matches.push({ type: 'code', value: match[2], language: match[1] || 'plaintext', index: match.index, length: match[0].length });
  }
  matches.sort((a, b) => a.index - b.index);

  for (const m of matches) {
    if (lastIndex < m.index) {
      blocks.push({ type: 'text', value: text.slice(lastIndex, m.index) });
    }
    blocks.push(m);
    lastIndex = m.index + m.length;
  }
  if (lastIndex < text.length) {
    blocks.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return blocks;
}

const AiMessageRenderer = ({ message }) => {
  // JSON 타입 메시지(차트, 이미지 등)
  try {
    const parsed = typeof message === 'string' ? JSON.parse(message) : message;
    if (parsed && typeof parsed === 'object') {
      if (parsed.type === 'chart') {
        return <BlockCard type="chart" value={JSON.stringify(parsed)} />;
      }
      if (parsed.type === 'image') {
        return (
          <figure style={{ margin: '12px 0' }}>
            <img src={parsed.url} alt={parsed.caption || 'AI image'} style={{ maxWidth: '100%' }} />
            {parsed.caption && <figcaption>{parsed.caption}</figcaption>}
          </figure>
        );
      }
      if (parsed.type === 'mermaid' && parsed.data) {
        return <BlockCard type="mermaid" value={parsed.data} />;
      }
    }
  } catch (e) {
    // not JSON - treat as markdown
  }

  // 일반 텍스트/마크다운 메시지: 블록 분리
  const blocks = parseBlocks(message);
  return (
    <div className="message-markdown">
      {blocks.map((block, i) => {
        if (block.type === 'code' || block.type === 'latex' || block.type === 'chart' || block.type === 'mermaid') {
          return <BlockCard key={i} type={block.type} value={block.value} language={block.language} />;
        }
        // 일반 텍스트/마크다운은 그대로 출력
        return (
          <ReactMarkdown
            key={i}
            children={block.value}
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex, rehypeHighlight, rehypeRaw, rehypeSanitize]}
          />
        );
      })}
    </div>
  );
};

export default AiMessageRenderer;
