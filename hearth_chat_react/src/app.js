import React, { useEffect, useState } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import ChatBox from './components/chat_box';
import ChatRoomList from './components/ChatRoomList';
import UserMenuModal from './components/UserMenuModal';
import HeaderBar from './components/HeaderBar';
import NotifyModal from './components/NotifyModal';
import SearchModal from './components/SearchModal';
import CreateRoomModal from './components/CreateRoomModal'; // (가정: 모달 컴포넌트 분리)
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
  const [selectedRoom, setSelectedRoom] = useState(null); // 미리보기용 선택 방
  const [selectedRoomMessages, setSelectedRoomMessages] = useState([]); // 미리보기용 메시지
  // 추가: 상단 탭/모달 상태
  const [activeTab, setActiveTab] = useState('personal'); // 'personal' | 'open'
  const [isNotifyModalOpen, setIsNotifyModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false); // 새 채팅방 모달 상태
  const [showRoomListOverlay, setShowRoomListOverlay] = useState(false); // 채팅방 내 오버레이 상태

  // App 컴포넌트에서 showCreateModal, setShowCreateModal, handleCreateRoomSuccess 전역 관리
  const handleCreateRoomSuccess = (newRoom) => {
    setShowCreateModal(false);
    setShowRoomListOverlay(false); // 방 생성 후 오버레이도 닫기
    window.location.href = `/room/${newRoom.id}`;
  };

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

  // 채팅방 목록에서 방 클릭 시: 미리보기만 갱신
  const handleRoomPreview = async (room) => {
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

  // 실제 입장하기 버튼 클릭 시: 방 이동
  const handleEnterRoom = (room) => {
    setShowRoomListOverlay(false); // 오버레이 닫기(오버레이에서만)
    window.location.href = `/room/${room.id}`;
  };

  // 오버레이 닫기 핸들러 (ESC, 바깥 클릭)
  React.useEffect(() => {
    if (!showRoomListOverlay) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowRoomListOverlay(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showRoomListOverlay]);

  // 더미 알림 데이터
  const notifications = [];

  // useLocation은 Router 내부에서만 사용 가능하므로, App.js는 Router로 감싸지지 않으므로, 아래처럼 별도 컴포넌트에서 사용
  function AppContent() {
    const location = useLocation();
    // 헤더 타이틀: 대기방/채팅방 구분
    let headerTitle = 'Hearth 🔥 Chat';
    if (location.pathname.startsWith('/room/')) {
      headerTitle = selectedRoom?.name || '';
    }
    // 채팅방 내에서만 오버레이 탭 동작
    const isInRoom = location.pathname.startsWith('/room/');

    // 탭 클릭 핸들러: 채팅방 내에서는 오버레이, 그 외에는 기존대로 탭 변경
    const handleTabChange = (tab) => {
      if (isInRoom) {
        setActiveTab(tab);
        setShowRoomListOverlay(true);
      } else {
        setActiveTab(tab);
      }
    };

    // 하단 정보창 렌더 함수 (공통)
    const renderRoomInfoPanel = (onClose) => (
      selectedRoom ? (
        <div className="selected-room-info">
          <h2>{selectedRoom.name}</h2>
          {/* 방장이 설정한 프로필 이미지 등 추가 가능 */}
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
          <button className="enter-room-btn" style={{ marginTop: 16 }} onClick={() => { if (onClose) onClose(); handleEnterRoom(selectedRoom); }}>입장하기</button>
        </div>
      ) : (
        <div className="welcome-content">
          <h1>Hearth 🔥 Chat</h1>
          <p>대화방을 선택하여 채팅을 시작하세요!</p>
        </div>
      )
    );

    return (
      <>
        <UserMenuModal
          isOpen={isUserMenuOpen}
          onClose={() => setIsUserMenuOpen(false)}
          loginUser={loginUser}
          checkLoginStatus={checkLoginStatus}
        />
        {/* 상단바 공통 렌더링 */}
        <HeaderBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onSearchClick={() => setIsSearchModalOpen(true)}
          onNotifyClick={() => setIsNotifyModalOpen(true)}
          onSettingsClick={() => setIsSettingsModalOpen(true)}
          onCreateRoomClick={() => setShowCreateModal(true)}
          title={headerTitle}
        />
        {/* 알림/검색 모달 */}
        <NotifyModal open={isNotifyModalOpen} onClose={() => setIsNotifyModalOpen(false)} notifications={notifications} />
        <SearchModal open={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} />
        {/* 새 방 만들기 모달을 AppContent에서 항상 렌더링 */}
        {showCreateModal && (
          <CreateRoomModal
            open={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onSuccess={handleCreateRoomSuccess}
          />
        )}
        {/* 채팅방 내 오버레이: showRoomListOverlay가 true일 때만 표시 */}
        {showRoomListOverlay && (
          <div className="room-list-overlay" onClick={() => setShowRoomListOverlay(false)}>
            <div className="room-list-overlay-panel" onClick={e => e.stopPropagation()}>
              <div className="room-list-overlay-main" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ flex: 3, overflowY: 'auto' }}>
                  <ChatRoomList
                    onRoomSelect={handleRoomPreview}
                    loginUser={loginUser}
                    loginLoading={loginLoading}
                    checkLoginStatus={checkLoginStatus}
                    onUserMenuOpen={() => setIsUserMenuOpen(true)}
                    activeTab={activeTab}
                    showCreateModal={showCreateModal}
                    setShowCreateModal={setShowCreateModal}
                    selectedRoomId={selectedRoom?.id}
                    onClose={() => setShowRoomListOverlay(false)}
                    overlayKey="overlay"
                  />
                </div>
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', borderTop: '1px solid #eee', background: '#fafbfc', padding: 12 }}>
                  {renderRoomInfoPanel(() => setShowRoomListOverlay(false))}
                </div>
              </div>
            </div>
          </div>
        )}
        <Routes>
          <Route path="/" element={
            <div className="app-container">
              <div className="room-list-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ flex: 3, overflowY: 'auto' }}>
                  <ChatRoomList
                    onRoomSelect={handleRoomPreview}
                    loginUser={loginUser}
                    loginLoading={loginLoading}
                    checkLoginStatus={checkLoginStatus}
                    onUserMenuOpen={() => setIsUserMenuOpen(true)}
                    activeTab={activeTab}
                    showCreateModal={showCreateModal}
                    setShowCreateModal={setShowCreateModal}
                    selectedRoomId={selectedRoom?.id}
                    overlayKey="lobby"
                  />
                </div>
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', borderTop: '1px solid #eee', background: '#fafbfc', padding: 12 }}>
                  {renderRoomInfoPanel()}
                </div>
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
      </>
    );
  }

  return <AppContent />;
}

export default App;
