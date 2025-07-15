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

const ChatRoomList = ({ onRoomSelect, selectedRoomId, loginUser, loginLoading, checkLoginStatus, onUserMenuOpen, activeTab, showCreateModal, setShowCreateModal, onClose, onCreateRoomSuccess, overlayKey, scrollPositions, setScrollPosition, currentScrollPosition }) => {
    const navigate = useNavigate();
    const [rooms, setRooms] = useState([]);
    const [publicRooms, setPublicRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [createType, setCreateType] = useState('ai');
    const [createName, setCreateName] = useState('');
    const [createAI, setCreateAI] = useState('GEMINI');
    const [createIsPublic, setCreateIsPublic] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState(null);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [wsConnected, setWsConnected] = useState(false);
    const wsRef = useRef(null);
    const listRef = useRef(null);

    // [A] 컴포넌트 마운트/언마운트 시점 확인
    useEffect(() => {
        console.log(`%c[LIFECYCLE] ChatRoomList MOUNTED - Key: ${overlayKey}`, 'color: green; font-weight: bold;');

        fetchRooms();
        fetchPublicRooms();
        connectWebSocket();
        return () => {
            console.log(`%c[LIFECYCLE] ChatRoomList UNMOUNTING - Key: ${overlayKey}`, 'color: red; font-weight: bold;');
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []);

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
                setWsConnected(true);
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'room_list_update') {
                    fetchRooms();
                }
            };

            ws.onclose = () => {
                console.log('WebSocket 연결 끊어짐');
                setWsConnected(false);
                setTimeout(() => {
                    if (wsRef.current === ws) {
                        connectWebSocket();
                    }
                }, 3000);
            };

            ws.onerror = (error) => {
                console.error('WebSocket 오류:', error);
                setWsConnected(false);
            };
        } catch (error) {
            console.error('WebSocket 연결 실패:', error);
        }
    };

    const fetchRooms = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE}/api/chat/rooms/`, {
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
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
            const response = await fetch(`${API_BASE}/api/chat/rooms/public/`, {
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
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

    // [C] handleRoomClick 진입 시점 확인
    const handleRoomClick = (room) => {
        console.log(`%c[EVENT] handleRoomClick triggered - Room: ${room.name}, Key: ${overlayKey}`, 'color: blue; font-weight: bold;');
        if (listRef.current && setScrollPosition) {
            const currentPosition = listRef.current.scrollTop;
            console.log(`[EVENT] Saving scroll position: ${currentPosition}`);
            setScrollPosition(overlayKey || 'default', currentPosition);
        }
        onRoomSelect(room);
    };

    // [B] 스크롤 복원 useEffect 진입 및 [D] listRef.current 상태 확인
    useEffect(() => {
        console.log(`%c[EFFECT] Scroll restore EFFECT triggered - Key: ${overlayKey}, Pos: ${currentScrollPosition}`, 'color: orange; font-weight: bold;');
        console.log('[EFFECT] Checking listRef.current:', listRef.current);

        if (listRef.current) {
            listRef.current.scrollTop = currentScrollPosition || 0;
            console.log(`[EFFECT] Scroll position restored to: ${listRef.current.scrollTop}`);
        } else {
            console.log('[EFFECT] listRef.current is null, cannot restore scroll.');
        }
    }, [selectedRoomId, overlayKey, currentScrollPosition]);


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
            const response = await fetch(`${API_BASE}/api/chat/rooms/`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
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
                onRoomSelect(newRoom);
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
            const response = await fetch(`${API_BASE}/api/chat/rooms/${roomId}/`, {
                method: 'DELETE',
                credentials: 'include',
                headers: { 'X-CSRFToken': csrftoken },
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
            const response = await fetch(`${API_BASE}/api/chat/rooms/${roomId}/join/`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'X-CSRFToken': csrftoken },
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
        // ... (내용 동일)
        switch (roomType) {
            case 'ai':
                switch (aiProvider) {
                    case 'GEMINI': return '🤖';
                    case 'CHATGPT': return '🧠';
                    case 'CLUDE': return '💡';
                    default: return '🤖';
                }
            case 'user': return '👤';
            case 'group': return '👥';
            case 'voice': return '📞';
            default: return '💬';
        }
    };

    return (
        <div className="chat-room-list">
            {loading ? (
                <div className="loading">대화방 목록을 불러오는 중...</div>
            ) : error ? (
                <div className="error">오류: {error}</div>
            ) : (!loginUser ? (
                <div className="no-rooms">
                    <button className="login-btn" onClick={() => setIsLoginModalOpen(true)} style={{ fontSize: 18, padding: '12px 32px', borderRadius: 8, background: '#2196f3', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>로그인</button>
                </div>
            ) : (activeTab === 'personal' ? rooms.length === 0 : publicRooms.length === 0) ? (
                <div className="no-rooms">
                    <p>{activeTab === 'personal' ? '참여 중인 대화방이 없습니다.' : '공개 오픈 채팅방이 없습니다.'}</p>
                    <p>새로운 대화를 시작해보세요!</p>
                </div>
            ) : (
                <div className="room-items" ref={listRef}>
                    {(activeTab === 'personal' ? rooms : publicRooms).map((room) => (
                        <div
                            key={room.id}
                            className={`room-item ${selectedRoomId === room.id ? 'selected' : ''}`}
                            onClick={() => handleRoomClick(room)}
                        >
                            <div className="room-icon">
                                {getRoomIcon(room.room_type, room.ai_provider)}
                            </div>
                            <div className="room-info">
                                <div className="room-name">{room.name}</div>
                                <div className="room-type">
                                    {room.room_type === 'ai' ? `${room.ai_provider} AI` :
                                        room.room_type === 'user' ? '1:1 채팅' :
                                            room.room_type === 'group' ? '그룹 채팅' :
                                                room.room_type === 'public' ? '공개 오픈 채팅' :
                                                    room.room_type === 'voice' ? '음성 통화' : '채팅'}
                                    {room.is_public && ' 🌐'}
                                </div>
                            </div>
                            <div className="room-status">
                                {room.is_voice_call && '📞'}
                                {activeTab === 'personal' && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteRoom(room.id); }}
                                        className="delete-room-btn" title="대화방 삭제">🗑️</button>
                                )}
                                {activeTab === 'open' && !rooms.find(r => r.id === room.id) && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleJoinRoom(room.id); }}
                                        className="join-room-btn" title="방 입장">➕</button>
                                )}
                                <button
                                    onClick={e => {
                                        e.stopPropagation();
                                        if (onClose) { onClose(); }
                                        setTimeout(() => navigate(`/room/${room.id}`), 0);
                                    }}
                                    className="enter-room-btn" title="이 방으로 바로 입장" style={{ marginLeft: 8 }}>입장하기</button>
                            </div>
                        </div>
                    ))}
                </div>
            ))}

            <LoginModal
                isOpen={isLoginModalOpen}
                onClose={() => setIsLoginModalOpen(false)}
                onSocialLogin={openSocialLoginPopup}
            />
            {loginUser && (
                <button
                    className="home-fab-btn"
                    onClick={() => {
                        if (onClose) onClose();
                        navigate('/');
                    }}
                    title="홈으로">🏠</button>
            )}
        </div>
    );
};

export default ChatRoomList;