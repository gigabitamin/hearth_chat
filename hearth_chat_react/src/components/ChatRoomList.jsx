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

const ChatRoomList = ({ onRoomSelect, selectedRoomId, loginUser, loginLoading, checkLoginStatus, onUserMenuOpen }) => {
    const navigate = useNavigate();
    const [rooms, setRooms] = useState([]);
    const [publicRooms, setPublicRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createType, setCreateType] = useState('ai');
    const [createName, setCreateName] = useState('');
    const [createAI, setCreateAI] = useState('GEMINI');
    const [createIsPublic, setCreateIsPublic] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState(null);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [wsConnected, setWsConnected] = useState(false);
    const wsRef = useRef(null);
    const [activeTab, setActiveTab] = useState('private'); // 'private' 또는 'public'

    useEffect(() => {
        fetchRooms();
        fetchPublicRooms();
        connectWebSocket();

        return () => {
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
            // 환경에 따라 WebSocket URL 설정
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const wsUrl = isLocalhost ? 'ws://localhost:8000' : `ws://${window.location.hostname}:8000`;

            const ws = new WebSocket(`${wsUrl}/ws/chat/`);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('WebSocket 연결됨');
                setWsConnected(true);
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
                setWsConnected(false);
                // 재연결 시도
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

    const handleRoomClick = (room) => {
        onRoomSelect(room);
    };

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
            onRoomSelect(newRoom); // 생성된 방으로 입장
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
            <div className="room-list-header">
                <h3>대화방 목록</h3>
                <div>
                    {loginLoading ? null : loginUser ? (
                        <button
                            onClick={() => { onUserMenuOpen(); }}
                            className="login-btn"
                            style={buttonStyle}
                            title="내 계정"
                        >
                            <span role="img" aria-label="user" style={{ marginRight: 6 }}>👤</span>
                            {loginUser.username || '내 계정'}
                        </button>
                    ) : (
                        <button
                            onClick={handleEmailLogin}
                            className="login-btn"
                            style={buttonStyle}
                            title="로그인"
                        >
                            <span role="img" aria-label="login" style={{ marginRight: 6 }}>🔑</span>
                        </button>
                    )}
                    <button onClick={activeTab === 'private' ? fetchRooms : fetchPublicRooms} className="refresh-btn" title="새로고침">🔄</button>
                    <button onClick={() => setShowCreateModal(true)} className="create-btn">＋ 새 대화방</button>
                    <div className="ws-status" title={wsConnected ? '실시간 연결됨' : '실시간 연결 끊어짐'}>
                        {wsConnected ? '🟢' : '🔴'}
                    </div>
                </div>
            </div>

            {/* 탭 네비게이션 */}
            <div className="room-tabs">
                <button
                    className={`tab-btn ${activeTab === 'private' ? 'active' : ''}`}
                    onClick={() => setActiveTab('private')}
                >
                    💬 개인 채팅방
                </button>
                <button
                    className={`tab-btn ${activeTab === 'public' ? 'active' : ''}`}
                    onClick={() => setActiveTab('public')}
                >
                    🌐 공개 오픈 채팅방
                </button>
            </div>

            {loading ? (
                <div className="loading">대화방 목록을 불러오는 중...</div>
            ) : error ? (
                <div className="error">오류: {error}</div>
            ) : (activeTab === 'private' ? rooms.length === 0 : publicRooms.length === 0) ? (
                <div className="no-rooms">
                    <p>{activeTab === 'private' ? '참여 중인 대화방이 없습니다.' : '공개 오픈 채팅방이 없습니다.'}</p>
                    <p>새로운 대화를 시작해보세요!</p>
                </div>
            ) : (
                <div className="room-items">
                    {(activeTab === 'private' ? rooms : publicRooms).map((room) => (
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
                                {activeTab === 'private' && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteRoom(room.id);
                                        }}
                                        className="delete-room-btn"
                                        title="대화방 삭제"
                                    >
                                        🗑️
                                    </button>
                                )}
                                {activeTab === 'public' && !rooms.find(r => r.id === room.id) && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleJoinRoom(room.id);
                                        }}
                                        className="join-room-btn"
                                        title="방 입장"
                                    >
                                        ➕
                                    </button>
                                )}
                                {/* 입장하기 버튼 추가 (모든 방에 표시) */}
                                <button
                                    onClick={e => {
                                        e.stopPropagation();
                                        navigate(`/room/${room.id}`);
                                    }}
                                    className="enter-room-btn"
                                    title="이 방으로 바로 입장"
                                    style={{ marginLeft: 8 }}
                                >
                                    입장하기
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h4>새 대화방 만들기</h4>
                        <form onSubmit={handleCreateRoom}>
                            <div className="form-group">
                                <label>대화방 타입</label>
                                <select value={createType} onChange={e => setCreateType(e.target.value)}>
                                    <option value="ai">AI 채팅</option>
                                    <option value="user">1:1 채팅</option>
                                    <option value="group">그룹 채팅</option>
                                </select>
                            </div>
                            {createType === 'ai' && (
                                <div className="form-group">
                                    <label>AI 종류</label>
                                    <select value={createAI} onChange={e => setCreateAI(e.target.value)}>
                                        {AI_PROVIDERS.map(ai => (
                                            <option key={ai.value} value={ai.value}>{ai.label}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="form-group">
                                <label>대화방 이름</label>
                                <input
                                    type="text"
                                    value={createName}
                                    onChange={e => setCreateName(e.target.value)}
                                    placeholder={createType === 'ai' ? `${createAI}와의 대화` : '대화방 이름'}
                                />
                            </div>
                            <div className="form-group">
                                <label>공개 설정</label>
                                <div className="radio-group">
                                    <label>
                                        <input
                                            type="radio"
                                            name="isPublic"
                                            value="false"
                                            checked={!createIsPublic}
                                            onChange={() => setCreateIsPublic(false)}
                                        />
                                        🔒 비공개 (개인 채팅방)
                                    </label>
                                    <label>
                                        <input
                                            type="radio"
                                            name="isPublic"
                                            value="true"
                                            checked={createIsPublic}
                                            onChange={() => setCreateIsPublic(true)}
                                        />
                                        🌐 공개 (오픈 채팅방)
                                    </label>
                                </div>
                            </div>
                            {createError && <div className="error">{createError}</div>}
                            <div className="modal-actions">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="cancel-btn">취소</button>
                                <button type="submit" className="submit-btn" disabled={creating}>
                                    {creating ? '생성 중...' : '생성'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* 로그인 모달 */}
            <LoginModal
                isOpen={isLoginModalOpen}
                onClose={() => setIsLoginModalOpen(false)}
                onSocialLogin={openSocialLoginPopup}
            />
        </div>
    );
};

export default ChatRoomList; 