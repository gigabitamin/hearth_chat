// ai_message_test_page.tsx
import React, { useState, useEffect } from 'react'
import AiMessageRenderer from './ai_message_renderer'
import MermaidRenderer from './mermaid_renderer'

const FILES = [
  'message_1_markdown_code_table.md',
  'message_2_latex.md',
  'message_3_html.md',
  'message_4_mermaid.md',
  'message_5_code_highlight.md',
  'message_6_chart.json',
  'message_7_image.json'
]

const FILE_BASE_PATH = '/ai_message_simulations/'

export default function AiMessageTestPage() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [content, setContent] = useState<string>('')

  useEffect(() => {
    if (selectedFile) {
      fetch(FILE_BASE_PATH + selectedFile)
        .then(res => res.text())
        .then(setContent)
    }
  }, [selectedFile])

  return (
    <div className="flex h-screen">
      <aside className="w-64 p-4 border-r bg-gray-50 overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">📂 테스트 파일</h2>
        <ul className="space-y-2">
          {FILES.map(f => (
            <li key={f}>
              <button
                className={`text-left w-full p-2 rounded hover:bg-blue-100 ${selectedFile === f ? 'bg-blue-200 font-semibold' : ''}`}
                onClick={() => setSelectedFile(f)}
              >
                {f}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <main className="flex-1 p-6 overflow-y-auto">
        <h1 className="text-2xl font-bold mb-4">🧪 렌더링 테스트</h1>
        {selectedFile?.includes('mermaid') ? (
          <MermaidRenderer code={content} />
        ) : (
          <AiMessageRenderer message={content} />
        )}
      </main>
    </div>
  )
}
