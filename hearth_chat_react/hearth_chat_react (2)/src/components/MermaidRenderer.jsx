import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

// Mermaid 초기화는 컴포넌트 외부에서 한 번만 실행해도 괜찮음
mermaid.initialize({ startOnLoad: false });

const MermaidRenderer = ({ chart }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    // 렌더링할 차트 내용이나, 차트를 표시할 DOM 요소가 없으면 실행하지 않음
    if (!chart || !containerRef.current) return;

    // 렌더링 함수를 async로 선언
    const renderMermaid = async () => {
      try {
        // mermaid.render는 Promise를 반환하므로 await를 사용
        // 첫 번째 인자는 렌더링된 SVG의 ID이며, 아무거나 고유한 값으로 지정
        const { svg } = await mermaid.render('mermaid-graph-' + Date.now(), chart);
        
        // 컴포넌트가 unmount되지 않았다면, 결과를 DOM에 삽입
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (e) {
        // 에러 발생 시 콘솔에 로그를 남기고, 사용자에게 에러 메시지를 보여줌
        console.error('Mermaid 렌더링 에러:', e);
        if (containerRef.current) {
          containerRef.current.innerHTML = `<pre style="color: red;">Mermaid 렌더링 에러가 발생했습니다.</pre>`;
        }
      }
    };

    renderMermaid();

    // useEffect의 cleanup 함수. 컴포넌트가 사라질 때 내부를 비움
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [chart]); // chart 내용이 변경될 때마다 이 effect가 다시 실행

  return <div ref={containerRef} className="mermaid" style={{ minHeight: 60 }} />;
};

export default MermaidRenderer;