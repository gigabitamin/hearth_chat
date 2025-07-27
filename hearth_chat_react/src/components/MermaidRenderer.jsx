import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

const MermaidRenderer = ({ chart }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false });
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      mermaid.render('theGraph' + Date.now(), chart, (svgCode) => {
        if (containerRef.current) {
          containerRef.current.innerHTML = svgCode;
        }
      });
    }
  }, [chart]);

  return <div ref={containerRef} className="mermaid" />;
};

export default MermaidRenderer; 