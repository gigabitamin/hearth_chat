import React, { useState, useEffect, useRef } from 'react';
import LoginModal from './LoginModal';
import './ChatRoomList.css';
import { useNavigate } from 'react-router-dom';

const AI_PROVIDERS = [
    { value: 'GEMINI', label: 'Gemini' },
    { value: 'CHATGPT', label: 'ChatGPT' },
    { value: 'CLUDE', label: 'Clude' },
];

// CSRF 토큰 읽기 함수
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}
const csrftoken = getCookie('csrftoken');

// 환경에 따라 API_BASE 자동 설정
const hostname = window.location.hostname;
const isProd = process.env.NODE_ENV === 'production';
const API_BASE = isProd
    ? 'https://hearthchat-production.up.railway.app'
    : (hostname === 'localhost' || hostname === '127.0.0.1')
        ? 'http://localhost:8000'
        : hostname === '192.168.44.9'
            ? 'http://192.168.44.9:8000'
            : `http://${hostname}:8000`;

// ChatRoomList 컴포넌트에 onClose prop 추가
const ChatRoomList = ({ onRoomSelect, selectedRoomId, loginUser, loginLoading, checkLoginStatus, onUserMenuOpen, activeTab, setActiveTab, showCreateModal, setShowCreateModal, onClose, onCreateRoomSuccess, overlayKey, wsConnected, setWsConnected }) => {
    const navigate = useNavigate();
    // 사이드바 전용 탭 상태 분리
    const [sidebarTab, setSidebarTab] = useState('personal');
    const [rooms, setRooms] = useState([]);
    const [publicRooms, setPublicRooms] = useState([]);
    const [favoriteRooms, setFavoriteRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [createType, setCreateType] = useState('ai');
    const [createName, setCreateName] = useState('');
    const [createAI, setCreateAI] = useState('GEMINI');
    const [createIsPublic, setCreateIsPublic] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState(null);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    // const [wsConnected, setWsConnected] = useState(false); // 제거: App에서 관리
    const wsRef = useRef(null);
    const listRef = useRef(null); // 스크롤 위치 보존용 ref
    // context별(오버레이/대기방)로 스크롤 위치를 분리 저장
    const scrollPositions = useRef({});
    const prevSelectedRoomId = useRef(null);

    // useEffect에서 fetchRooms, fetchPublicRooms, connectWebSocket 중복 호출 최소화
    useEffect(() => {
        console.log('ChatRoomList useEffect 실행됨 (마운트/언마운트)', { selectedRoomId, overlayKey });
        fetchRooms();
        fetchPublicRooms();
        connectWebSocket();
        // 중복 호출 방지: 의존성 배열을 []로 유지
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []);

    console.log('ChatRoomList 렌더링', { selectedRoomId, overlayKey });


    const openSocialLoginPopup = (url) => {
        const popup = window.open(url, 'social_login', 'width=500,height=600');
        const checkClosed = setInterval(() => {
            if (popup.closed) {
                clearInterval(checkClosed);
                checkLoginStatus();
            }
        }, 1000);
    };

    const connectWebSocket = () => {
        try {
            // 환경에 따라 WebSocket URL 설정
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.hostname;
            const isLocalhost = host === 'localhost' || host === '127.0.0.1';
            const wsUrl = isLocalhost
                ? `${protocol}//${host}:8000/ws/chat/`
                : `${protocol}//${host}/ws/chat/`;

            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('WebSocket 연결됨');
                setWsConnected && setWsConnected(true);
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                console.log('WebSocket 메시지 수신:', data);

                // 대화방 목록 업데이트 메시지 처리
                if (data.type === 'room_list_update') {
                    fetchRooms();
                }
            };

            ws.onclose = () => {
                console.log('WebSocket 연결 끊어짐');
                setWsConnected && setWsConnected(false);
                // 재연결 시도
                setTimeout(() => {
                    if (wsRef.current === ws) {
                        connectWebSocket();
                    }
                }, 3000);
            };

            ws.onerror = (error) => {
                console.error('WebSocket 오류:', error);
                setWsConnected && setWsConnected(false);
            };
        } catch (error) {
            console.error('WebSocket 연결 실패:', error);
        }
    };

    const fetchRooms = async () => {
        try {
            setLoading(true);
            // 환경에 따라 API URL 설정            
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const apiUrl = isLocalhost ? 'http://localhost:8000' : `http://${window.location.hostname}:8000`;
            const response = await fetch(`${API_BASE}/api/chat/rooms/`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            if (!response.ok) {
                throw new Error('Failed to fetch rooms');
            }
            const data = await response.json();
            setRooms(data.results || data);
        } catch (err) {
            setError(err.message);
            console.error('Error fetching rooms:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchPublicRooms = async () => {
        try {
            // 환경에 따라 API URL 설정
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const apiUrl = isLocalhost ? 'http://localhost:8000' : `http://${window.location.hostname}:8000`;

            const response = await fetch(`${API_BASE}/api/chat/rooms/public/`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            if (!response.ok) {
                throw new Error('Failed to fetch public rooms');
            }
            const data = await response.json();
            setPublicRooms(data.results || data);
        } catch (err) {
            console.error('Error fetching public rooms:', err);
        }
    };

    // 즐겨찾기 목록 fetch
    const fetchMyFavorites = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE}/api/chat/rooms/my_favorites/`, {
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!response.ok) throw new Error('Failed to fetch favorite rooms');
            const data = await response.json();
            setFavoriteRooms(data.results || data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // 탭 변경 시 목록 fetch (sidebarTab 기준으로 변경)
    useEffect(() => {
        if (sidebarTab === 'favorite') {
            fetchMyFavorites();
        } else if (sidebarTab === 'personal') {
            fetchRooms();
        } else if (sidebarTab === 'open') {
            fetchPublicRooms();
        }
    }, [sidebarTab]);

    // 즐겨찾기 토글
    const handleFavoriteToggle = async (room, e) => {
        e.stopPropagation();
        if (!loginUser) return;
        const isFav = room.is_favorite;
        const url = `${API_BASE}/api/chat/rooms/${room.id}/${isFav ? 'unfavorite' : 'favorite'}/`;
        const method = isFav ? 'DELETE' : 'POST';
        try {
            const csrftoken = getCookie('csrftoken');
            await fetch(url, {
                method,
                credentials: 'include',
                headers: { 'X-CSRFToken': csrftoken },
            });
            if (sidebarTab === 'favorite') {
                fetchMyFavorites();
            } else {
                fetchRooms();
            }
        } catch (err) {
            alert('즐겨찾기 처리 실패: ' + err.message);
        }
    };

    // 방 클릭 시 스크롤 위치 저장 (미리보기/입장 모두)
    const handleRoomClick = (room) => {
        if (listRef.current) {
            scrollPositions.current[overlayKey || 'default'] = listRef.current.scrollTop;
            console.log('스크롤 위치 저장', overlayKey, listRef.current.scrollTop);
        }
        // 목록 클릭 시 fetchRooms 호출하지 않음, 오직 미리보기만 갱신
        onRoomSelect(room);
        prevSelectedRoomId.current = room.id;
    };

    // selectedRoomId, overlayKey가 바뀔 때 스크롤 위치 복원
    useEffect(() => {
        if (listRef.current && prevSelectedRoomId.current === selectedRoomId) {
            const pos = scrollPositions.current[overlayKey || 'default'] || 0;
            listRef.current.scrollTop = pos;
            console.log('스크롤 위치 복원', overlayKey, pos);
        }
    }, [selectedRoomId, overlayKey]);

    const handleCreateRoom = async (e) => {
        e.preventDefault();
        setCreating(true);
        setCreateError(null);
        try {
            const body = {
                name: createName || (createType === 'ai' ? `${createAI}와의 대화` : ''),
                room_type: createType,
                ai_provider: createType === 'ai' ? createAI : '',
                is_public: createIsPublic,
            };
            const csrftoken = getCookie('csrftoken');
            // 환경에 따라 API URL 설정
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const apiUrl = isLocalhost ? 'http://localhost:8000' : `http://${window.location.hostname}:8000`;

            const response = await fetch(`${API_BASE}/api/chat/rooms/`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken,
                },
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '대화방 생성 실패');
            }
            const newRoom = await response.json();
            setShowCreateModal(false);
            setCreateName('');
            setCreateType('ai');
            setCreateAI('GEMINI');
            setCreateIsPublic(false);
            await fetchRooms();
            await fetchPublicRooms();
            if (onCreateRoomSuccess) {
                onCreateRoomSuccess(newRoom);
            } else {
                onRoomSelect(newRoom); // fallback
            }
        } catch (err) {
            setCreateError(err.message);
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteRoom = async (roomId) => {
        if (!window.confirm('정말로 이 대화방을 삭제하시겠습니까?')) {
            return;
        }

        try {
            const csrftoken = getCookie('csrftoken');
            // 환경에 따라 API URL 설정
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const apiUrl = isLocalhost ? 'http://localhost:8000' : `http://${window.location.hostname}:8000`;

            const response = await fetch(`${API_BASE}/api/chat/rooms/${roomId}/`, {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'X-CSRFToken': csrftoken,
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '대화방 삭제 실패');
            }

            await fetchRooms();
            alert('대화방이 삭제되었습니다.');
        } catch (err) {
            alert(`대화방 삭제 실패: ${err.message}`);
        }
    };

    const handleJoinRoom = async (roomId) => {
        try {
            const csrftoken = getCookie('csrftoken');
            // 환경에 따라 API URL 설정
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const apiUrl = isLocalhost ? 'http://localhost:8000' : `http://${window.location.hostname}:8000`;

            const response = await fetch(`${API_BASE}/api/chat/rooms/${roomId}/join/`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'X-CSRFToken': csrftoken,
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '방 입장 실패');
            }

            await fetchRooms();
            await fetchPublicRooms();
            alert('방에 입장했습니다!');
        } catch (err) {
            alert(`방 입장 실패: ${err.message}`);
        }
    };

    const getRoomIcon = (roomType, aiProvider) => {
        switch (roomType) {
            case 'ai':
                switch (aiProvider) {
                    case 'GEMINI':
                        return '🤖';
                    case 'CHATGPT':
                        return '🧠';
                    case 'CLUDE':
                        return '💡';
                    default:
                        return '🤖';
                }
            case 'user':
                return '👤';
            case 'group':
                return '👥';
            case 'voice':
                return '📞';
            default:
                return '💬';
        }
    };

    const handleEmailLogin = () => {
        setIsLoginModalOpen(true);
    };

    const buttonStyle = {
        background: 'rgba(255,255,255,0.12)',
        border: 'none',
        borderRadius: 4,
        padding: '6px 12px',
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
        display: 'flex',
        alignItems: 'center',
        textDecoration: 'none',
        cursor: 'pointer',
        minWidth: 100,
        justifyContent: 'center',
    };

    return (
        <div className="chat-room-list">
            {/* 사이드바/오버레이 상단에 탭 UI: overlayKey가 'overlay'일 때만 표시 */}
            {overlayKey === 'overlay' && (
                <div className="chat-roomlist-tabs" style={{ display: 'flex', gap: 4, marginBottom: 10, marginTop: 2, justifyContent: 'center' }}>
                    <button
                        className={`header-tab-btn${sidebarTab === 'personal' ? ' active' : ''}`}
                        onClick={() => setSidebarTab('personal')}
                    >개인</button>
                    <button
                        className={`header-tab-btn${sidebarTab === 'open' ? ' active' : ''}`}
                        onClick={() => setSidebarTab('open')}
                    >오픈</button>
                    <button
                        className={`header-tab-btn${sidebarTab === 'favorite' ? ' active' : ''}`}
                        onClick={() => setSidebarTab('favorite')}
                        title="즐겨찾기"
                        style={{ color: '#FFD600', fontSize: 20, padding: '0 12px' }}
                    >★</button>
                </div>
            )}

            {loading ? (
                <div className="loading">대화방 목록을 불러오는 중...</div>
            ) : error ? (
                <div className="error">Please login</div>
            ) : (!loginUser ? (
                <div className="no-rooms">
                    <button className="login-btn" onClick={() => setIsLoginModalOpen(true)} style={{ fontSize: 18, padding: '12px 32px', borderRadius: 8, background: '#2196f3', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>로그인</button>
                </div>
            ) : (sidebarTab === 'personal' ? rooms.length === 0 : publicRooms.length === 0) ? (
                <div className="no-rooms">
                    <p>{sidebarTab === 'personal' ? '참여 중인 대화방이 없습니다.' : '공개 오픈 채팅방이 없습니다.'}</p>
                    <p>새로운 대화를 시작해보세요!</p>
                </div>
            ) : (
                <div className="room-items" ref={listRef}>
                    {(sidebarTab === 'favorite' ? favoriteRooms : sidebarTab === 'personal' ? rooms : publicRooms).map((room) => (
                        <div
                            key={room.id}
                            className={`room-item ${selectedRoomId === room.id ? 'selected' : ''}`}
                            onClick={() => handleRoomClick(room)}
                            style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #eee', cursor: 'pointer' }}
                        >
                            {/* 왼쪽: 프로필/종류 */}
                            <div className="room-item-left" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 48, minWidth: 48, marginRight: 8 }}>
                                <div className="room-icon" style={{ fontSize: 24 }}>
                                    {getRoomIcon(room.room_type, room.ai_provider)}
                                </div>
                                <div className="room-type" style={{ fontSize: 11, color: '#888', marginTop: 2, textAlign: 'center', lineHeight: 1.1 }}>
                                    {room.room_type === 'ai' ? `${room.ai_provider}` :
                                        room.room_type === 'user' ? '1:1' :
                                            room.room_type === 'group' ? '그룹' :
                                                room.room_type === 'public' ? '오픈' :
                                                    room.room_type === 'voice' ? '음성' : '채팅'}
                                </div>
                            </div>
                            {/* 중앙: 제목/최신 메시지 */}
                            <div className="room-item-center" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <div className="room-name" style={{ fontSize: 14, fontWeight: 600, color: '#222', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', borderBottom: '1px solid #f0f0f0', paddingBottom: 2 }}>
                                    {room.name}
                                    <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>
                                        💬 {room.message_count ?? 0} / 👥 {room.participant_count ?? 0}/{room.max_members ?? '-'}
                                    </span>
                                </div>
                                <div className="room-latest-message" style={{ fontSize: 12, color: '#666', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 2 }}>
                                    {/* 메시지 내용: 오른쪽 정보와 겹치지 않게 flex-grow, overflow 처리 */}
                                    <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {room.latest_message?.content ? room.latest_message.content : <span style={{ color: '#bbb' }}>메시지 없음</span>}
                                    </span>
                                    {/* 오른쪽: username/ai_name + 날짜/시간 (항상 보이도록 고정 폭, 줄바꿈) */}
                                    {room.latest_message && (
                                        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: 8, minWidth: 60, maxWidth: 110, wordBreak: 'break-all', whiteSpace: 'normal', flexShrink: 0 }}>
                                            <span style={{ fontSize: 10, color: '#888', fontWeight: 600, marginBottom: 0, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {room.latest_message.username || room.latest_message.ai_name || room.latest_message.sender || 'Unknown'}
                                            </span>
                                            <span style={{ fontSize: 9, color: '#bbb', marginTop: 0, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {room.latest_message.timestamp ? new Date(room.latest_message.timestamp).toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : ''}
                                            </span>
                                        </span>
                                    )}
                                </div>
                            </div>
                            {/* 오른쪽: 즐겨찾기, 삭제, 입장 버튼 */}
                            <div className="room-item-actions" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, marginLeft: 8 }}>
                                {/* 즐겨찾기(★) 버튼 */}
                                <button
                                    className="favorite-btn"
                                    style={{ background: 'none', border: 'none', fontSize: 18, color: '#FFD600', cursor: 'pointer', marginBottom: 2 }}
                                    title="즐겨찾기"
                                    onClick={e => handleFavoriteToggle(room, e)}
                                >
                                    {room.is_favorite ? '★' : '☆'}
                                </button>
                                {sidebarTab === 'personal' && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteRoom(room.id);
                                        }}
                                        className="delete-room-btn"
                                        title="대화방 삭제"
                                        style={{ fontSize: 14, color: '#f44336', background: 'none', border: 'none', cursor: 'pointer' }}
                                    >
                                        🗑️
                                    </button>
                                )}
                                {sidebarTab === 'open' && !rooms.find(r => r.id === room.id) && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleJoinRoom(room.id);
                                        }}
                                        className="join-room-btn"
                                        title="방 입장"
                                        style={{ fontSize: 14, color: '#2196f3', background: 'none', border: 'none', cursor: 'pointer' }}
                                    >
                                        ➕
                                    </button>
                                )}
                                <button
                                    onClick={e => {
                                        e.stopPropagation();
                                        console.log('입장하기 버튼 클릭', room);
                                        if (onClose) {
                                            onClose();
                                            console.log('오버레이 닫힘');
                                        }
                                        setTimeout(() => navigate(`/room/${room.id}`), 0);
                                    }}
                                    className="enter-room-btn"
                                    title="이 방으로 바로 입장"
                                    style={{ fontSize: 14, color: '#333', background: 'none', border: '1px solid #ddd', borderRadius: 4, padding: '2px 8px', marginTop: 2, cursor: 'pointer' }}
                                >
                                    입장
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ))}

            {/* 새 방 만들기 모달 제거 (App에서 렌더링) */}
            {/* 로그인 모달 */}
            <LoginModal
                isOpen={isLoginModalOpen}
                onClose={() => setIsLoginModalOpen(false)}
                onSocialLogin={openSocialLoginPopup}
            />
            {/* HOME 버튼: 로그인 상태에서만 표시 */}
            {loginUser && (
                <button
                    className="home-fab-btn"
                    onClick={() => {
                        if (onClose) onClose();
                        navigate('/');
                    }}
                    title="홈으로"
                >
                    🏠
                </button>
            )}
        </div>
    );
};

export default ChatRoomList; 