import React, { useState, useRef, useEffect } from 'react';
import { getApiBase, getCookie, csrfFetch } from '../utils/apiConfig';

const EMOJI_LIST = ['👍', '😂', '❤️', '😮', '😢', '👏', '🔥', '😡', '🙏', '🎉'];

const GlobalChatInput = ({ room, loginUser, ws, onOpenCreateRoomModal, onImageClick, setPendingImageFile }) => {
    // console.log('[DEBUG] GlobalChatInput 컴포넌트 렌더링됨');
    // console.log('[DEBUG] props:', { room, loginUser, ws, onOpenCreateRoomModal, onImageClick });
    // console.log('onOpenCreateRoomModal 프롭:', onOpenCreateRoomModal);
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

    // 클립보드 이벤트 리스너 추가
    useEffect(() => {
        const handlePaste = async (e) => {
            // Ctrl+V 또는 Cmd+V가 눌렸을 때만 처리
            if (!((e.ctrlKey || e.metaKey) && e.key === 'v')) {
                return;
            }

            try {
                const clipboardItems = await navigator.clipboard.read();
                for (const clipboardItem of clipboardItems) {
                    for (const type of clipboardItem.types) {
                        if (type.startsWith('image/')) {
                            const blob = await clipboardItem.getType(type);
                            const file = new File([blob], `screenshot-${Date.now()}.png`, { type });

                            // 이미지 파일 검증
                            const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
                            const maxSize = 4 * 1024 * 1024;

                            if (!allowedMime.includes(file.type)) {
                                console.log('허용되지 않는 이미지 형식입니다:', file.type);
                                return;
                            }
                            if (file.size > maxSize) {
                                alert('파일 용량은 4MB 이하만 허용됩니다.');
                                return;
                            }

                            // 이미지 첨부
                            setAttachedImage(file);
                            setAttachedImagePreview(URL.createObjectURL(file));
                            console.log('클립보드에서 이미지가 자동으로 첨부되었습니다:', file.name);
                            return;
                        }
                    }
                }
            } catch (error) {
                console.log('클립보드 접근 실패 또는 이미지가 없음:', error);
            }
        };

        // 키보드 이벤트 리스너 추가
        document.addEventListener('keydown', handlePaste);

        return () => {
            document.removeEventListener('keydown', handlePaste);
        };
    }, []);

    // textarea 높이 자동 조절 함수
    const adjustTextareaHeight = () => {
        if (inputRef.current) {
            const textarea = inputRef.current;
            // 높이를 초기화하여 정확한 스크롤 높이를 계산
            textarea.style.height = 'auto';
            // 스크롤 높이에 패딩을 고려하여 높이 설정 (최대 120px)
            const newHeight = Math.min(textarea.scrollHeight, 120);
            textarea.style.height = `${newHeight}px`;
        }
    };

    // input 값이 변경될 때마다 높이 조절
    useEffect(() => {
        adjustTextareaHeight();
    }, [input]);

    // 이미지 업로드 핸들러
    const handleImageUpload = (e) => {
        console.log('[DEBUG] handleImageUpload 호출됨');
        console.log('[DEBUG] e.target:', e.target);
        console.log('[DEBUG] e.target.files:', e.target.files);
        console.log('[DEBUG] e.target.files.length:', e.target.files ? e.target.files.length : 'undefined');

        const file = e.target.files && e.target.files[0];
        if (!file) {
            console.log('[DEBUG] 파일이 없음');
            return;
        }

        console.log('[DEBUG] 선택된 파일:', file);
        console.log('[DEBUG] 파일 이름:', file.name);
        console.log('[DEBUG] 파일 크기:', file.size);
        console.log('[DEBUG] 파일 타입:', file.type);

        const allowedExt = ['jpg', 'jpeg', 'png', 'webp'];
        const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
        const maxSize = 4 * 1024 * 1024;
        const ext = file.name.split('.').pop().toLowerCase();

        console.log('[DEBUG] 파일 확장자:', ext);
        console.log('[DEBUG] 허용된 확장자:', allowedExt);
        console.log('[DEBUG] 확장자 검사 결과:', allowedExt.includes(ext));

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

        console.log('[DEBUG] 이미지 파일 검증 통과');
        console.log('[DEBUG] 이미지 파일 설정:', file.name, file.size);

        setAttachedImage(file);
        setAttachedImagePreview(URL.createObjectURL(file));

        console.log('[DEBUG] attachedImage 상태 설정 완료');
    };

    // 첨부 이미지 해제
    const handleRemoveAttachedImage = () => {
        setAttachedImage(null);
        setAttachedImagePreview(null);
    };

    // 1. 이미지 업로드 후 전송 함수 정의 (chat_box.jsx와 동일하게)
    const handleImageUploadAndSendWithFile = async (imageFile, messageText) => {
        if (!imageFile) return;
        try {
            const formData = new FormData();
            formData.append('file', imageFile);
            formData.append('content', messageText || '이미지 첨부');
            const res = await fetch(`${getApiBase()}/api/chat/upload_image/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCookie('csrftoken'),
                },
                credentials: 'include',
                body: formData,
            });
            const data = await res.json();
            if (data.status === 'success') {
                // 방이 있으면 WebSocket 전송, 없으면 localStorage에 임시 저장
                if (room && ws && ws.readyState === 1) {
                    const messageData = {
                        message: messageText || '이미지 첨부',
                        imageUrl: data.file_url,
                        roomId: room.id
                    };
                    ws.send(JSON.stringify(messageData));
                } else {
                    // 대기방: localStorage에 임시 저장 후 방 생성
                    localStorage.setItem('pending_image_url', data.file_url);
                    localStorage.setItem('pending_auto_message', messageText || '이미지 첨부');
                }
                setInput('');
                setAttachedImage(null);
                setAttachedImagePreview(null);
            }
        } catch (error) {
            alert('이미지 업로드에 실패했습니다.');
        }
    };

    const handleSend = async () => {
        console.log('[DEBUG] handleSend 호출됨, attachedImage:', attachedImage);
        if (attachedImage) {
            console.log('[DEBUG] 이미지가 있으므로 handleImageUploadAndSend 호출');
            await handleImageUploadAndSendWithFile(attachedImage, input);
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
            // setRoomMessages 호출 제거 - WebSocket을 통해 받은 메시지가 chat_box.jsx에서 처리됨
        }
        setInput('');
        setLoading(false);
    };

    // 새로운 AI 채팅방 생성 및 이동
    // 방 생성 함수 내에서 localStorage 정리 및 강제 이동 보장
    const handleCreateNewAiRoom = async () => {
        if (!input.trim() && !attachedImage) return;
        setLoading(true);
        const now = new Date();
        const title = `${input.slice(0, 20)} - ${now.toLocaleString('ko-KR', { hour12: false })}`;
        try {
            // 1. 방을 먼저 생성
            const res = await csrfFetch(`${getApiBase()}/api/chat/rooms/`, {
                method: 'POST',
                body: JSON.stringify({ name: title, is_public: false, room_type: 'ai', ai_provider: 1, ai_response_enabled: true }),
            });
            if (res.ok) {
                const roomData = await res.json();
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
                // 2. 이미지 첨부가 있으면, 해당 roomId로 이미지 업로드 및 localStorage 저장
                if (attachedImage) {
                    try {
                        const formData = new FormData();
                        formData.append('file', attachedImage);
                        formData.append('content', input || '이미지 첨부');
                        const imgRes = await fetch(`${getApiBase()}/api/chat/upload_image/`, {
                            method: 'POST',
                            headers: {
                                'X-CSRFToken': getCookie('csrftoken'),
                            },
                            credentials: 'include',
                            body: formData,
                        });
                        const imgData = await imgRes.json();
                        if (imgData.status === 'success') {
                            localStorage.setItem('pending_auto_message', input || '이미지 첨부');
                            localStorage.setItem('pending_image_url', imgData.file_url);
                            localStorage.setItem('pending_room_id', String(roomData.id));
                        }
                    } catch {
                        alert('이미지 업로드에 실패했습니다.');
                    }
                } else {
                    // 텍스트만 있을 때도 roomId와 함께 저장
                    localStorage.setItem('pending_auto_message', input);
                    localStorage.setItem('pending_room_id', String(roomData.id));
                    localStorage.removeItem('pending_image_url');
                }
                setInput('');
                setAttachedImage(null);
                setAttachedImagePreview(null);
                setTimeout(() => {
                    window.location.href = `/room/${roomData.id}`;
                }, 300);
            } else {
                // 방 생성 실패 시 localStorage 정리 및 알림
                localStorage.removeItem('pending_auto_message');
                localStorage.removeItem('pending_image_url');
                localStorage.removeItem('pending_image_message_content');
                localStorage.removeItem('pending_room_id');
                alert('방 생성 실패');
            }
        } catch {
            // 예외 발생 시 localStorage 정리 및 알림
            localStorage.removeItem('pending_auto_message');
            localStorage.removeItem('pending_image_url');
            localStorage.removeItem('pending_image_message_content');
            localStorage.removeItem('pending_room_id');
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

    // 이모지 추가/리액션 함수 (전역 입력창에서는 임시 alert)
    const handleAddEmoji = (emoji) => {
        alert('이모지 리액션 기능은 채팅방에서만 지원됩니다.');
        // setShowEmojiMenu(false); // 이 부분은 이모지 메뉴 제거로 인해 필요 없어짐
    };
    // 답장/핀/삭제 버튼 핸들러 (전역 입력창에서는 임시 alert)
    const handleReply = () => {
        alert('답장 기능은 채팅방에서만 지원됩니다.'); // setShowEmojiMenu(false); // 이 부분은 이모지 메뉴 제거로 인해 필요 없어짐
    };
    const handlePin = () => {
        alert('고정핀 기능은 채팅방에서만 지원됩니다.'); // setShowEmojiMenu(false); // 이 부분은 이모지 메뉴 제거로 인해 필요 없어짐
    };
    const handleDelete = () => {
        alert('삭제 기능은 채팅방에서만 지원됩니다.'); // setShowEmojiMenu(false); // 이 부분은 이모지 메뉴 제거로 인해 필요 없어짐
    };

    // 이모지 메뉴 관련 상태 및 함수 제거
    // const [showEmojiMenu, setShowEmojiMenu] = useState(false);

    return (
        <div className="global-chat-input" style={{ width: '100%', background: '#23242a', padding: 8, borderTop: '1px solid #333', position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 100 }}>
            <div style={{ position: 'relative', maxWidth: 720, margin: '0 auto' }}>
                {/* 입력창 위에 딱 붙는 첨부 이미지 미리보기 (겹치지 않게) */}
                {attachedImagePreview && (
                    <div className="attached-image-preview-box" style={{
                        position: 'absolute',
                        left: 0,
                        bottom: '100%',
                        background: '#23242a',
                        borderRadius: 8,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                        padding: 4,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginBottom: 4,
                        maxWidth: 320,
                        zIndex: 200
                    }}>
                        <img src={attachedImagePreview} alt="첨부 이미지 미리보기" className="attached-image-thumb" style={{ maxHeight: 240, borderRadius: 6 }} />
                        <button onClick={handleRemoveAttachedImage} className="attached-image-remove-btn" style={{ marginLeft: 6, color: '#fff', background: '#f44336', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>✖</button>
                    </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                    {/* 새로운 AI 채팅방 생성 버튼 (입력창 왼쪽) */}
                    <button
                        onMouseDown={handlePressStart}
                        onMouseUp={handlePressEnd}
                        onMouseLeave={handleCancel}
                        onTouchStart={handlePressStart}
                        onTouchEnd={handlePressEnd}
                        onTouchCancel={handleCancel}
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
                                e.stopPropagation(); // 엔터키 전송 방지
                                // e.preventDefault(); // 엔터키 전송, 줄바꿈 방지
                                // handleSend(); // 엔터키 전송
                            }
                        }}
                        rows={1}
                        style={{
                            flex: 1,
                            borderRadius: 8,
                            border: '1px solid #444',
                            padding: 6,
                            fontSize: 15,
                            background: '#181a20',
                            color: '#fff',
                            resize: 'none',
                            minHeight: '10px',
                            maxHeight: '120px',
                            overflowY: 'auto'
                        }}
                        disabled={loading}
                    />
                    {/* 이모지(+) 버튼 및 메뉴 */}
                    {/* 이모지 메뉴 제거로 인해 이 부분은 필요 없어짐 */}
                    <button
                        type="button"
                        className="image-upload-btn-side"
                        onClick={() => {
                            const fileInput = document.getElementById('global-chat-image-upload');
                            if (fileInput) fileInput.click();
                        }}
                        style={{ cursor: 'pointer', background: 'transparent', border: 'none', padding: 0 }}
                    >
                        <input
                            id="global-chat-image-upload"
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handleImageUpload}
                        />
                        <span className="image-upload-btn-icon">📤</span>
                    </button>
                    <button
                        onClick={() => {
                            if (!room) {
                                handleCreateNewAiRoom();
                            } else if (attachedImage) {
                                const currentInput = input;
                                handleImageUploadAndSendWithFile(attachedImage, currentInput);
                            } else {
                                handleSend();
                            }
                        }}
                        disabled={!input.trim() && !attachedImage}
                        style={{ background: '#ff6a00', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 18, cursor: 'pointer', minWidth: 48 }}
                    >
                        {!room ? '개설' : (attachedImage ? '📤' : '전송')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GlobalChatInput; 