

// src/components/AiMessageRenderer.jsx (표준 위치로 복사)
import React, { useState, useEffect } from 'react';
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
import katex from 'katex';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement);


// 유니코드 문자를 올바른 문자로 변환하는 함수 (임시방편 제거)
const decodeUnicodeChars = (text) => {
  if (!text || typeof text !== 'string') return text;
  
  // console.log(`[DEBUG] 텍스트 처리 시작`);
  // console.log(`[DEBUG] 원본 텍스트:`, text);
  
  // 백엔드에서 이미 올바른 형태로 전달받는다고 가정
  // 더 이상 unicodeMap을 사용하지 않음
  // console.log(`[DEBUG] 텍스트 처리 완료`);
  
  return text;
};

// KaTeX 설정
const katexOptions = {
  throwOnError: false,
  errorColor: '#cc0000',
  macros: {
    "\\RR": "\\mathbb{R}",
    "\\NN": "\\mathbb{N}",
    "\\ZZ": "\\mathbb{Z}",
    "\\QQ": "\\mathbb{Q}",
    "\\CC": "\\mathbb{C}"
  }
};

// DEBUG: LaTeX 수식 렌더링 확인 함수
const debugLatexRendering = (text, blockType = 'text') => {
  // console.log(`[DEBUG] LaTeX 렌더링 시작 - 블록 타입: ${blockType}`);
  // console.log(`[DEBUG] 원본 텍스트:`, text);

  // LaTeX 수식 패턴 찾기
  const inlineMathRegex = /\$([^\$]+?)\$/g;
  const blockMathRegex = /\$\$([\s\S]*?)\$\$/g;

  let inlineMatches = [];
  let blockMatches = [];

  // 인라인 수식 찾기
  let match;
  while ((match = inlineMathRegex.exec(text)) !== null) {
    inlineMatches.push(match[1]);
  }

  // 블록 수식 찾기
  while ((match = blockMathRegex.exec(text)) !== null) {
    blockMatches.push(match[1]);
  }

  // console.log(`[DEBUG] 발견된 인라인 수식 (${inlineMatches.length}개):`, inlineMatches);
  // console.log(`[DEBUG] 발견된 블록 수식 (${blockMatches.length}개):`, blockMatches);

  return { inlineMatches, blockMatches };
};

// 인라인 수식을 KaTeX로 렌더링하는 함수
const renderInlineMath = (text) => {
  const inlineMathRegex = /\$([^\$]+?)\$/g;
  let result = text;
  let match;

  while ((match = inlineMathRegex.exec(text)) !== null) {
    try {
      const rendered = katex.renderToString(match[1], {
        ...katexOptions,
        displayMode: false
      });
      result = result.replace(match[0], rendered);
    } catch (error) {
      // console.log(`[DEBUG] 인라인 수식 렌더링 오류:`, error.message);
      // 오류가 발생하면 원본 텍스트 유지
    }
  }

  return result;
};

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

  // DEBUG: 블록 카드 렌더링 확인
  useEffect(() => {
    // console.log(`[DEBUG] BlockCard 렌더링 - 타입: ${type}, 언어: ${language}`);
    // console.log(`[DEBUG] 블록 값:`, value);

    if (type === 'latex') {
      // console.log(`[DEBUG] LaTeX 블록 렌더링 시작`);
      debugLatexRendering(value, 'latex');
    }
  }, [type, value, language]);

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
            (() => {
              try {
                // console.log(`[DEBUG] LaTeX 블록 KaTeX 렌더링 시작:`, value);
                const rendered = katex.renderToString(value, {
                  ...katexOptions,
                  displayMode: true
                });
                // console.log(`[DEBUG] LaTeX 블록 렌더링 성공`);
                return (
                  <div
                    dangerouslySetInnerHTML={{ __html: rendered }}
                    style={{
                      textAlign: 'center',
                      margin: '1em 0',
                      color: '#fff'
                    }}
                  />
                );
              } catch (error) {
                // console.log(`[DEBUG] LaTeX 블록 렌더링 오류:`, error.message);
                return (
                  <ReactMarkdown
                    children={"$$" + value + "$$"}
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[[rehypeKatex, katexOptions], rehypeRaw, rehypeSanitize]}
                  />
                );
              }
            })()
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

  // console.log(`[DEBUG] parseBlocks 시작 - 텍스트 길이: ${text.length}`);

  const blocks = [];
  let lastIndex = 0;

  // 정규식 패턴 개선
  // $$...$$ (블록 수식) - 더 정확한 패턴
  const blockMathRegex = /\$\$([\s\S]*?)\$\$/g;
  // ```mermaid ... ```
  const mermaidRegex = /```mermaid\n([\s\S]*?)```/g;
  // ```json ... ``` (차트 데이터)
  const chartRegex = /```json\s*([\s\S]*?)```/g;
  // ```언어 ... ``` (코드블록)
  const codeBlockRegex = /```(\w+)?\s*([\s\S]*?)```/g;

  // 모든 블록을 한 번에 파싱 (출현 순서대로)
  let match;
  const matches = [];

  // 블록 수식 먼저 찾기 ($$...$$)
  while ((match = blockMathRegex.exec(text)) !== null) {
    // console.log(`[DEBUG] 블록 수식 발견:`, match[0]);
    matches.push({
      type: 'latex',
      value: match[1].trim(),
      index: match.index,
      length: match[0].length,
      fullMatch: match[0]
    });
  }

  // mermaid 블록 찾기
  while ((match = mermaidRegex.exec(text)) !== null) {
    // console.log(`[DEBUG] mermaid 블록 발견:`, match[0]);
    matches.push({
      type: 'mermaid',
      value: match[1],
      index: match.index,
      length: match[0].length,
      fullMatch: match[0]
    });
  }

  // chart 블록 찾기
  while ((match = chartRegex.exec(text)) !== null) {
    // console.log(`[DEBUG] chart 블록 발견:`, match[0]);
    matches.push({
      type: 'chart',
      value: match[1],
      index: match.index,
      length: match[0].length,
      fullMatch: match[0]
    });
  }

  // 코드 블록 찾기 (mermaid, chart와 중복되는 부분은 제외)
  while ((match = codeBlockRegex.exec(text)) !== null) {
    // console.log(`[DEBUG] 코드 블록 발견:`, match[0]);
    // mermaid, chart와 중복되는 부분은 제외
    if (match[1] === 'mermaid' || match[1] === 'json') continue;
    matches.push({
      type: 'code',
      value: match[2],
      language: match[1] || 'plaintext',
      index: match.index,
      length: match[0].length,
      fullMatch: match[0]
    });
  }

  // 인덱스 순서로 정렬
  matches.sort((a, b) => a.index - b.index);

  // console.log(`[DEBUG] 발견된 블록들:`, matches);

  // 블록들을 순서대로 처리
  for (const m of matches) {
    // 현재 블록 이전의 텍스트 추가
    if (lastIndex < m.index) {
      const textBefore = text.slice(lastIndex, m.index);
      if (textBefore.trim()) {
        // console.log(`[DEBUG] 텍스트 블록 추가:`, textBefore);
        blocks.push({ type: 'text', value: textBefore });
      }
    }

    // 현재 블록 추가
    // console.log(`[DEBUG] ${m.type} 블록 추가:`, m.value);
    blocks.push(m);
    lastIndex = m.index + m.length;
  }

  // 마지막 블록 이후의 텍스트 추가
  if (lastIndex < text.length) {
    const textAfter = text.slice(lastIndex);
    if (textAfter.trim()) {
      // console.log(`[DEBUG] 마지막 텍스트 블록 추가:`, textAfter);
      blocks.push({ type: 'text', value: textAfter });
    }
  }

  // console.log(`[DEBUG] 파싱된 블록들:`, blocks);
  return blocks;
}

