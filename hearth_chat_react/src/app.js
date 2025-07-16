import React, { useEffect, useState } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import ChatBox from './components/chat_box';
import ChatRoomList from './components/ChatRoomList';
import HeaderBar from './components/HeaderBar';
import NotifyModal from './components/NotifyModal';
import SearchModal from './components/SearchModal';
import CreateRoomModal from './components/CreateRoomModal'; // (가정: 모달 컴포넌트 분리)
import LoginModal from './components/LoginModal';
import SettingsModal from './components/SettingsModal';
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

function ChatRoomPage({ loginUser, loginLoading, checkLoginStatus, userSettings, setUserSettings, onUserMenuOpen, isSettingsModalOpen, setIsSettingsModalOpen, isLoginModalOpen, setIsLoginModalOpen, settingsTab, setSettingsTab }) {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);

  // URL 파라미터에서 메시지 ID 추출
  const searchParams = new URLSearchParams(location.search);
  const highlightMessageId = searchParams.get('messageId');

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
        isSettingsModalOpen={isSettingsModalOpen}
        setIsSettingsModalOpen={setIsSettingsModalOpen}
        isLoginModalOpen={isLoginModalOpen}
        setIsLoginModalOpen={setIsLoginModalOpen}
        settingsTab={settingsTab}
        setSettingsTab={setSettingsTab}
        highlightMessageId={highlightMessageId}
      />
    </div>
  );
}

