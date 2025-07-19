import React, { useState, useRef } from 'react';

const getApiBase = () => {
    const hostname = window.location.hostname;
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) return 'https://hearthchat-production.up.railway.app';
    if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:8000';
    if (hostname === '192.168.44.9') return 'http://192.168.44.9:8000';
    return `http://${hostname}:8000`;
};

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

const GlobalChatInput = ({ room, loginUser, ws, setRoomMessages }) => {
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const inputRef = useRef();

    const handleSend = async () => {
        if (!input.trim()) return;
        setLoading(true);
        if (!room) {
            // 대기방: 방 자동 생성 후 이동
            const now = new Date();
            const title = `${input.slice(0, 20)} - ${now.toLocaleString('ko-KR', { hour12: false })}`;
            try {
                // 입력 메시지를 localStorage에 임시 저장
                localStorage.setItem('pending_auto_message', input);
                const res = await csrfFetch(`${getApiBase()}/api/chat/rooms/`, {
                    method: 'POST',
                    body: JSON.stringify({ name: title, is_public: false, room_type: 'ai', ai_provider: 1, ai_response_enabled: true }),
                });
                if (res.ok) {
                    const data = await res.json();
                    // 방 생성 후 user settings도 자동 ON
                    try {
                        await fetch(`${getApiBase()}/api/chat/user/settings/`, {
                            method: 'PATCH',
                            credentials: 'include',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRFToken': getCookie('csrftoken'),
                            },
                            body: JSON.stringify({ ai_response_enabled: true }),
                        });
                    } catch (e) { /* 무시 */ }
                    setTimeout(() => {
                        window.location.href = `/room/${data.id}`;
                    }, 300);
                } else {
                    alert('방 생성 실패');
                }
            } catch {
                alert('방 생성 오류');
            }
        } else {
            // 채팅방: chat_box.jsx와 동일하게 WebSocket 전송 및 pending 메시지 추가
            if (!ws || ws.readyState !== 1) {
                alert('연결이 끊어졌습니다.');
                setLoading(false);
                return;
            }
            const clientId = `${Date.now()}_${Math.random()}`;
            const messageData = {
                message: input,
                roomId: room.id,
                client_id: clientId,
            };
            ws.send(JSON.stringify(messageData));
            if (setRoomMessages) {
                setRoomMessages(prev => [
                    ...prev,
                    {
                        id: clientId,
                        type: 'send',
                        text: input,
                        date: new Date().toISOString(),
                        sender: loginUser?.username,
                        user_id: loginUser?.id,
                        pending: true,
                        client_id: clientId,
                    }
                ]);
            }
        }
        setInput('');
        setLoading(false);
    };

    return (
        <div className="global-chat-input" style={{ width: '100%', background: '#23242a', padding: 8, borderTop: '1px solid #333', position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 100 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 700, margin: '0 auto' }}>
                <textarea
                    ref={inputRef}
                    placeholder={room ? '메시지를 입력하세요' : '메시지를 입력하면 새 대화방이 생성됩니다'}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    rows={1}
                    style={{ flex: 1, borderRadius: 8, border: '1px solid #444', padding: 10, fontSize: 16, background: '#181a20', color: '#fff', resize: 'none' }}
                    disabled={loading}
                />
                <button
                    onClick={handleSend}
                    disabled={loading || !input.trim()}
                    style={{ background: '#ff6a00', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 18, cursor: 'pointer', minWidth: 48 }}
                >
                    {room ? '전송' : '개설'}
                </button>
            </div>
        </div>
    );
};

export default GlobalChatInput; 