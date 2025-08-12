import React, { useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import { Line as ChartLine } from 'react-chartjs-2';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import InsertChartIcon from '@mui/icons-material/InsertChart';
import CodeIcon from '@mui/icons-material/Code';

// 모달 컴포넌트
export const Modal = ({ open, onClose, children }) => {
    if (!open) return null;
    return (
        <div className="voice-modal-overlay" onClick={onClose}>
            <div className="voice-modal-content" onClick={e => e.stopPropagation()}>
                <button className="voice-modal-close" onClick={onClose}>❌</button>
                {children}
            </div>
        </div>
    );
};

// LaTeX 렌더링 관련 함수들
export const renderLatexInText = (text) => {
    if (!text) return '';

    try {
        return katex.renderToString(text, {
            throwOnError: false,
            displayMode: false
        });
    } catch (error) {
        console.error('LaTeX 렌더링 오류:', error);
        return text;
    }
};

export const preprocessLatexBlocks = (text) => {
    if (!text) return text;

    // LaTeX 블록을 찾아서 처리
    const latexBlockRegex = /\$\$(.*?)\$\$/g;
    return text.replace(latexBlockRegex, (match, content) => {
        try {
            return katex.renderToString(content, {
                throwOnError: false,
                displayMode: true
            });
        } catch (error) {
            console.error('LaTeX 블록 렌더링 오류:', error);
            return match;
        }
    });
};

export const extractLatexBlocks = (text) => {
    if (!text) return [];

    const blocks = [];
    const regex = /\$\$(.*?)\$\$/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
        blocks.push({
            content: match[1],
            start: match.index,
            end: match.index + match[0].length
        });
    }

    return blocks;
};

// 차트 관련 함수들
export const renderChartIfData = (text) => {
    if (!text) return null;

    // JSON 데이터가 포함된 메시지인지 확인
    const jsonMatch = text.match(/```json\s*(\{.*?\})\s*```/s);
    if (jsonMatch) {
        try {
            const data = JSON.parse(jsonMatch[1]);
            if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
                return data;
            }
        } catch (error) {
            console.error('JSON 파싱 오류:', error);
        }
    }

    return null;
};

export const parseMessageBlocks = (text) => {
    if (!text) return [];

    const blocks = [];
    const lines = text.split('\n');
    let currentBlock = { type: 'text', content: '' };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('```')) {
            // 코드 블록 시작/종료
            if (currentBlock.type === 'code') {
                blocks.push(currentBlock);
                currentBlock = { type: 'text', content: '' };
            } else {
                if (currentBlock.content.trim()) {
                    blocks.push(currentBlock);
                }
                const language = line.slice(3).trim();
                currentBlock = { type: 'code', language, content: '' };
            }
        } else if (line.startsWith('$$') && line.endsWith('$$')) {
            // 인라인 LaTeX
            if (currentBlock.content.trim()) {
                blocks.push(currentBlock);
            }
            blocks.push({ type: 'latex', content: line.slice(2, -2) });
            currentBlock = { type: 'text', content: '' };
        } else if (line.startsWith('$$')) {
            // LaTeX 블록 시작
            if (currentBlock.content.trim()) {
                blocks.push(currentBlock);
            }
            currentBlock = { type: 'latex', content: '' };
        } else if (line.endsWith('$$') && currentBlock.type === 'latex') {
            // LaTeX 블록 종료
            currentBlock.content += line.slice(0, -2);
            blocks.push(currentBlock);
            currentBlock = { type: 'text', content: '' };
        } else if (currentBlock.type === 'latex') {
            // LaTeX 블록 내용
            currentBlock.content += line + '\n';
        } else {
            // 일반 텍스트
            currentBlock.content += line + '\n';
        }
    }

    if (currentBlock.content.trim()) {
        blocks.push(currentBlock);
    }

    return blocks;
};

export const renderChartBlock = (value, key) => {
    try {
        const data = JSON.parse(value);
        if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
            return (
                <div key={key} className="chart-block">
                    <ChartLine data={convertToChartData(data)} options={chartOptions} />
                </div>
            );
        }
    } catch (error) {
        console.error('차트 데이터 파싱 오류:', error);
    }

    return null;
};