// AppContent를 App 함수 바깥으로 이동
function AppContent(props) {
  const {
    loginUser,
    loginLoading,
    userSettings,
    setUserSettings,
    selectedRoom,
    setSelectedRoom,
    selectedRoomMessages,
    setSelectedRoomMessages,
    activeTab,
    setActiveTab,
    isNotifyModalOpen,
    setIsNotifyModalOpen,
    isSearchModalOpen,
    setIsSearchModalOpen,
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    isLoginModalOpen,
    setIsLoginModalOpen,
    showCreateModal,
    setShowCreateModal,
    showRoomListOverlay,
    setShowRoomListOverlay,
    handleCreateRoomSuccess,
    checkLoginStatus,
    wsConnected,
    setWsConnected,
    userInfo,
    onDeleteAccount,
    notifications,
    setNotifications,
    allRooms,
    allMessages,
    allUsers,
    settingsTab,
    setSettingsTab,
  } = props;


  const [ttsRate, setTtsRate] = useState(1.5);
  const [ttsPitch, setTtsPitch] = useState(1.5);
  const [ttsVoice, setTtsVoice] = useState(null);
  const [voiceList, setVoiceList] = useState([]); // 음성 목록이 필요 없다면 빈 배열로
  const [isTTSEnabled, setIsTTSEnabled] = useState(false);
  const [isVoiceRecognitionEnabled, setIsVoiceRecognitionEnabled] = useState(false);
  const [autoSend, setAutoSend] = useState(false);
  const [isContinuousRecognition, setIsContinuousRecognition] = useState(false);
  const voiceRecognitionRef = React.useRef(null);
  const [permissionStatus, setPermissionStatus] = useState('prompt');
  
  const handleVoiceRecognitionToggle = () => {
    setIsVoiceRecognitionEnabled(v => !v);
  };
  const requestMicrophonePermission = () => {
    // 마이크 권한 요청 로직
  };

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
        <button className="enter-room-btn" style={{ marginTop: 16 }} onClick={() => { if (onClose) onClose(); window.location.href = `/room/${selectedRoom.id}`; }}>입장하기</button>
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
      {/* 상단바 공통 렌더링 */}
      <HeaderBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onSearchClick={() => setIsSearchModalOpen(true)}
        onNotifyClick={() => setIsNotifyModalOpen(true)}
        onSettingsClick={() => {
          console.log('설정 버튼 클릭됨!');
          setIsSettingsModalOpen(true);
        }}
        onLoginClick={() => {
          console.log('로그인 버튼 클릭됨!');
          setIsLoginModalOpen(true);
        }}
        onCreateRoomClick={() => setShowCreateModal(true)}
        loginUser={loginUser}
        title={headerTitle}
      />
      {/* 알림/검색 모달 */}
      <NotifyModal open={isNotifyModalOpen} onClose={() => setIsNotifyModalOpen(false)} notifications={notifications} />
      <SearchModal open={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} rooms={allRooms} messages={allMessages} users={allUsers} />
      {/* 로그인 모달 */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSocialLogin={(url) => {
          const popupWidth = 480;
          const popupHeight = 600;
          const left = window.screenX + (window.outerWidth - popupWidth) / 2;
          const top = window.screenY + (window.outerHeight - popupHeight) / 2;
          window.open(url, 'social_login', `width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`);
        }}
      />
      {/* 설정 모달 */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        tab={settingsTab}
        setTab={setSettingsTab}
        userSettings={userSettings}
        setUserSettings={setUserSettings}
        loginUser={loginUser}        
        ttsRate={ttsRate}
        setTtsRate={setTtsRate} 
        ttsPitch={ttsPitch}
        setTtsPitch={setTtsPitch}
        ttsVoice={ttsVoice}
        setTtsVoice={setTtsVoice}
        voiceList={voiceList}
        isTTSEnabled={isTTSEnabled}
        setIsTTSEnabled={setIsTTSEnabled}      
        isVoiceRecognitionEnabled={isVoiceRecognitionEnabled}
        setIsVoiceRecognitionEnabled={setIsVoiceRecognitionEnabled}
        autoSend={autoSend}
        setAutoSend={setAutoSend}
        isContinuousRecognition={isContinuousRecognition}
        setIsContinuousRecognition={setIsContinuousRecognition}
        voiceRecognitionRef={voiceRecognitionRef}
        handleVoiceRecognitionToggle={handleVoiceRecognitionToggle}
        permissionStatus={permissionStatus}
        requestMicrophonePermission={requestMicrophonePermission}
      />
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
                  onRoomSelect={async (room) => {
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
                  }}
                  loginUser={loginUser}
                  loginLoading={loginLoading}
                  checkLoginStatus={checkLoginStatus}
                  onUserMenuOpen={() => setIsSettingsModalOpen(true)}
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
                  onRoomSelect={async (room) => {
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
                  }}
                  loginUser={loginUser}
                  loginLoading={loginLoading}
                  checkLoginStatus={checkLoginStatus}
                  onUserMenuOpen={() => setIsSettingsModalOpen(true)}
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
            onUserMenuOpen={() => setIsSettingsModalOpen(true)}
            isSettingsModalOpen={isSettingsModalOpen}
            setIsSettingsModalOpen={setIsSettingsModalOpen}
            isLoginModalOpen={isLoginModalOpen}
            setIsLoginModalOpen={setIsLoginModalOpen}
            settingsTab={settingsTab}
            setSettingsTab={setSettingsTab}
          />
        } />
      </Routes>
    </>
  );
}

