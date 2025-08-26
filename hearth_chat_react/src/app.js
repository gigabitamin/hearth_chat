import React, { useEffect, useState, useRef } from 'react';
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
import GlobalChatInput from './components/GlobalChatInput';
import { getApiBase, csrfFetch, getCookie, getWebSocketUrl } from './utils/apiConfig';
import './App.css';
import AiMessageRenderer from './components/AiMessageRenderer';
import ttsService from './services/ttsService';


// API_BASE 상수는 utils/apiConfig.js에서 import됨


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

function ChatRoomPage({ loginUser, loginLoading, checkLoginStatus, userSettings, setUserSettings, onUserMenuOpen, isSettingsModalOpen, setIsSettingsModalOpen, isLoginModalOpen, setIsLoginModalOpen, settingsTab, setSettingsTab, pendingImageFile, setPendingImageFile, pendingImageUrls, setPendingImageUrls }) {
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
        pendingImageFile={pendingImageFile}
        setPendingImageFile={setPendingImageFile}
        pendingImageUrls={pendingImageUrls}
        setPendingImageUrls={setPendingImageUrls}
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
    room, // 기존 selectedRoom
    setRoom,
    roomMessages, // room도 받아옴
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
    ws,
    setRoomMessages,
    // 이미지 뷰어 모달 상태 추가
    viewerImage,
    setViewerImage,
    // GlobalChatInput에서 전달받은 이미지 파일 상태
    pendingImageFile,
    setPendingImageFile,
    // 다중 이미지 URL 상태
    pendingImageUrls,
    setPendingImageUrls,
  } = props;

  // const [isFavoriteRoom, setIsFavoriteRoom] = useState(false);
  // const [isFavoriteRoom, setIsFavoriteRoom] = useState(room?.is_favorite || false);
  const isFavoriteRoom = !!room?.is_favorite;

  // 즐겨찾기 토글 함수 (서버에 요청 + room 상태 갱신)
  const handleToggleFavoriteRoom = async () => {
    if (!room) return;
    const isFav = room.is_favorite;
    const url = `${getApiBase()}/api/chat/rooms/${room.id}/${isFav ? 'unfavorite' : 'favorite'}/`;
    const method = isFav ? 'DELETE' : 'POST';
    try {
      const csrftoken = getCookie('csrftoken');
      await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'X-CSRFToken': csrftoken },
      });
      // 서버에서 최신 room 정보 fetch
      const res = await fetch(`${getApiBase()}/api/chat/rooms/${room.id}/`, { credentials: 'include' });
      if (res.ok) {
        const updatedRoom = await res.json();
        setRoom(updatedRoom); // room 상태 갱신
      }
    } catch (err) {
      alert('즐겨찾기 처리 실패: ' + err.message);
    }
  };

  const [ttsRate, setTtsRate] = useState(1.5);
  const [ttsPitch, setTtsPitch] = useState(1.5);
  const [ttsVoice, setTtsVoice] = useState(null);
  const [voiceList, setVoiceList] = useState(null); // 음성 목록이 필요 없다면 빈 배열로
  const [isTTSEnabled, setIsTTSEnabled] = useState(false);
  const [isVoiceRecognitionEnabled, setIsVoiceRecognitionEnabled] = useState(false);
  const [autoSend, setAutoSend] = useState(false);
  const [isContinuousRecognition, setIsContinuousRecognition] = useState(false);
  const voiceRecognitionRef = React.useRef(null);
  const [permissionStatus, setPermissionStatus] = useState('prompt');
  const [isCreateNewChatOpen, setIsCreateNewChatOpen] = useState(false);

  // 음성 목록 로드
  useEffect(() => {
    const loadVoiceList = () => {
      try {
        // ttsService가 지원되는지 확인
        if (ttsService && ttsService.isSupported()) {

          // 현재 음성 목록 가져오기
          let voices = ttsService.getVoices();

          if (voices.length > 0) {
            setVoiceList(voices);
          } else {
            // 음성 목록이 아직 로드되지 않은 경우, 이벤트 리스너 설정            

            let fallbackInterval;

            const handleVoicesChanged = () => {
              const loadedVoices = ttsService.getVoices();
              if (loadedVoices.length > 0) {
                setVoiceList(loadedVoices);
                // 이벤트 리스너 제거
                if (window.speechSynthesis) {
                  window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
                }
                // 폴백 인터벌 정리
                if (fallbackInterval) {
                  clearInterval(fallbackInterval);
                }
              }
            };

            // voiceschanged 이벤트 리스너 추가
            if (window.speechSynthesis) {
              window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
            }

            // 폴백: 주기적으로 음성 목록 확인 (이벤트가 작동하지 않는 경우)
            fallbackInterval = setInterval(() => {
              const currentVoices = ttsService.getVoices();
              if (currentVoices.length > 0) {
                console.log('🎵 음성 목록 로드됨 (폴백):', currentVoices);
                setVoiceList(currentVoices);
                clearInterval(fallbackInterval);
                // 이벤트 리스너도 제거
                if (window.speechSynthesis) {
                  window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
                }
              }
            }, 500);

            // 타임아웃 설정 (3초 후 빈 배열로 설정)
            setTimeout(() => {
              setVoiceList(prev => {
                if (prev === null) {
                  console.warn('🎵 음성 목록 로딩 타임아웃');
                  if (fallbackInterval) {
                    clearInterval(fallbackInterval);
                  }
                  return [];
                }
                return prev;
              });
            }, 3000);
          }
        } else {
          console.warn('TTS가 지원되지 않습니다.');
          setVoiceList([]);
        }
      } catch (error) {
        console.error('음성 목록 로드 실패:', error);
        setVoiceList([]);
      }
    };

    // 컴포넌트 마운트 시 음성 목록 로드
    loadVoiceList();
  }, []); // 의존성 배열을 비워서 한 번만 실행

  // userSettings에서 TTS 설정 로드하여 로컬 상태 동기화
  useEffect(() => {
    if (userSettings) {

      // TTS 설정 동기화
      if (userSettings.tts_speed !== undefined) {
        setTtsRate(userSettings.tts_speed);
      }
      if (userSettings.tts_pitch !== undefined) {
        setTtsPitch(userSettings.tts_pitch);
      }
      if (userSettings.tts_voice !== undefined) {
        // voiceList가 로드된 후에 음성 설정
        if (voiceList) {
          const selectedVoice = voiceList.find(v => v.name === userSettings.tts_voice);
          setTtsVoice(selectedVoice);
        }
      }
      if (userSettings.tts_enabled !== undefined) {
        setIsTTSEnabled(userSettings.tts_enabled);
      }
      if (userSettings.voice_recognition_enabled !== undefined) {
        setIsVoiceRecognitionEnabled(userSettings.voice_recognition_enabled);
      }
      if (userSettings.voice_auto_send !== undefined) {
        setAutoSend(userSettings.voice_auto_send);
      }
    }
  }, [userSettings, voiceList]);

  // 새 대화방 만들기 모달 열기
  const onOpenCreateRoomModal = () => {
    setIsCreateNewChatOpen(true);
  };


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
    headerTitle = room?.name || '채팅방';
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
    room ? (
      <div className="selected-room-info">
        {/* 방장이 설정한 프로필 이미지 등 추가 가능 */}
        <div className="selected-room-info-messages">
          {roomMessages.length === 0 ? (
            <div style={{ color: '#888' }}>아직 메시지가 없습니다.</div>
          ) : (
            roomMessages.map(msg => (
              <div key={msg.id} style={{ marginBottom: 8, color: msg.type === 'send' ? '#2196f3' : '#fff' }}>
                <span style={{ fontSize: 18, fontWeight: 600, backgroundColor: '#f0f0f0', padding: '4px 4px', borderRadius: 4 }}>{msg.sender}</span>
                <AiMessageRenderer message={msg.text} />
              </div>
            ))
          )}
        </div>
        {/* 입장하기 버튼 삭제 */}
        {/* <button className="enter-room-btn" style={{ marginTop: 16 }} onClick={() => { if (onClose) onClose(); window.location.href = `/room/${room.id}`; }}>입장하기</button> */}
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

  // ESC 키로 이미지 뷰어 닫기
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') setViewerImage(null);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

  return (
    <>
      {/* 상단바 공통 렌더링 */}
      <HeaderBar
        isFavoriteRoom={isFavoriteRoom}
        onToggleFavoriteRoom={handleToggleFavoriteRoom}
        activeTab={overlayTab}
        onTabChange={(tab) => {
          setOverlayTab(tab);
          if (isInRoom) setShowRoomListOverlay(true);
        }}
        onSearchClick={() => setIsSearchModalOpen(true)}
        onNotifyClick={() => setIsNotifyModalOpen(true)}
        onSettingsClick={() => {
          setIsSettingsModalOpen(true);
        }}
        onLoginClick={() => {
          setIsLoginModalOpen(true);
        }}
        onCreateRoomClick={() => setShowCreateModal(true)}
        loginUser={loginUser}
        title={headerTitle}
        unreadNotifications={unreadNotifications}
        isInRoom={isInRoom}
        room={room}
      />
      {/* 알림/검색 모달 */}
      <NotifyModal
        open={isNotifyModalOpen}
        onClose={() => { setIsNotifyModalOpen(false); }}
        notifications={notifications.map(n => ({
          ...n,
          read: !unreadNotificationList.some(u => u.message_id === n.messageId)
        }))}
        onNotificationRead={(id, roomId, messageId) => handleNotificationRead(id, roomId, messageId)}
        unreadList={unreadNotificationList}
        onMarkAllAsRead={handleMarkAllAsRead}
      />
      <SearchModal open={isSearchModalOpen} onClose={() => { setIsSearchModalOpen(false); }} rooms={allRooms} messages={allMessages} users={allUsers} fetchPreviewMessages={fetchPreviewMessages} />
      {/* 로그인 모달 */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => { setIsLoginModalOpen(false); }}
        onSocialLogin={(url) => {
          const popupWidth = 480;
          const popupHeight = 600;
          const left = window.screenX + (window.outerWidth - popupWidth) / 2;
          const top = window.screenY + (window.outerHeight - popupHeight) / 2;
          const popupFeatures = `width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes,menubar=no,toolbar=no,location=no`;

          const popup = window.open(url, 'social_login', popupFeatures);
          console.log('[DEBUG] 팝업 열기 결과:', popup);

          if (popup) {
            console.log('[DEBUG] 팝업 감시 시작');
            const checkClosed = setInterval(() => {
              console.log('[DEBUG] 팝업 상태 확인 중... closed:', popup.closed);
              if (popup.closed) {
                console.log('[DEBUG] 팝업 닫힘 감지! 모달 닫기 및 페이지 갱신 시작');
                clearInterval(checkClosed);

                // 1. 로그인 모달 닫기
                setIsLoginModalOpen(false);
                console.log('[DEBUG] 로그인 모달 닫힘');

                // 2. 소셜 로그인 완료 후 세션 업데이트 대기
                console.log('[DEBUG] 소셜 로그인 세션 업데이트 대기 시작');

                // 3. 세션 업데이트 확인을 위한 재시도 로직
                let retryCount = 0;
                const maxRetries = 10; // 최대 10회 시도

                const checkSessionUpdate = async () => {
                  try {
                    console.log(`[DEBUG] 세션 확인 시도 ${retryCount + 1}/${maxRetries}`);
                    const response = await csrfFetch(`${getApiBase()}/api/chat/user/settings/`, {
                      credentials: 'include',
                      headers: {
                        'X-CSRFToken': getCookie('csrftoken'),
                      },
                    });

                    if (response.ok) {
                      console.log('[DEBUG] 세션 업데이트 확인됨! 로그인 성공');
                      const data = await response.json();

                      // 4. 페이지 갱신
                      console.log('[DEBUG] 페이지 갱신 실행');
                      setTimeout(() => {
                        console.log('[DEBUG] window.location.reload() 실행');
                        window.location.reload();
                      }, 500);
                      return;
                    } else {
                      console.log(`[DEBUG] 세션 아직 업데이트 안됨 (${response.status}), 재시도...`);
                      retryCount++;

                      if (retryCount < maxRetries) {
                        // 1초 후 재시도
                        setTimeout(checkSessionUpdate, 1000);
                      } else {
                        console.log('[DEBUG] 최대 재시도 횟수 도달, 강제 페이지 갱신');
                        window.location.reload();
                      }
                    }
                  } catch (error) {
                    console.error('[DEBUG] 세션 확인 중 오류:', error);
                    retryCount++;

                    if (retryCount < maxRetries) {
                      setTimeout(checkSessionUpdate, 1000);
                    } else {
                      console.log('[DEBUG] 최대 재시도 횟수 도달, 강제 페이지 갱신');
                      window.location.reload();
                    }
                  }
                };

                // 첫 번째 세션 확인 시작
                checkSessionUpdate();
              }
            }, 200); // 500ms에서 200ms로 단축

            // 백업 타이머: 10초 후에도 팝업이 닫히지 않으면 강제로 처리
            setTimeout(() => {
              if (!popup.closed) {
                console.log('[DEBUG] 백업 타이머: 팝업이 10초 후에도 열려있음, 강제 처리');
                clearInterval(checkClosed);
                setIsLoginModalOpen(false);
                checkLoginStatus();
                window.location.reload();
              }
            }, 10000);
          } else {
            console.error('[DEBUG] 팝업창 열기 실패');
            alert('팝업창이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.');
          }
        }}
      />
      {/* 설정 모달 */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => { setIsSettingsModalOpen(false); }}
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
          onClose={() => { setShowCreateModal(false); }}
          onSuccess={handleCreateRoomSuccess}
        />
      )}
      {/* 채팅방 내 사이드바 오버레이: showRoomListOverlay가 true일 때만 표시 */}
      {showRoomListOverlay && (
        <div className="room-list-overlay" onClick={() => setShowRoomListOverlay(false)}>
          <div className="room-list-overlay-panel" onClick={e => e.stopPropagation()}>
            {/* 사이드바 탭 헤더 관리 영역 */}
            <div className="overlay-tabs" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'row', gap: 8 }}>
                <button onClick={() => setOverlayTab('personal')} className={`header-tab-btn${!isInRoom && overlayTab === 'personal' ? ' active' : ''}`}>개인</button>
                <button onClick={() => setOverlayTab('open')} className={`header-tab-btn${!isInRoom && overlayTab === 'open' ? ' active' : ''}`}>오픈</button>
                <button onClick={() => setOverlayTab('favorite')} className={`header-tab-btn${!isInRoom && overlayTab === 'favorite' ? ' active' : ''}`}>★</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'row', gap: 8 }}>
                <button
                  onClick={() => { setShowCreateModal(true); setShowRoomListOverlay(false); }}
                  title="새 대화방 만들기"
                  style={{ background: 'none', border: 'none', fontSize: 24, marginLeft: 4, cursor: 'pointer', color: '#ff9800', padding: '0 6px' }}
                >🔥
                </button>
                <button
                  className="sidebar-home-overlay-btn"
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: 28,
                    cursor: 'pointer',
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'none',
                  }}
                  title="홈으로"
                  onClick={() => window.location.href = '/'}
                >
                  🏠
                </button>
              </div>
            </div>
            {/* 사이드바 채팅방 목록 관리 영역 */}
            <div className="room-list-overlay-main" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div className="sidebar-room-list-info-panel">
                <ChatRoomList
                  onRoomSelect={async (room) => {
                    if (overlayTab === 'favorite') return; // 즐겨찾기 탭일 때는 메시지 요청/갱신 중단
                    setRoom(room);
                    // 메시지 불러오기 (예시: 최신 10개)
                    try {
                      // 최근 메시지 10개 가져오기 
                      // 무한 스크롤 기능을 위해 시간 오름차순으로 배열한 일반 messages API 대신 시간 내림차순으로 재배열한 recent API 사용
                      const res = await csrfFetch(`${getApiBase()}/api/chat/messages/recent/?room=${room.id}&limit=10&offset=0`, { credentials: 'include' });
                      if (res.ok) {
                        const data = await res.json();
                        setRoomMessages(data.results || []); // AppContent에서 관리
                      } else {
                        setRoomMessages([]); // AppContent에서 관리
                      }
                    } catch {
                      setRoomMessages([]); // AppContent에서 관리
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
                  selectedRoomId={room?.id}
                  onClose={() => setShowRoomListOverlay(false)}
                  overlayKey="overlay"
                  onPreviewMessage={fetchPreviewMessages}
                />
              </div>
              {overlayTab !== 'favorite' && (
                <div className="sidebar-room-info-panel">
                  <span style={{ fontSize: 18, fontWeight: 600 }}>최근 메시지 &nbsp; </span> {room.name}
                  {renderRoomInfoPanel(() => setShowRoomListOverlay(false))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <Routes>
        <Route path="/" element={
          <div className="app-container">
            {/* Lobby 대기방 ChatRoomList 관리 영역 */}
            <div className="room-list-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* lobby-tabs(파란색 탭 버튼 그룹) 완전히 삭제 */}
              {/* <HeaderBar ... /> 이 부분을 완전히 제거 */}
              {/* 대기방 상단 목록 관리 영역 */}
              <div className="room-list-info-panel">
                <ChatRoomList
                  onRoomSelect={async (room) => {
                    setRoom(room);
                    try {
                      if (overlayTab === 'favorite') return; // 즐겨찾기 탭일 때는 메시지 요청/갱신 중단
                      // 최근 메시지 10개 가져오기 
                      // 무한 스크롤 기능을 위해 시간 오름차순으로 배열한 일반 messages API 대신 시간 내림차순으로 재배열한 recent API 사용
                      const res = await csrfFetch(`${getApiBase()}/api/chat/messages/recent/?room=${room.id}&limit=10&offset=0`, { credentials: 'include' });
                      if (res.ok) {
                        const data = await res.json();
                        // console.log('data.results', data.results);
                        // 시간순으로 표시하기 위해 배열을 뒤집어줘야할 필요가 있을 경우 (.slice().reverse())
                        // 백엔드 API(recent)가 이미 최신순으로 10개를 반환하므로, 뒤집어줄 필요가 없음
                        setRoomMessages(data.results || []); // AppContent에서 관리
                      } else {
                        setRoomMessages([]); // AppContent에서 관리
                      }
                    } catch {
                      setRoomMessages([]); // AppContent에서 관리
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
                  selectedRoomId={room?.id}
                  overlayKey="lobby"
                />
              </div>
              {/* 대가방 하단 정보 관리 영역 */}
              {overlayTab !== 'favorite' && (
                <div className="room-info-panel">
                  <span style={{ fontSize: 18, fontWeight: 600 }}>최근 메시지 &nbsp; </span> {room?.name}
                  {renderRoomInfoPanel()}
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
            onUserMenuOpen={() => setIsSettingsModalOpen(true)}
            isSettingsModalOpen={isSettingsModalOpen}
            setIsSettingsModalOpen={setIsSettingsModalOpen}
            isLoginModalOpen={isLoginModalOpen}
            setIsLoginModalOpen={setIsLoginModalOpen}
            settingsTab={settingsTab}
            setSettingsTab={setSettingsTab}
            pendingImageFile={pendingImageFile}
            setPendingImageFile={setPendingImageFile}
            pendingImageUrls={pendingImageUrls}
            setPendingImageUrls={setPendingImageUrls}
          />
        } />

        <Route path="/dashboard" element={<AdminPage loginUser={loginUser} loginLoading={loginLoading} checkLoginStatus={checkLoginStatus} />} />
      </Routes>
      {/* 항상 하단에 입력창 렌더링 */}
      <GlobalChatInput
        room={room}
        loginUser={loginUser}
        ws={ws}
        onOpenCreateRoomModal={onOpenCreateRoomModal}
        onImageClick={setViewerImage}
        setPendingImageFile={setPendingImageFile}
        userSettings={userSettings}
      />
      {/* 이미지 뷰어 모달 */}
      {viewerImage && (
        <div className="image-viewer-modal" onClick={() => setViewerImage(null)}>
          <img src={viewerImage} alt="확대 이미지" className="image-viewer-img" onClick={e => e.stopPropagation()} />
          <button className="image-viewer-close" onClick={() => setViewerImage(null)}>✖</button>
        </div>
      )}
      {/* --- [최종 수정] --- */}
      {/* CreateRoomModal에 open prop을 전달합니다. */}
      {isCreateNewChatOpen && (
        <CreateRoomModal
          open={isCreateNewChatOpen}  // <--- 이 줄을 추가해주세요!
          onClose={() => setIsCreateNewChatOpen(false)}
          onSuccess={handleCreateRoomSuccess} // onSuccess도 추가하면 좋습니다.
        />
      )}
    </>
  );
}

function App() {
  const location = useLocation();
  const [loginUser, setLoginUser] = useState(null);
  const [loginLoading, setLoginLoading] = useState(true);
  const [userSettings, setUserSettings] = useState(null);
  // 1. App 컴포넌트에서 room, setRoom, roomMessages, setRoomMessages를 전역 상태로 선언
  const [room, setRoom] = useState(null);
  const [roomMessages, setRoomMessages] = useState([]);
  // 추가: 상단 탭/모달 상태
  const [activeTab, setActiveTab] = useState('personal'); // 'personal' | 'open'
  // 오버레이 탭 상태: 기본값을 'favorite'로(즐겨찾기)
  const [overlayTab, setOverlayTab] = useState('favorite');
  const [isNotifyModalOpen, setIsNotifyModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false); // 새 채팅방 모달 상태
  const [showRoomListOverlay, setShowRoomListOverlay] = useState(false); // 채팅방 내 오버레이 상태
  const [wsConnected, setWsConnected] = useState(false); // WebSocket 연결 상태 전역 관리
  const [notifications, setNotifications] = useState([]);
  const [settingsTab, setSettingsTab] = useState('user');
  // 이미지 뷰어 모달 상태 추가
  const [viewerImage, setViewerImage] = useState(null);
  // GlobalChatInput에서 전달받은 이미지 파일 상태
  const [pendingImageFile, setPendingImageFile] = useState([]);
  const [pendingImageUrls, setPendingImageUrls] = useState([]); // 다중 이미지 URL 지원

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
        setRoom(roomData);
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

  // 팝업창으로부터 메시지 수신 처리 (백업용)
  useEffect(() => {
    const handleMessage = (event) => {
      if (
        event.data === 'login_success' ||
        (event.data && event.data.type === "SOCIAL_LOGIN_SUCCESS")
      ) {
        // 로그인 상태 다시 확인
        setIsLoginModalOpen(false);
        checkLoginStatus();
        // 페이지 새로고침        
        window.location.reload();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [isSettingsModalOpen]);

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
        console.log('[DEBUG] 로그인되지 않음 (응답 실패)');
        setLoginUser(null);
        setUserSettings(null);
      }
    } catch (error) {
      console.error('[DEBUG] checkLoginStatus 오류:', error);
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
    let wsInstance;
    const connect = () => {
      if (!loginUser || !loginUser.id) {
        return; // 로그인 확정 전에는 연결 시도하지 않음
      }
      // 변경 전: 프로토콜/호스트/포트로 직접 구성
      // const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // const host = window.location.hostname;
      // const port = process.env.NODE_ENV === 'production' ? '' : ':8000';
      // const wsUrl = `${protocol}//${host}${port}/ws/chat/`;
      const wsUrl = getWebSocketUrl('/ws/chat/');

      wsInstance = new window.WebSocket(wsUrl);
      ws.current = wsInstance;

      wsInstance.onopen = () => {
        // 연결 성공 시 재시도 횟수 초기화
        appWsRetryCountRef.current = 0;
      };

      wsInstance.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'room_list_update') {
            fetchNotifications(); // 실시간 알림 갱신
          }
        } catch (e) { console.error('[App] WebSocket onmessage 파싱 오류', e); }
      };

      wsInstance.onclose = () => {
        // Exponential Backoff 재연결 로직
        const waitTime = Math.pow(2, appWsRetryCountRef.current) * 1000;
        const maxWaitTime = 30000;
        const finalWaitTime = Math.min(waitTime, maxWaitTime);

        console.log(`[App.js] WebSocket 연결 끊김. ${finalWaitTime / 1000}초 후에 재연결합니다...`);

        setTimeout(() => {
          appWsRetryCountRef.current += 1;
          connect();
        }, finalWaitTime);
      };

      wsInstance.onerror = () => {
        // onerror 시 바로 onclose가 호출되므로, close만 호출해도 재연결 로직이 실행됩니다.
        wsInstance.close();
      };
    };
    connect();

    return () => {
      if (wsInstance) {
        // 컴포넌트 언마운트 시 재연결 로직이 실행되지 않도록 onclose를 null로 설정
        wsInstance.onclose = null;
        wsInstance.close();
      }
    };
  }, []); // 의존성 배열은 비워두어 한 번만 실행되도록 유지

  // 현재 페이지가 /room/:roomId로 시작하면 room 상태를 업데이트하는 useEffect 추가
  useEffect(() => {
    // /room/:roomId 패턴 매칭
    const match = location.pathname.match(/^\/room\/(\d+)/);
    if (match) {
      const roomId = match[1];
      const fetchRoom = async () => {
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
        }
      };
      fetchRoom();
    } else {
      setRoom(null); // 대기방 등에서는 room을 null로
    }
  }, [location.pathname]);

  // 실제 뷰포트 높이와 너비를 --real-vh, --real-vw 변수로 할당
  function setRealViewport() {
    document.documentElement.style.setProperty('--real-vh', `${window.innerHeight - 8}px`);
    document.documentElement.style.setProperty('--real-vw', `${window.innerWidth - 8}px`);
  }
  useEffect(() => {
    setRealViewport();
    window.addEventListener('resize', setRealViewport);
    return () => window.removeEventListener('resize', setRealViewport);
  }, []);

  const ws = useRef(null);
  const appWsRetryCountRef = useRef(0); // App.js 전용 재시도 카운터 추가

  // postMessage 이벤트 리스너 제거 - setInterval 방식만 사용
  return <AppContent
    loginUser={loginUser}
    loginLoading={loginLoading}
    userSettings={userSettings}
    setUserSettings={setUserSettings}
    room={room}
    setRoom={setRoom}
    roomMessages={roomMessages}
    setRoomMessages={setRoomMessages}
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
    ws={ws.current}
    // 이미지 뷰어 모달 상태 추가
    viewerImage={viewerImage}
    setViewerImage={setViewerImage}
    // GlobalChatInput에서 전달받은 이미지 파일 상태
    pendingImageFile={pendingImageFile}
    setPendingImageFile={setPendingImageFile}
    // 다중 이미지 URL 상태
    pendingImageUrls={pendingImageUrls}
    setPendingImageUrls={setPendingImageUrls}
  />;
}

export default App;