// 차트 데이터 변환 함수
export const convertToChartData = (data) => {
    if (!Array.isArray(data) || data.length === 0) return null;

    const firstItem = data[0];
    const keys = Object.keys(firstItem).filter(key => key !== 'name');

    return {
        labels: data.map(item => item.name || item.label || item.x || item.date || item.time || ''),
        datasets: keys.map((key, index) => ({
            label: key,
            data: data.map(item => item[key]),
            borderColor: getChartColor(index),
            backgroundColor: getChartColor(index, 0.1),
            tension: 0.1
        }))
    };
};

// 차트 색상 생성
const getChartColor = (index, alpha = 1) => {
    const colors = [
        'rgba(255, 99, 132, ' + alpha + ')',
        'rgba(54, 162, 235, ' + alpha + ')',
        'rgba(255, 206, 86, ' + alpha + ')',
        'rgba(75, 192, 192, ' + alpha + ')',
        'rgba(153, 102, 255, ' + alpha + ')',
        'rgba(255, 159, 64, ' + alpha + ')'
    ];
    return colors[index % colors.length];
};

// 차트 옵션
const chartOptions = {
    responsive: true,
    plugins: {
        legend: {
            position: 'top',
        },
        title: {
            display: true,
            text: '데이터 차트'
        }
    }
};

// 코드/JSON/차트 카드 컴포넌트
export function CodeJsonChartCard({ code, language, isChartCandidate, isChartView, onToggleChartView }) {
    const [isChartModalOpen, setIsChartModalOpen] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
    };

    const closeModal = () => setIsChartModalOpen(false);

    let parsedData = null;
    let isJsonData = false;

    try {
        parsedData = JSON.parse(code);
        isJsonData = true;
    } catch (error) {
        // JSON이 아닌 경우 무시
    }

    const isChartData = isJsonData && Array.isArray(parsedData) &&
        parsedData.length > 0 && typeof parsedData[0] === 'object';

    return (
        <div className="code-json-chart-card">
            <div className="card-header">
                <div className="card-title">
                    <CodeIcon />
                    <span>{language || 'text'}</span>
                </div>
                <div className="card-actions">
                    {isChartData && (
                        <button
                            className="chart-toggle-btn"
                            onClick={onToggleChartView}
                            title={isChartView ? '코드 보기' : '차트 보기'}
                        >
                            <InsertChartIcon />
                        </button>
                    )}
                    <button
                        className="copy-btn"
                        onClick={handleCopy}
                        title="복사"
                    >
                        <ContentCopyIcon />
                    </button>
                </div>
            </div>

            <div className="card-content">
                {isChartView && isChartData ? (
                    <div className="chart-container">
                        <ChartLine data={convertToChartData(parsedData)} options={chartOptions} />
                    </div>
                ) : (
                    <pre className={`language-${language || 'text'}`}>
                        <code>{code}</code>
                    </pre>
                )}
            </div>

            {isChartData && (
                <Modal open={isChartModalOpen} onClose={closeModal}>
                    <div className="chart-modal">
                        <h3>차트 상세 보기</h3>
                        <ChartLine data={convertToChartData(parsedData)} options={chartOptions} />
                    </div>
                </Modal>
            )}
        </div>
    );
}

// 메시지 렌더링 함수
export const renderMessageWithLatex = (text) => {
    if (!text) return '';

    // LaTeX 블록 처리
    const processedText = preprocessLatexBlocks(text);

    // ReactMarkdown으로 렌더링
    return (
        <ReactMarkdown
            remarkPlugins={[remarkMath, remarkGfm]}
            rehypePlugins={[rehypeKatex]}
            components={{
                code: ({ node, inline, className, children, ...props }) => {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                        <pre className={className}>
                            <code className={className} {...props}>
                                {children}
                            </code>
                        </pre>
                    ) : (
                        <code className={className} {...props}>
                            {children}
                        </code>
                    );
                }
            }}
        >
            {processedText}
        </ReactMarkdown>
    );
};

// 코드 블록 후 이중 줄바꿈 보장
export const ensureDoubleNewlineAfterCodeBlocks = (text) => {
    if (!text) return text;

    return text.replace(/```[\s\S]*?```/g, (match) => {
        if (match.endsWith('\n\n')) return match;
        if (match.endsWith('\n')) return match + '\n';
        return match + '\n\n';
    });
}; 