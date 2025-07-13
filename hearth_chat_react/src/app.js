import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import ChatBox from './components/chat_box';
import ChatRoomList from './components/ChatRoomList';
import UserMenuModal from './components/UserMenuModal';
import './App.css';

// 환경에 따라 API_BASE 자동 설정 함수 추가
const getApiBase = () => {
  const hostname = window.location.hostname;
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) return 'https://hearthchat-production.up.railway.app';
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:8000';
  if (hostname === '192.168.44.9') return 'http://192.168.44.9:8000';
  return `http://${hostname}:8000`;
};

function LobbyPage({ loginUser, loginLoading, checkLoginStatus, userSettings, setUserSettings, onUserMenuOpen }) {
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
          onUserMenuOpen={onUserMenuOpen}
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

function ChatRoomPage({ loginUser, loginLoading, checkLoginStatus, userSettings, setUserSettings, onUserMenuOpen }) {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 방 정보 fetch
    const fetchRoom = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${getApiBase()}/api/chat/rooms/${roomId}/`, { credentials: 'include' });
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
      {/*
      <div className="chat-header">
        <button onClick={() => navigate('/')} className="back-btn">
          ← 대화방 목록
        </button>
        <h2>{room?.name}</h2>
      </div>
      */}
      <ChatBox
        selectedRoom={room}
        loginUser={loginUser}
        loginLoading={loginLoading}
        checkLoginStatus={checkLoginStatus}
        userSettings={userSettings}
        setUserSettings={setUserSettings}
        onUserMenuOpen={onUserMenuOpen}
      />
    </div>
  );
}

function App() {
  const [loginUser, setLoginUser] = useState(null);
  const [loginLoading, setLoginLoading] = useState(true);
  const [userSettings, setUserSettings] = useState(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedRoomMessages, setSelectedRoomMessages] = useState([]);

  // 앱 시작 시 CSRF 토큰 및 로그인 상태/설정값 가져오기
  useEffect(() => {
    fetch(`${getApiBase()}/api/csrf/`, { credentials: 'include' });
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    try {
      const response = await fetch(`${getApiBase()}/api/chat/user/settings/`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        console.log('checkLoginStatus 응답:', data);
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

  // 채팅방 목록에서 방 클릭 시 호출
  const handleRoomSelect = async (room) => {
    setSelectedRoom(room);
    // 메시지 불러오기 (예시: 최신 10개)
    try {
      const res = await fetch(`${getApiBase()}/api/chat/messages/messages/?room=${room.id}&limit=10&offset=0`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSelectedRoomMessages(data.results || []);
      } else {
        setSelectedRoomMessages([]);
      }
    } catch {
      setSelectedRoomMessages([]);
    }
  };

  return (
    <Router>
      {/* UserMenuModal을 항상 렌더링 */}
      <UserMenuModal
        isOpen={isUserMenuOpen}
        onClose={() => setIsUserMenuOpen(false)}
        loginUser={loginUser}
        checkLoginStatus={checkLoginStatus}
      />
      <Routes>
        <Route path="/" element={
          <div className="app-container">
            <div className="room-list-container">
              <ChatRoomList
                onRoomSelect={handleRoomSelect}
                loginUser={loginUser}
                loginLoading={loginLoading}
                checkLoginStatus={checkLoginStatus}
                onUserMenuOpen={() => setIsUserMenuOpen(true)}
              />
            </div>
            <div className="welcome-container">
              {selectedRoom ? (
                <div className="selected-room-info">
                  <h2>{selectedRoom.name}</h2>
                  {/* 방장이 설정한 프로필 이미지 등 추가 가능 */}
                  {/* 최신 메시지 목록 */}
                  <div style={{ maxHeight: 300, overflowY: 'auto', background: 'rgba(0,0,0,0.1)', borderRadius: 8, padding: 12, marginTop: 16 }}>
                    <h4>최근 메시지</h4>
                    {selectedRoomMessages.length === 0 ? (
                      <div style={{ color: '#888' }}>아직 메시지가 없습니다.</div>
                    ) : (
                      selectedRoomMessages.map(msg => (
                        <div key={msg.id} style={{ marginBottom: 8, color: msg.type === 'send' ? '#2196f3' : '#fff' }}>
                          <b>{msg.sender}:</b> {msg.text}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="welcome-content">
                  <h1>Hearth 🔥 Chat</h1>
                  <p>대화방을 선택하여 채팅을 시작하세요!</p>
                </div>
              )}
            </div>
          </div>
        } />
        <Route path="/room/:roomId" element={
          <ChatRoomPage
            loginUser={loginUser}
            loginLoading={loginLoading}
            checkLoginStatus={checkLoginStatus}
            userSettings={userSettings}
            setUserSettings={setUserSettings}
            onUserMenuOpen={() => setIsUserMenuOpen(true)}
          />
        } />
      </Routes>
    </Router>
  );
}

export default App;