function App() {
  const [loginUser, setLoginUser] = useState(null);
  const [loginLoading, setLoginLoading] = useState(true);
  const [userSettings, setUserSettings] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null); // 미리보기용 선택 방
  const [selectedRoomMessages, setSelectedRoomMessages] = useState([]); // 미리보기용 메시지
  // 추가: 상단 탭/모달 상태
  const [activeTab, setActiveTab] = useState('personal'); // 'personal' | 'open'
  const [isNotifyModalOpen, setIsNotifyModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false); // 새 채팅방 모달 상태
  const [showRoomListOverlay, setShowRoomListOverlay] = useState(false); // 채팅방 내 오버레이 상태
  const [wsConnected, setWsConnected] = useState(false); // WebSocket 연결 상태 전역 관리
  const [notifications, setNotifications] = useState([]);
  const [settingsTab, setSettingsTab] = useState('user');

  // 검색 데이터 준비
  const [allRooms, setAllRooms] = useState([]);
  const [allMessages, setAllMessages] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  // rooms/messages/users 데이터 fetch (rooms+users+messages)
  const fetchAllRooms = async () => {
    try {
      const res = await fetch(`${getApiBase()}/api/chat/rooms/`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAllRooms(data.results || data);
      }
    } catch { }
  };
  const fetchAllUsers = async () => {
    try {
      const res = await fetch(`${getApiBase()}/api/chat/users/`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data.results || data);
      }
    } catch { }
  };
  const fetchAllMessages = async () => {
    try {
      const res = await fetch(`${getApiBase()}/api/chat/messages/all/`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAllMessages(data.results || data);
      }
    } catch { }
  };
  useEffect(() => { if (isSearchModalOpen) { fetchAllRooms(); fetchAllUsers(); fetchAllMessages(); } }, [isSearchModalOpen]);



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

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
  }
  
  const checkLoginStatus = async () => {
    try {
      const response = await fetch(`${getApiBase()}/api/chat/user/settings/`, {
        credentials: 'include',
        headers: {
          'X-CSRFToken': getCookie('csrftoken'),
        },
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
  

  // 알림 목록 fetch (즐겨찾기 방 최신 메시지)
  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${getApiBase()}/api/chat/rooms/my_favorites/`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to fetch favorite rooms');
      const data = await response.json();
      const notis = (data.results || data).map(room => ({
        roomId: room.id,
        roomName: room.name,
        latestMessage: room.latest_message ? room.latest_message.content : '(메시지 없음)',
        timestamp: room.latest_message ? room.latest_message.timestamp : null,
        sender: room.latest_message ? room.latest_message.sender : '',
      }));
      setNotifications(notis);
    } catch (err) {
      setNotifications([]);
    }
  };
  // 알림 모달 열릴 때마다 fetch
  useEffect(() => {
    if (isNotifyModalOpen) {
      fetchNotifications();
    }
  }, [isNotifyModalOpen]);

  // WebSocket 실시간 알림 push 연동
  React.useEffect(() => {
    let ws;
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      const wsUrl = (host === 'localhost' || host === '127.0.0.1')
        ? `${protocol}//${host}:8000/ws/chat/`
        : `${protocol}//${host}/ws/chat/`;
      ws = new window.WebSocket(wsUrl);
      ws.onopen = () => { console.log('[App] WebSocket 연결됨'); };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'room_list_update') {
            fetchNotifications(); // 실시간 알림 갱신
          }
        } catch (e) { console.error('[App] WebSocket onmessage 파싱 오류', e); }
      };
      ws.onclose = () => { setTimeout(connect, 3000); };
      ws.onerror = () => { ws.close(); };
    };
    connect();
    return () => { if (ws) ws.close(); };
  }, []);

  return <AppContent
    loginUser={loginUser}
    loginLoading={loginLoading}
    userSettings={userSettings}
    setUserSettings={setUserSettings}
    selectedRoom={selectedRoom}
    setSelectedRoom={setSelectedRoom}
    selectedRoomMessages={selectedRoomMessages}
    setSelectedRoomMessages={setSelectedRoomMessages}
    activeTab={activeTab}
    setActiveTab={setActiveTab}
    isNotifyModalOpen={isNotifyModalOpen}
    setIsNotifyModalOpen={setIsNotifyModalOpen}
    isSearchModalOpen={isSearchModalOpen}
    setIsSearchModalOpen={setIsSearchModalOpen}
    isSettingsModalOpen={isSettingsModalOpen}
    setIsSettingsModalOpen={setIsSettingsModalOpen}
    isLoginModalOpen={isLoginModalOpen}
    setIsLoginModalOpen={setIsLoginModalOpen}
    showCreateModal={showCreateModal}
    setShowCreateModal={setShowCreateModal}
    showRoomListOverlay={showRoomListOverlay}
    setShowRoomListOverlay={setShowRoomListOverlay}
    handleCreateRoomSuccess={handleCreateRoomSuccess}
    checkLoginStatus={checkLoginStatus}
    wsConnected={wsConnected}
    setWsConnected={setWsConnected}
    userInfo={loginUser}
    notifications={notifications}
    setNotifications={setNotifications}
    allRooms={allRooms}
    allMessages={allMessages}
    allUsers={allUsers}
    settingsTab={settingsTab}
    setSettingsTab={setSettingsTab}
  />;
}

export default App;
