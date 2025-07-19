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

const GlobalChatInput = ({ room, loginUser, ws, setRoomMessages, onOpenCreateRoomModal }) => {
    console.log('onOpenCreateRoomModal 프롭:', onOpenCreateRoomModal);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const inputRef = useRef();
    const [attachedImage, setAttachedImage] = useState(null);
    const [attachedImagePreview, setAttachedImagePreview] = useState(null);
    const [longPressTimer, setLongPressTimer] = useState(null);

    // --- [수정 1] long-press 발생 여부를 추적할 ref 추가 ---
    const longPressTriggered = useRef(false);
    // --- [수정 2] 타이머와 long-press 상태를 관리할 useRef 선언 ---
    const pressTimer = useRef(null);
    const isLongPress = useRef(false);

    // 이미지 업로드 핸들러
    const handleImageUpload = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const allowedExt = ['jpg', 'jpeg', 'png', 'webp'];
        const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
        const maxSize = 4 * 1024 * 1024;
        const ext = file.name.split('.').pop().toLowerCase();
        if (!allowedExt.includes(ext)) {
            alert('허용되지 않는 확장자입니다: ' + ext);
            return;
        }
        if (file.size > maxSize) {
            alert('파일 용량은 4MB 이하만 허용됩니다.');
            return;
        }
        if (!allowedMime.includes(file.type)) {
            alert('허용되지 않는 이미지 형식입니다: ' + file.type);
            return;
        }
        setAttachedImage(file);
        setAttachedImagePreview(URL.createObjectURL(file));
    };

    // 첨부 이미지 해제
    const handleRemoveAttachedImage = () => {
        setAttachedImage(null);
        setAttachedImagePreview(null);
    };

    // 이미지 업로드 후 전송
    const handleImageUploadAndSend = async () => {
        if (!attachedImage || !ws || ws.readyState !== 1) return;
        setInput('');
        setAttachedImage(null);
        setAttachedImagePreview(null);
        try {
            const formData = new FormData();
            formData.append('file', attachedImage);
            formData.append('content', input || '이미지 첨부');
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const apiUrl = isLocalhost
                ? 'http://localhost:8000'
                : `${window.location.protocol}//${window.location.hostname}`;
            const res = await fetch(`${apiUrl}/api/chat/upload_image/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCookie('csrftoken'),
                },
                credentials: 'include',
                body: formData,
            });
            const data = await res.json();
            if (data.status === 'success') {
                const messageData = {
                    message: input || '이미지 첨부',
                    imageUrl: data.file_url,
                    roomId: room?.id || null
                };
                ws.send(JSON.stringify(messageData));
                if (setRoomMessages) {
                    setRoomMessages(prev => [
                        ...prev,
                        {
                            type: 'send',
                            text: input || '이미지 첨부',
                            imageUrl: data.file_url,
                            date: new Date().toISOString()
                        }
                    ]);
                }
            }
        } catch (error) {
            alert('이미지 업로드에 실패했습니다.');
        }
    };

    const handleSend = async () => {
        if (attachedImage) {
            await handleImageUploadAndSend();
            return;
        }
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

    // 새로운 AI 채팅방 생성 및 이동
    const handleCreateNewAiRoom = async () => {
        if (!input.trim()) return;
        setLoading(true);
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
        setLoading(false);
    };

    // 모바일 long-press 핸들러
    const handleTouchStart = () => {
        // --- [수정 2] 타이머 시작 전, 플래그 초기화 ---
        longPressTriggered.current = false; 
        const timer = setTimeout(() => {            
            if (onOpenCreateRoomModal) onOpenCreateRoomModal();
            // --- [수정 3] long-press가 성공했음을 기록 ---
            longPressTriggered.current = true;             
        }, 600);
        setLongPressTimer(timer);
    };

    const handleTouchEnd = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            setLongPressTimer(null);
        }
    };

    // PC용 long-press 핸들러
    const handleMouseDown = (e) => {
        if (e.button !== 0) return;
        // --- [수정 2] 타이머 시작 전, 플래그 초기화 ---
        longPressTriggered.current = false;
        const timer = setTimeout(() => {            
            if (onOpenCreateRoomModal) onOpenCreateRoomModal();
            // --- [수정 3] long-press가 성공했음을 기록 ---
            longPressTriggered.current = true;            
        }, 600);
        setLongPressTimer(timer);
    };

    const handleMouseUp = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            setLongPressTimer(null);
        }
    };

    // --- [수정 4] 클릭 이벤트를 분기 처리할 새로운 핸들러 ---
    const handleClick = () => {
        // long-press가 실행되었다면, 짧은 클릭 로직(방 생성)을 실행하지 않음
        if (longPressTriggered.current) {
            // 플래그를 다시 초기화하고 함수를 종료
            longPressTriggered.current = false;
            return;
        }
        // long-press가 아니었다면, 기존의 짧은 클릭 로직 실행
        handleCreateNewAiRoom();
    };

    // --- [수정 2] 새로운 이벤트 핸들러 로직 ---

    // 버튼을 누르기 시작할 때 호출될 함수
    const handlePressStart = () => {
        // 이전 타이머가 남아있을 경우를 대비해 초기화
        if (pressTimer.current) {
            clearTimeout(pressTimer.current);
        }
        isLongPress.current = false; // long-press 상태 초기화

        pressTimer.current = setTimeout(() => {
            console.log('Long Press 타이머 실행! 모달을 엽니다.');
            isLongPress.current = true; // 600ms가 지나면 long-press로 처리
            if (onOpenCreateRoomModal) onOpenCreateRoomModal(); // 모달 열기
            // alert('길게 누르기 성공!');
        }, 600);
    };

    // 버튼에서 손을 뗄 때 호출될 함수 (성공적인 클릭)
    const handlePressEnd = () => {
        // 진행 중이던 타이머를 즉시 중단
        if (pressTimer.current) {
            clearTimeout(pressTimer.current);
        }

        // isLongPress 플래그가 false일 때만 짧은 클릭으로 간주
        if (!isLongPress.current) {
            handleCreateNewAiRoom(); // 짧은 클릭 동작 실행
        }
        // isLongPress가 true이면 아무것도 하지 않고 종료 (long-press가 이미 실행됨)
    };
    
    // 버튼 누른 상태로 벗어나거나 취소될 때 호출될 함수
    const handleCancel = () => {
        if (pressTimer.current) {
            clearTimeout(pressTimer.current);
        }
        // 사용자가 의도적으로 취소한 것이므로 아무 동작도 하지 않음
    };



    return (
        <div className="global-chat-input" style={{ width: '100%', background: '#23242a', padding: 8, borderTop: '1px solid #333', position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 100 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 700, margin: '0 auto' }}>
                {/* 새로운 AI 채팅방 생성 버튼 (입력창 왼쪽) */}
                {/* --- [수정 3] 버튼에 새로운 핸들러 연결 및 onClick 제거 --- */}
                <button
                    onMouseDown={handlePressStart}
                    onMouseUp={handlePressEnd}
                    onMouseLeave={handleCancel}
                    onTouchStart={handlePressStart}
                    onTouchEnd={handlePressEnd}
                    onTouchCancel={handleCancel}
                    // disabled={loading || !input.trim()}
                    disabled={loading}
                    style={{ background: '#ff6a00', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 18, cursor: 'pointer', minWidth: 48 }}
                    title="짧게 클릭: 새 AI 채팅방 자동 생성 / 길게 누르기: 옵션"
                >
                    🔥
                </button>
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
                <label htmlFor="global-chat-image-upload" className="image-upload-btn-side">
                    <input
                        id="global-chat-image-upload"
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleImageUpload}
                    />
                    <span className="image-upload-btn-icon">📤</span>
                </label>
                <button
                    onClick={handleSend}
                    disabled={loading || (!input.trim() && !attachedImage)}
                    style={{ background: '#ff6a00', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 18, cursor: 'pointer', minWidth: 48 }}
                >
                    {attachedImage ? '📤' : (room ? '전송' : '개설')}
                </button>
            </div>
            {attachedImagePreview && (
                <div className="attached-image-preview-box" style={{ marginTop: 8 }}>
                    <img src={attachedImagePreview} alt="첨부 이미지 미리보기" className="attached-image-thumb" style={{ maxHeight: 80, borderRadius: 8 }} />
                    <button onClick={handleRemoveAttachedImage} className="attached-image-remove-btn" style={{ marginLeft: 8, color: '#fff', background: '#f44336', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>✖</button>
                </div>
            )}
        </div>
    );
};

export default GlobalChatInput; 