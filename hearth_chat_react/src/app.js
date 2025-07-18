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
import AdminDashboard from './components/AdminDashboard';
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

// CSRF 토큰 쿠키 가져오기
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

const csrfFetch = async (url, options = {}) => {
  const csrftoken = getCookie('csrftoken');
  const defaultHeaders = {
    'X-CSRFToken': csrftoken,
    'Content-Type': 'application/json',
  };

  const mergedOptions = {
    credentials: 'include',
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
  };

  return fetch(url, mergedOptions);
};

export { csrfFetch, getApiBase };


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
        const res = await csrfFetch(`${getApiBase()}/api/chat/rooms/${roomId}/`, { credentials: 'include' });
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

function AdminPage({ loginUser, loginLoading, checkLoginStatus }) {
  const navigate = useNavigate();

  // 관리자 권한 확인
  if (loginLoading) {
    return <div>로딩 중...</div>;
  }

  if (!loginUser || !loginUser.is_staff) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        textAlign: 'center'
      }}>
        <h2>접근 권한이 없습니다</h2>
        <p>관리자 권한이 필요합니다.</p>
        <button onClick={() => navigate('/')}>홈으로 돌아가기</button>
      </div>
    );
  }

  return <AdminDashboard />;
}

// 알림 도착 시 소리 재생 함수 추가
function playNotificationSound() {
  if (window.AudioContext || window.webkitAudioContext) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.value = 0.1;
    o.start();
    o.stop(ctx.currentTime + 0.15);
    setTimeout(() => ctx.close(), 300);
  }
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
    overlayTab,
    setOverlayTab,
    fetchPreviewMessages,
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
    if (isSearchModalOpen) setIsSearchModalOpen(false);
    setActiveTab(tab);
    if (isInRoom) setShowRoomListOverlay(true);
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

  // 알림 읽음 상태 관리
  const [readNotificationIds, setReadNotificationIds] = useState(() => {
    // 앱 시작 시 localStorage에서 읽어옴
    try {
      const saved = localStorage.getItem('readNotificationIds');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  // 읽지 않은 알림 개수 및 목록을 백엔드에서 받아옴
  const [unreadNotificationList, setUnreadNotificationList] = useState([]);
  const unreadNotifications = unreadNotificationList.length;

  // 알림 모달 열릴 때마다 unread API 호출
  useEffect(() => {
    if (isNotifyModalOpen) {
      fetch('/api/notifications/unread/', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          setUnreadNotificationList(data);
        })
        .catch(() => setUnreadNotificationList([]));
    }
  }, [isNotifyModalOpen]);

  // 알림 클릭 시 읽음 처리 후 unread 목록 갱신
  const handleNotificationRead = (id, roomId, messageId) => {
    setReadNotificationIds(prev => {
      if (prev.includes(id)) return prev;
      const updated = [...prev, id];
      try {
        localStorage.setItem('readNotificationIds', JSON.stringify(updated));
      } catch { }
      return updated;
    });
    // 백엔드에 읽음 처리 요청
    if (roomId && messageId) {
      fetch('/api/notifications/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ room: roomId, message: messageId })
      }).then(() => {
        // 읽음 처리 후 unread 목록 갱신
        fetch('/api/notifications/unread/', { credentials: 'include' })
          .then(res => res.json())
          .then(data => setUnreadNotificationList(data))
          .catch(() => setUnreadNotificationList([]));
      });
    }
  };

  // 알림 목록이 바뀌면(새 알림 도착 등) localStorage와 동기화(삭제된 알림 정리)
  useEffect(() => {
    setReadNotificationIds(prev => {
      const validIds = notifications.map(n => n.id);
      const filtered = prev.filter(id => validIds.includes(id));
      if (filtered.length !== prev.length) {
        try {
          localStorage.setItem('readNotificationIds', JSON.stringify(filtered));
        } catch { }
      }
      return filtered;
    });
    // eslint-disable-next-line
  }, [notifications]);

  // 새 알림 도착 시 소리 재생 (알림 개수 변화 감지)
  useEffect(() => {
    if (notifications.length > 0 && unreadNotifications > 0) {
      playNotificationSound();
    }
    // eslint-disable-next-line
  }, [notifications.length]);

  // 알림 모달 내에서만 강조: unreadNotificationList를 NotifyModal에 전달
  // 전체 읽음 처리 핸들러
  const handleMarkAllAsRead = () => {
    // 모든 unread 알림에 대해 읽음 처리
    unreadNotificationList.forEach(n => {
      handleNotificationRead(n.message_id, n.room_id, n.message_id);
    });
  };

  // 알림 모달이 열려 있을 때 알림 목록 자동 새로고침(5초 간격)
  useEffect(() => {
    if (!isNotifyModalOpen) return;
    const interval = setInterval(() => {
      fetch('/api/notifications/unread/', { credentials: 'include' })
        .then(res => res.json())
        .then(data => setUnreadNotificationList(data))
        .catch(() => setUnreadNotificationList([]));
    }, 5000);
    return () => clearInterval(interval);
  }, [isNotifyModalOpen]);

  // 1. 브라우저 푸시 권한 요청 (최초 1회)
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // 2. 새 알림 도착 시 푸시 알림 전송 (포커스 외 탭에서만)
  useEffect(() => {
    if (!('Notification' in window)) return;
    if (document.visibilityState === 'visible') return; // 이미 포커스된 탭이면 푸시X
    if (Notification.permission !== 'granted') return;
    if (notifications.length === 0 || unreadNotifications === 0) return;
    // 가장 최근 미확인 알림만 푸시
    const latestUnread = notifications.find(n => unreadNotificationList.some(u => u.message_id === n.messageId));
    if (!latestUnread) return;
    const title = `[${latestUnread.roomName}] ${latestUnread.sender}`;
    const body = latestUnread.latestMessage || '새 메시지';
    const url = latestUnread.messageId ? `/room/${latestUnread.roomId}?messageId=${latestUnread.messageId}` : `/room/${latestUnread.roomId}`;
    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: `notify-${latestUnread.id}`
    });
    notification.onclick = (e) => {
      e.preventDefault();
      window.focus();
      window.location.href = url;
      notification.close();
    };
  }, [notifications, unreadNotifications, unreadNotificationList]);

  return (
    <>
      {/* 상단바 공통 렌더링 */}
      <HeaderBar
        activeTab={overlayTab}
        onTabChange={(tab) => {
          setOverlayTab(tab);
          if (isInRoom) setShowRoomListOverlay(true);
        }}
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
        unreadNotifications={unreadNotifications}
      />
      {/* 알림/검색 모달 */}
      <NotifyModal
        open={isNotifyModalOpen}
        onClose={() => setIsNotifyModalOpen(false)}
        notifications={notifications.map(n => ({
          ...n,
          read: !unreadNotificationList.some(u => u.message_id === n.messageId)
        }))}
        onNotificationRead={(id, roomId, messageId) => handleNotificationRead(id, roomId, messageId)}
        unreadList={unreadNotificationList}
        onMarkAllAsRead={handleMarkAllAsRead}
      />
      <SearchModal open={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} rooms={allRooms} messages={allMessages} users={allUsers} fetchPreviewMessages={fetchPreviewMessages} />
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
            <div className="overlay-tabs" style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button onClick={() => setOverlayTab('personal')} className={`header-tab-btn${!isInRoom && overlayTab === 'personal' ? ' active' : ''}`}>개인</button>
              <button onClick={() => setOverlayTab('open')} className={`header-tab-btn${!isInRoom && overlayTab === 'open' ? ' active' : ''}`}>오픈</button>
              <button onClick={() => setOverlayTab('favorite')} className={`header-tab-btn${!isInRoom && overlayTab === 'favorite' ? ' active' : ''}`}>★</button>
            </div>
            <div className="room-list-overlay-main" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ flex: 3, overflowY: 'auto' }}>
                <ChatRoomList
                  onRoomSelect={async (room) => {
                    setSelectedRoom(room);
                    // 메시지 불러오기 (예시: 최신 10개)
                    try {
                      const res = await csrfFetch(`${getApiBase()}/api/chat/messages/messages/?room=${room.id}&limit=10&offset=0`, { credentials: 'include' });
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
                  setActiveTab={setActiveTab}
                  sidebarTab={overlayTab}
                  setSidebarTab={setOverlayTab}
                  showCreateModal={showCreateModal}
                  setShowCreateModal={setShowCreateModal}
                  selectedRoomId={selectedRoom?.id}
                  onClose={() => setShowRoomListOverlay(false)}
                  overlayKey="overlay"
                  onPreviewMessage={fetchPreviewMessages}
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
              {/* lobby-tabs(파란색 탭 버튼 그룹) 완전히 삭제 */}
              {/* <HeaderBar ... /> 이 부분을 완전히 제거 */}
              <div style={{ flex: 3, overflowY: 'auto' }}>
                <ChatRoomList
                  onRoomSelect={async (room) => {
                    setSelectedRoom(room);
                    try {
                      const res = await csrfFetch(`${getApiBase()}/api/chat/messages/messages/?room=${room.id}&limit=10&offset=0`, { credentials: 'include' });
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
                  setActiveTab={setActiveTab}
                  sidebarTab={overlayTab}
                  setSidebarTab={setOverlayTab}
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
        <Route path="/admin" element={<AdminPage loginUser={loginUser} loginLoading={loginLoading} checkLoginStatus={checkLoginStatus} />} />
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
  const [overlayTab, setOverlayTab] = useState('personal');
  const [isNotifyModalOpen, setIsNotifyModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false); // 새 채팅방 모달 상태
  const [showRoomListOverlay, setShowRoomListOverlay] = useState(false); // 채팅방 내 오버레이 상태
  const [wsConnected, setWsConnected] = useState(false); // WebSocket 연결 상태 전역 관리
  const [notifications, setNotifications] = useState([]);
  const [settingsTab, setSettingsTab] = useState('user');

  // 1. previewMessages 상태 추가
  const [previewMessages, setPreviewMessages] = useState([]);

  // 검색 데이터 준비
  const [allRooms, setAllRooms] = useState([]);
  const [allMessages, setAllMessages] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  // App.js 내 함수 컴포넌트 시작 부분에 추가
  const fetchPreviewMessages = async (msg) => {
    if (!msg || !msg.room_id || !msg.id) return;
    try {
      // 기준 메시지 timestamp 가져오기
      const res = await csrfFetch(`${getApiBase()}/api/chat/messages/${msg.id}/`);
      if (!res.ok) return;
      const baseMsg = await res.json();
      const baseTime = baseMsg.timestamp;
      // 이전 2개
      const prevRes = await csrfFetch(`${getApiBase()}/api/chat/messages/?room=${msg.room_id}&before=${baseTime}&limit=2`);
      const prevMsgs = prevRes.ok ? (await prevRes.json()).results || [] : [];
      // 이후 2개
      const nextRes = await csrfFetch(`${getApiBase()}/api/chat/messages/?room=${msg.room_id}&after=${baseTime}&limit=2`);
      const nextMsgs = nextRes.ok ? (await nextRes.json()).results || [] : [];
      // 기준 메시지
      const centerMsg = { ...msg, isCenter: true };
      setPreviewMessages([...prevMsgs, centerMsg, ...nextMsgs]);
      // 방 정보도 갱신
      const roomRes = await csrfFetch(`${getApiBase()}/api/chat/rooms/${msg.room_id}/`);
      if (roomRes.ok) {
        const roomData = await roomRes.json();
        setSelectedRoom(roomData);
      }
    } catch { }
  };

  // rooms/messages/users 데이터 fetch (rooms+users+messages)
  const fetchAllRooms = async () => {
    try {
      const res = await csrfFetch(`${getApiBase()}/api/chat/rooms/`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAllRooms(data.results || data);
      }
    } catch { }
  };

  const fetchAllUsers = async () => {
    try {
      const res = await csrfFetch(`${getApiBase()}/api/chat/users/`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data.results || data);
      }
    } catch { }
  };

  const fetchAllMessages = async (query = '') => {
    try {
      let res;

      if (query.trim().length > 0) {
        // 검색어가 있을 때 → search API (GET 방식)
        const encodedQuery = encodeURIComponent(query);
        const searchUrl = `${getApiBase()}/api/chat/messages/search/?q=${encodedQuery}&scope=message&sort=date&limit=100`;

        res = await csrfFetch(searchUrl, {
          method: 'GET',
          credentials: 'include',
        });
      } else {
        // 검색어 없을 때 → all API 호출
        const allUrl = `${getApiBase()}/api/chat/messages/all/`;

        res = await csrfFetch(allUrl, {
          method: 'GET',
          credentials: 'include',
        });
      }

      if (res.ok) {
        const data = await res.json();
        setAllMessages(data.results || data);
      } else {
        console.error('메시지 fetch 실패:', res.status);
      }
    } catch (error) {
      console.error('메시지 fetch 중 오류 발생:', error);
    }
  };

  // 검색 모달 열릴 때 메시지 등 초기화
  useEffect(() => {
    if (isSearchModalOpen) {
      fetchAllRooms();
      fetchAllUsers();
      fetchAllMessages();
    }
  }, [isSearchModalOpen]);

  // App 컴포넌트에서 showCreateModal, setShowCreateModal, handleCreateRoomSuccess 전역 관리
  const handleCreateRoomSuccess = (newRoom) => {
    setShowCreateModal(false);
    setShowRoomListOverlay(false); // 방 생성 후 오버레이도 닫기
    window.location.href = `/room/${newRoom.id}`;
  };

  // 앱 시작 시 CSRF 토큰 및 로그인 상태/설정값 가져오기
  useEffect(() => {
    csrfFetch(`${getApiBase()}/api/csrf/`, { credentials: 'include' });
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    try {
      const response = await csrfFetch(`${getApiBase()}/api/chat/user/settings/`, {
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
      const response = await csrfFetch(`${getApiBase()}/api/chat/rooms/my_favorites/`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to fetch favorite rooms');
      const data = await response.json();
      const notis = (data.results || data).map(room => ({
        id: room.id, // 알림 ID 추가
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
    overlayTab={overlayTab}
    setOverlayTab={setOverlayTab}
    fetchPreviewMessages={fetchPreviewMessages}
  />;
}

export default App;
