import React, { useEffect } from 'react';
import ChatBox from './components/chat_box';
import './App.css';

function App() {
  // 앱 시작 시 csrftoken 강제 발급
  useEffect(() => {
    fetch('/accounts/login/', { credentials: 'include' });
  }, []);
  return (
    <div className="app">
      {/* <h1 className="app-title">Hearth 🔥 Chat</h1> */}
      <ChatBox />
    </div>
  );
}

export default App;
