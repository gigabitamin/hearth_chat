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
const ChatRoomList = ({ onRoomSelect, selectedRoomId, loginUser, loginLoading, checkLoginStatus, onUserMenuOpen, activeTab, showCreateModal, setShowCreateModal, onClose, onCreateRoomSuccess, overlayKey }) => {
    let s_count = 1, ra_count = 1, rc_count = 1, lr_count = 1;

    if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
    if (listRef.current) {
        console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
        console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
        console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
    }

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
    const listRef = useRef(null); // 스크롤 위치 보존용 ref
    const scrollPositions = useRef({});
    const prevSelectedRoomId = useRef(null);

    useEffect(() => {
        if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
        if (listRef.current) {
            console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
            console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
            console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
        }
        console.log('fetchRooms called1', fetchRooms)
        fetchRooms();
        fetchPublicRooms();
        connectWebSocket();
        return () => {
            if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
            if (listRef.current) {
                console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
                console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
                console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
            }
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []);


    const openSocialLoginPopup = (url) => {
        if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
        if (listRef.current) {
            console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
            console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
            console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
        }
        const popup = window.open(url, 'social_login', 'width=500,height=600');
        const checkClosed = setInterval(() => {
            if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
            if (listRef.current) {
                console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
                console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
                console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
            }
            if (popup.closed) {
                clearInterval(checkClosed);
                checkLoginStatus();
            }
        }, 1000);
    };

    const connectWebSocket = () => {
        if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
        if (listRef.current) {
            console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
            console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
            console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
        }
        try {
            if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
            if (listRef.current) {
                console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
                console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
                console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
            }
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.hostname;
            const isLocalhost = host === 'localhost' || host === '127.0.0.1';
            const wsUrl = isLocalhost ? `${protocol}//${host}:8000/ws/chat/` : `${protocol}//${host}/ws/chat/`;

            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
                if (listRef.current) {
                    console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
                    console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
                    console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
                }
                console.log('WebSocket 연결됨');
                setWsConnected(true);
            };

            ws.onmessage = (event) => {
                if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
                if (listRef.current) {
                    console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
                    console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
                    console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
                }
                const data = JSON.parse(event.data);
                console.log('WebSocket 메시지 수신:', data);
                console.log('fetchRooms called9', fetchRooms)
                if (data.type === 'room_list_update') {
                    console.log('fetchRooms called10', fetchRooms)
                    fetchRooms();
                    console.log('fetchRooms called11', fetchRooms)
                } console.log('fetchRooms called12', fetchRooms)
            }; console.log('fetchRooms called13', fetchRooms)

            ws.onclose = () => {
                if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
                if (listRef.current) {
                    console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
                    console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
                    console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
                }
                console.log('WebSocket 연결 끊어짐');
                setWsConnected(false);
                setTimeout(() => {
                    if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
                    if (listRef.current) {
                        console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
                        console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
                        console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
                    }
                    if (wsRef.current === ws) {
                        connectWebSocket();
                    }
                }, 3000);
            };

            ws.onerror = (error) => {
                if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
                if (listRef.current) {
                    console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
                    console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
                    console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
                }
                console.error('WebSocket 오류:', error);
                setWsConnected(false);
            };
        } catch (error) {
            if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
            if (listRef.current) {
                console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
                console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
                console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
            }
            console.error('WebSocket 연결 실패:', error);
        }
    };

    const fetchRooms = async () => {
        if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
        if (listRef.current) {
            console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
            console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
            console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
        }
        console.log('fetchRooms called14', fetchRooms)
        try {
            if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
            if (listRef.current) {
                console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
                console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
                console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
            }
            console.log('fetchRooms called15', fetchRooms)
            setLoading(true);
            console.log('fetchRooms called16', fetchRooms)
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            console.log('fetchRooms called17', fetchRooms)
            const apiUrl = isLocalhost ? 'http://localhost:8000' : `http://${window.location.hostname}:8000`;
            console.log('fetchRooms called18', fetchRooms)
            const response = await fetch(`${API_BASE}/api/chat/rooms/`, {
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
            }); console.log('fetchRooms called19', fetchRooms)
            if (!response.ok) {
                throw new Error('Failed to fetch rooms');
            } console.log('fetchRooms called20', fetchRooms)
            const data = await response.json();
            console.log('fetchRooms called21', fetchRooms)
            setRooms(data.results || data);
            console.log('fetchRooms called22', fetchRooms)
        } catch (err) {
            if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
            if (listRef.current) {
                console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
                console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
                console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
            }
            setError(err.message);
            console.log('fetchRooms called23', fetchRooms)
            console.error('Error fetching rooms:', err);
        } finally {
            if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
            if (listRef.current) {
                console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
                console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
                console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
            }
            setLoading(false);
            console.log('fetchRooms called24', fetchRooms)
        } console.log('fetchRooms called25', fetchRooms)
    };

    const fetchPublicRooms = async () => {
        if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
        if (listRef.current) {
            console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
            console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
            console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
        }
        console.log('fetchRooms called26', fetchRooms)
        try {
            if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
            if (listRef.current) {
                console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
                console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
                console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
            }
            console.log('fetchRooms called27', fetchRooms)
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            console.log('fetchRooms called28', fetchRooms)
            const apiUrl = isLocalhost ? 'http://localhost:8000' : `http://${window.location.hostname}:8000`;
            console.log('fetchRooms called29', fetchRooms)
            const response = await fetch(`${API_BASE}/api/chat/rooms/public/`, {
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
            });
            console.log('fetchRooms called30', fetchRooms)
            if (!response.ok) {
                throw new Error('Failed to fetch public rooms');
            }
            const data = await response.json();
            setPublicRooms(data.results || data);
        } catch (err) {
            if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
            if (listRef.current) {
                console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
                console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
                console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
            }
            console.error('Error fetching public rooms:', err);
            console.log('fetchRooms called31', fetchRooms)
        }
    };

    const handleRoomClick = (room) => {
        if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
        if (listRef.current) {
            console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
            console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
            console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
        }
        console.log('handleRoomClick1', room)
        console.log('ChatRoomList mounted1', overlayKey)
        if (listRef.current) {
            scrollPositions.current[overlayKey || 'default'] = listRef.current.scrollTop;
            console.log('handleRoomClick2', room)
        } console.log('ChatRoomList mounted2', overlayKey)
        onRoomSelect(room);
        console.log('handleRoomClick3', room)
        prevSelectedRoomId.current = room.id; console.log('ChatRoomList mounted3', overlayKey)
        console.log('ChatRoomList mounted4', overlayKey)
        console.log('handleRoomClick4', room)
    };

    useEffect(() => {
        if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
        if (listRef.current) {
            console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
            console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
            console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
        }
        console.log('ChatRoomList mounted5', overlayKey)
        if (listRef.current && prevSelectedRoomId.current === selectedRoomId) {
            console.log('ChatRoomList mounted6', overlayKey)
            const pos = scrollPositions.current[overlayKey || 'default'] || 0;
            listRef.current.scrollTop = pos;
        } console.log('ChatRoomList mounted7', overlayKey)
    }, [selectedRoomId, overlayKey]);

    const handleCreateRoom = async (e) => {
        if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
        if (listRef.current) {
            console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
            console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
            console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
        }
        e.preventDefault();
        setCreating(true);
        setCreateError(null);
        try {
            if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
            if (listRef.current) {
                console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
                console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
                console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
            }
            const body = {
                name: createName || (createType === 'ai' ? `${createAI}와의 대화` : ''),
                room_type: createType,
                ai_provider: createType === 'ai' ? createAI : '',
                is_public: createIsPublic,
            };
            const csrftoken = getCookie('csrftoken');
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const apiUrl = isLocalhost ? 'http://localhost:8000' : `http://${window.location.hostname}:8000`;
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
            console.log('fetchRooms called32', fetchRooms)
            await fetchRooms();
            console.log('fetchRooms called33', fetchRooms)
            await fetchPublicRooms();
            console.log('fetchRooms called34', fetchRooms)
            if (onCreateRoomSuccess) {
                onCreateRoomSuccess(newRoom);
            } else {
                onRoomSelect(newRoom);
            }
        } catch (err) {
            if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
            if (listRef.current) {
                console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
                console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
                console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
            }
            setCreateError(err.message);
        } finally {
            if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
            if (listRef.current) {
                console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
                console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
                console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
            }
            setCreating(false);
        } console.log('fetchRooms called35', fetchRooms)
    };

    const handleDeleteRoom = async (roomId) => {
        if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
        if (listRef.current) {
            console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
            console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
            console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
        }
        if (!window.confirm('정말로 이 대화방을 삭제하시겠습니까?')) {
            return;
        }
        try {
            if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
            if (listRef.current) {
                console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
                console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
                console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
            }
            const csrftoken = getCookie('csrftoken');
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const apiUrl = isLocalhost ? 'http://localhost:8000' : `http://${window.location.hostname}:8000`;
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
            console.log('fetchRooms called36', fetchRooms)
            alert('대화방이 삭제되었습니다.');
        } catch (err) {
            if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
            if (listRef.current) {
                console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
                console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
                console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
            }
            console.log('fetchRooms called37', fetchRooms)
            alert(`대화방 삭제 실패: ${err.message}`);
        }
    };

    const handleJoinRoom = async (roomId) => {
        if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
        if (listRef.current) {
            console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
            console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
            console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
        }
        try {
            if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
            if (listRef.current) {
                console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
                console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
                console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
            }
            const csrftoken = getCookie('csrftoken');
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const apiUrl = isLocalhost ? 'http://localhost:8000' : `http://${window.location.hostname}:8000`;
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
            console.log('fetchRooms called38', fetchRooms)
            await fetchPublicRooms();
            console.log('fetchRooms called39', fetchRooms)
            alert('방에 입장했습니다!');
        } catch (err) {
            if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
            if (listRef.current) {
                console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
                console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
                console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
            }
            console.log('fetchRooms called40', fetchRooms)
            alert(`방 입장 실패: ${err.message}`);
        }
    };

    const getRoomIcon = (roomType, aiProvider) => {
        if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
        if (listRef.current) {
            console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
            console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
            console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
        }
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

    const handleEmailLogin = () => {
        if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
        if (listRef.current) {
            console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
            console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
            console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
        }
        setIsLoginModalOpen(true);
    };

    return (
        <div className="chat-room-list">
            {loading ? ( <div className="loading">대화방 목록을 불러오는 중...</div>
            ) : error ? ( <div className="error">오류: {error}</div>
            ) : (!loginUser ? (
                <div className="no-rooms">
                    <button className="login-btn" onClick={() => {
                        if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
                        if (listRef.current) {
                            console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
                            console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
                            console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
                        }
                        setIsLoginModalOpen(true)
                    }} style={{ fontSize: 18, padding: '12px 32px', borderRadius: 8, background: '#2196f3', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>로그인</button>
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
                            onClick={() => {
                                if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
                                if (listRef.current) {
                                    console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
                                    console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
                                    console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
                                }
                                handleRoomClick(room)
                            }}
                        >
                            <div className="room-icon">{getRoomIcon(room.room_type, room.ai_provider)}</div>
                            <div className="room-info">
                                <div className="room-name">{room.name}</div>
                                <div className="room-type">
                                    {room.room_type === 'ai' ? `${room.ai_provider} AI` : '...'}
                                    {room.is_public && ' 🌐'}
                                </div>
                            </div>
                            <div className="room-status">
                                {room.is_voice_call && '📞'}
                                {activeTab === 'personal' && (
                                    <button
                                        onClick={(e) => {
                                            if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
                                            if (listRef.current) {
                                                console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
                                                console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
                                                console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
                                            }
                                            e.stopPropagation();
                                            handleDeleteRoom(room.id);
                                        }}
                                        className="delete-room-btn" title="대화방 삭제">🗑️</button>
                                )}
                                {activeTab === 'open' && !rooms.find(r => r.id === room.id) && (
                                    <button
                                        onClick={(e) => {
                                            if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
                                            if (listRef.current) {
                                                console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
                                                console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
                                                console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
                                            }
                                            e.stopPropagation();
                                            handleJoinRoom(room.id);
                                        }}
                                        className="join-room-btn" title="방 입장">➕</button>
                                )}
                                <button
                                    onClick={e => {
                                        if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
                                        if (listRef.current) {
                                            console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
                                            console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
                                            console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
                                        }
                                        e.stopPropagation();
                                        console.log('입장하기 버튼 클릭', room);
                                        if (onClose) {
                                            onClose();
                                            console.log('오버레이 닫힘');
                                        }
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
                onClose={() => {
                    if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
                    if (listRef.current) {
                        console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
                        console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
                        console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
                    }
                    setIsLoginModalOpen(false)
                }}
                onSocialLogin={openSocialLoginPopup}
            />
            {loginUser && (
                <button
                    className="home-fab-btn"
                    onClick={() => {
                        if (!listRef.current) console.log(`listRef.current가 아직 없음${lr_count++}`, overlayKey);
                        if (listRef.current) {
                            console.log(`스크롤 위치 저장${s_count++}`, overlayKey, listRef.current.scrollTop);
                            console.log(`스크롤 위치 복원 시도${ra_count++}`, overlayKey, selectedRoomId, prevSelectedRoomId.current, scrollPositions.current[overlayKey || 'default']);
                            console.log(`스크롤 위치 복원 완료${rc_count++}`, listRef.current.scrollTop);
                        }
                        if (onClose) onClose();
                        navigate('/');
                    }}
                    title="홈으로">🏠</button>
            )}
        </div>
    );
};

export default ChatRoomList;