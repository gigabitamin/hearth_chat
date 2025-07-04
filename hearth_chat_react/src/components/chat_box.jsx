import React, { useState, useEffect, useRef } from 'react';
import './chat_box.css';

const ChatBox = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const ws = useRef(null);

  useEffect(() => {
    // 웹소켓 연결
    ws.current = new WebSocket('ws://localhost:8000/ws/chat/');

    ws.current.onopen = () => {
      console.log('✅ WebSocket 연결 성공');
    };

    ws.current.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setMessages((prev) => [...prev, { type: 'recv', text: data.message }]);
    };

    ws.current.onclose = () => {
      console.log('❌ WebSocket 연결 종료');
    };

    return () => {
      ws.current.close();
    };
  }, []);

  const sendMessage = () => {
    if (input.trim() === '') return;
    ws.current.send(JSON.stringify({ message: input }));
    setMessages((prev) => [...prev, { type: 'send', text: input }]);
    setInput('');
  };

  return (
    <div className="chat-container">
      <div className="chat-log">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`chat-bubble ${msg.type === 'send' ? 'sent' : 'received'}`}
          >
            {msg.text}
          </div>
        ))}
      </div>
      <div className="chat-input-area">
        <input
          type="text"
          placeholder="메시지를 입력하세요..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button onClick={sendMessage}>전송</button>
      </div>
    </div>
  );
};

export default ChatBox;