const AiMessageRenderer = ({ message }) => {
  // DEBUG: 메시지 렌더링 시작 확인
  useEffect(() => {
    // console.log(`[DEBUG] AiMessageRenderer 렌더링 시작`);
    // console.log(`[DEBUG] 메시지 타입:`, typeof message);
    // console.log(`[DEBUG] 메시지 내용:`, message);
  }, [message]);

  // 유니코드 이스케이프 시퀀스 디코딩
  const decodedMessage = decodeUnicodeChars(message);

  // JSON 타입 메시지(차트, 이미지 등)
  try {
    const parsed = typeof decodedMessage === 'string' ? JSON.parse(decodedMessage) : decodedMessage;
    if (parsed && typeof parsed === 'object') {
      // console.log(`[DEBUG] JSON 메시지 감지:`, parsed.type);
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
    // console.log(`[DEBUG] JSON 파싱 실패, 마크다운으로 처리:`, e.message);
  }

  // 일반 텍스트/마크다운 메시지: 블록 분리
  const blocks = parseBlocks(decodedMessage);

  // console.log(`[DEBUG] 최종 렌더링할 블록 수:`, blocks.length);

  return (
    <div className="message-markdown">
      {blocks.map((block, i) => {
        // console.log(`[DEBUG] 블록 ${i} 렌더링 - 타입: ${block.type}`);

        if (block.type === 'code' || block.type === 'latex' || block.type === 'chart' || block.type === 'mermaid') {
          return <BlockCard key={i} type={block.type} value={block.value} language={block.language} />;
        }

        // 일반 텍스트/마크다운은 ReactMarkdown으로 렌더링 (LaTeX 수식 포함)
        // console.log(`[DEBUG] 텍스트 블록 렌더링 - 길이: ${block.value.length}`);
        const latexInfo = debugLatexRendering(block.value, 'text');

        // 인라인 수식이 있는 경우 직접 처리
        if (latexInfo.inlineMatches.length > 0) {
          // console.log(`[DEBUG] 인라인 수식 직접 처리:`, latexInfo.inlineMatches);

          // 인라인 수식을 KaTeX로 렌더링
          const renderedText = renderInlineMath(block.value);

          return (
            <div
              key={i}
              dangerouslySetInnerHTML={{ __html: renderedText }}
              style={{ color: '#fff' }}
            />
          );
        }

        return (
          <ReactMarkdown
            key={i}
            children={block.value}
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[[rehypeKatex, katexOptions], rehypeHighlight, rehypeRaw, rehypeSanitize]}
            components={{
              // LaTeX 수식 렌더링을 위한 커스텀 컴포넌트
              math: ({ value }) => {
                // console.log(`[DEBUG] 블록 수식 렌더링:`, value);
                return (
                  <div className="math-display" style={{
                    display: 'block',
                    textAlign: 'center',
                    margin: '1em 0',
                    fontFamily: 'KaTeX_Main, serif',
                    color: '#fff'
                  }}>
                    {value}
                  </div>
                );
              },
              inlineMath: ({ value }) => {
                // console.log(`[DEBUG] 인라인 수식 렌더링:`, value);
                return (
                  <span className="math-inline" style={{
                    fontFamily: 'KaTeX_Main, serif',
                    color: '#fff'
                  }}>
                    {value}
                  </span>
                );
              },
            }}
          />
        );
      })}
    </div>
  );
};

export default AiMessageRenderer;
