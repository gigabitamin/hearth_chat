import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import ChatBox from './components/chat_box';
import ChatRoomList from './components/ChatRoomList';
import './App.css';

// API URL을 동적으로 설정하는 함수
const getApiUrl = () => {
  const hostname = window.location.hostname;
  const port = '8000';
  return `http://${hostname}:${port}`;
};

function LobbyPage({ loginUser, loginLoading, checkLoginStatus, userSettings, setUserSettings }) {
  const navigate = useNavigate();

  const handleRoomSelect = (room) => {
    // 대화방 입장 시 URL 이동
    navigate(`/room/${room.id}`);
  };

  return (
    <div className="app-container">
      <div className="room-list-container">
        <ChatRoomList
          onRoomSelect={handleRoomSelect}
          loginUser={loginUser}
          loginLoading={loginLoading}
          checkLoginStatus={checkLoginStatus}
        />
      </div>
      <div className="welcome-container">
        <div className="welcome-content">
          <h1>Hearth 🔥 Chat</h1>
          <p>대화방을 선택하여 채팅을 시작하세요!</p>
        </div>
      </div>
    </div>
  );
}

function ChatRoomPage({ loginUser, loginLoading, checkLoginStatus, userSettings, setUserSettings }) {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 방 정보 fetch
    const fetchRoom = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${getApiUrl()}/api/chat/rooms/${roomId}/`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setRoom(data);
        } else {
          setRoom(null);
        }
      } catch {
        setRoom(null);
      } finally {
        setLoading(false);
      }
    };
    fetchRoom();
  }, [roomId]);

  if (loading) return <div>로딩 중...</div>;
  if (!room) return <div>존재하지 않는 방입니다. <button onClick={() => navigate('/')}>대기방으로</button></div>;

  return (
    <div className="chat-container">
      <div className="chat-header">
        <button onClick={() => navigate('/')} className="back-btn">
          ← 대화방 목록
        </button>
        <h2>{room?.name}</h2>
      </div>
      <ChatBox
        selectedRoom={room}
        loginUser={loginUser}
        loginLoading={loginLoading}
        checkLoginStatus={checkLoginStatus}
        userSettings={userSettings}
        setUserSettings={setUserSettings}
      />
    </div>
  );
}

function App() {
  const [loginUser, setLoginUser] = useState(null);
  const [loginLoading, setLoginLoading] = useState(true);
  const [userSettings, setUserSettings] = useState(null);

  // 앱 시작 시 CSRF 토큰 및 로그인 상태/설정값 가져오기
  useEffect(() => {
    fetch(`${getApiUrl()}/api/csrf/`, { credentials: 'include' });
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    try {
      const response = await fetch(`${getApiUrl()}/api/chat/user/settings/`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setLoginUser(data.user);
        setUserSettings(data.settings || null);
      } else {
        setLoginUser(null);
        setUserSettings(null);
      }
    } catch {
      setLoginUser(null);
      setUserSettings(null);
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={
          <LobbyPage
            loginUser={loginUser}
            loginLoading={loginLoading}
            checkLoginStatus={checkLoginStatus}
            userSettings={userSettings}
            setUserSettings={setUserSettings}
          />
        } />
        <Route path="/room/:roomId" element={
          <ChatRoomPage
            loginUser={loginUser}
            loginLoading={loginLoading}
            checkLoginStatus={checkLoginStatus}
            userSettings={userSettings}
            setUserSettings={setUserSettings}
          />
        } />
      </Routes>
    </Router>
  );
}

export default App;
