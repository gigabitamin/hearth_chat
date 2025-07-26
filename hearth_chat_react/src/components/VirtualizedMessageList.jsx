import React, { useState, useEffect, useRef, useCallback } from 'react';
import './VirtualizedMessageList.css';

// CSRF 토큰 쿠키 가져오기
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

// csrfFetch 함수
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

// 환경에 따라 API_BASE 자동 설정 함수
const getApiBase = () => {
    const hostname = window.location.hostname;
    const isProd = process.env.NODE_ENV === 'production';

    if (isProd) return 'https://hearthchat-production.up.railway.app';
    if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:8000';
    if (hostname === '192.168.44.9') return 'http://192.168.44.9:8000';

    return `http://${hostname}:8000`;
};

// 이미지 URL을 절대 경로로 변환하는 함수
const getImageUrl = (imageUrl) => {
    if (!imageUrl) return null;

    // 이미 절대 URL인 경우 그대로 반환
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return imageUrl;
    }

    // 상대 경로인 경우 Django 서버 주소를 앞에 붙임
    if (imageUrl.startsWith('/media/')) {
        return `${getApiBase()}${imageUrl}`;
    }

    // 기타 경우는 그대로 반환
    return imageUrl;
};

const EMOJI_LIST = ['👍', '😂', '❤️', '😮', '😢', '👏', '🔥', '😡', '🙏', '🎉'];

const VirtualizedMessageList = ({
    messages = [],
    onLoadMore,
    hasMore = false,
    loginUser,
    highlightMessageId,
    onMessageClick,
    getSenderColor,
    onReply, // 답장 콜백
    onReplyQuoteClick, // 인용 클릭 콜백
    onImageClick, // 이미지 클릭 콜백(모달)
    selectedRoomId, // 방이 바뀔 때마다 최신 위치로 이동
    favoriteMessages = [],
    onToggleFavorite = () => { },
    onMessageDelete, // 메시지 삭제 콜백    
    scrollToMessageId, // [입장] 버튼 클릭 시 전달받는 메시지 id
    loadingMessages = false, // 메시지 로딩 상태
}) => {
    // 상태 선언은 최상단에 모두 위치시킴 (ReferenceError 방지)
    const scrollRef = useRef(null);
    const [showNewMsgAlert, setShowNewMsgAlert] = useState(false);
    const [atBottom, setAtBottom] = useState(true);
    // prepend 후 스크롤 위치 보정
    const prevMessagesLength = useRef(messages.length);
    const prevScrollTop = useRef(0);
    const isPrepending = useRef(false);
    const [emojiPickerMsgId, setEmojiPickerMsgId] = useState(null);
    const [localReactions, setLocalReactions] = useState({}); // {messageId: [reactions]}
    const [pinnedIds, setPinnedIds] = useState([]);
    const [tempHighlightedId, setTempHighlightedId] = useState(null);

    // deleteMessage 함수도 반드시 위에서 선언
    const deleteMessage = async (messageId) => {
        try {
            const res = await fetch(`/api/chat/messages/${messageId}/delete/`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            });
            if (res.ok) {
                if (onMessageDelete) {
                    onMessageDelete(messageId);
                }
            } else {
                const data = await res.json();
                alert(data.error || '메시지 삭제에 실패했습니다.');
            }
        } catch (e) {
            alert('메시지 삭제 중 오류가 발생했습니다.');
        }
    };

    // 1. [입장] 등 특정 메시지로 이동
    useEffect(() => {
        if (scrollToMessageId && messages.length > 0) {
            const messageElement = document.getElementById(`message-${scrollToMessageId}`);
            if (messageElement && scrollRef.current) {
                messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [scrollToMessageId, messages]);

    // 2. highlightMessageId로 스크롤 및 임시 강조
    useEffect(() => {
        if (highlightMessageId && messages.length > 0) {
            setTempHighlightedId(highlightMessageId);
            const messageElement = document.getElementById(`message-${highlightMessageId}`);
            if (messageElement && scrollRef.current) {
                messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            const timeout = setTimeout(() => setTempHighlightedId(null), 1000);
            return () => clearTimeout(timeout);
        }
    }, [highlightMessageId, messages]);

    // 초기 로딩 시 스크롤을 최하단으로 이동
    useEffect(() => {
        if (messages.length > 0 && scrollRef.current && !isPrepending.current) {
            // 초기 로딩이거나 새 메시지가 추가된 경우 최하단으로 스크롤
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages.length]);

    // 스크롤 위치 보정을 위한 useEffect
    useEffect(() => {
        if (messages.length > prevMessagesLength.current) {
            // prepend가 일어났을 때 (메시지가 앞에 추가됨)
            const addedCount = messages.length - prevMessagesLength.current;

            if (addedCount > 0 && scrollRef.current && isPrepending.current) {
                // DOM 업데이트 후 스크롤 위치 조정
                requestAnimationFrame(() => {
                    if (scrollRef.current) {
                        // 새로 추가된 메시지들의 실제 높이를 계산
                        const scrollContainer = scrollRef.current;
                        const messageElements = scrollContainer.querySelectorAll('[id^="message-"]');

                        if (messageElements.length >= addedCount) {
                            // 새로 추가된 메시지들의 총 높이 계산
                            let newMessagesHeight = 0;
                            for (let i = 0; i < addedCount; i++) {
                                if (messageElements[i]) {
                                    newMessagesHeight += messageElements[i].offsetHeight;
                                }
                            }

                            // 이전 스크롤 위치 + 새 메시지들의 높이로 조정
                            scrollContainer.scrollTop = prevScrollTop.current + newMessagesHeight;
                        }
                    }
                    isPrepending.current = false;
                });
            }
        }
        prevMessagesLength.current = messages.length;
    }, [messages]);

    // 3. 새 메시지 도착 시 자동 최신 스크롤/알림
    useEffect(() => {
        if (messages.length > prevMessagesLength.current) {
            if (atBottom && scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            } else {
                setShowNewMsgAlert(true);
            }
        }
    }, [messages, atBottom]);

    // 4. 새 메시지 알림 클릭 시 최신으로 이동
    const handleNewMsgAlertClick = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
        setShowNewMsgAlert(false);
    };

    // 5. 무한 스크롤: 맨 위 도달 시 onLoadMore 호출 (일반 스크롤 이벤트)
    const handleScroll = useCallback(() => {
        if (!scrollRef.current || loadingMessages || !hasMore) return;

        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;

        // 맨 위에 가까우면 (50px 이내) 추가 로딩
        if (scrollTop < 50) {
            console.log('맨 위 도달, hasMore:', hasMore, 'messages.length:', messages.length);
            if (hasMore && onLoadMore) {
                // prepend 전 현재 스크롤 위치 저장
                prevScrollTop.current = scrollTop;
                isPrepending.current = true;
                onLoadMore();
            }
        }

        // 하단 여부 체크
        const isBottom = scrollTop + clientHeight >= scrollHeight - 10;
        setAtBottom(isBottom);
        if (isBottom) setShowNewMsgAlert(false);
    }, [hasMore, onLoadMore, loadingMessages, messages.length]);

    // 스크롤 이벤트 리스너 등록
    useEffect(() => {
        const scrollElement = scrollRef.current;
        if (scrollElement) {
            scrollElement.addEventListener('scroll', handleScroll);
            return () => scrollElement.removeEventListener('scroll', handleScroll);
        }
    }, [handleScroll]);

    // 7. 메시지 렌더링 함수
    const renderMessage = useCallback((msg, index) => {
        if (!msg) {
            return (
                <div key={`loading-${index}`} className="message-loading">
                    <div className="loading-skeleton">
                        <div className="skeleton-avatar"></div>
                        <div className="skeleton-content">
                            <div className="skeleton-line"></div>
                            <div className="skeleton-line short"></div>
                        </div>
                    </div>
                </div>
            );
        }

        const isMyMessage = msg.type === 'send' ||
            (loginUser && (msg.username === loginUser.username || msg.user_id === loginUser.id));
        const reactions = localReactions[msg.id] || [];
        const user = loginUser?.username;

        return (
            <div
                key={msg.id}
                className={`message-item ${isMyMessage ? 'my-message' : 'other-message'} ${tempHighlightedId === msg.id ? 'temp-highlight' : ''}`}
                id={`message-${msg.id}`}
            >
                <div className="message-content">
                    {/* 메시지 헤더: 위쪽에 username(흰색, 굵게) + 답장/핀/즐겨찾기 버튼 */}
                    <div className="message-header"
                        style={{
                            display: 'flex',
                        }}
                    >
                        <span style={{ color: '#fff', fontWeight: 700, fontSize: 13, marginRight: 8 }}>
                            {msg.sender || msg.username || 'Unknown'}
                        </span>
                        {/* 핀(고정) 버튼 */}
                        <button
                            className={`pin-btn${pinnedIds.includes(msg.id) ? ' pinned' : ''}`}
                            onClick={e => { e.stopPropagation(); togglePin(msg.id); }}
                            title={pinnedIds.includes(msg.id) ? '핀 해제' : '상단 고정'}
                        >📌</button>
                        {/* 즐겨찾기(▽/▼) 버튼 */}
                        <button
                            className="favorite-btn"
                            style={{ marginLeft: 8, fontSize: 18, color: favoriteMessages.includes(msg.id) ? '#1976d2' : '#bbb', background: 'none', border: 'none', cursor: 'pointer' }}
                            title={favoriteMessages.includes(msg.id) ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                            onClick={e => { e.stopPropagation(); onToggleFavorite(msg); }}
                        >
                            {favoriteMessages.includes(msg.id) ? '▼' : '▽'}
                        </button>
                    </div>
                    {/* 답장 인용 표시 */}
                    {msg.reply && (
                        <div
                            className="reply-quote"
                            style={{
                                background: 'rgba(33,150,243,0.08)',
                                borderLeft: '3px solid #2196f3',
                                padding: '4px 8px',
                                marginBottom: 4,
                                fontSize: 13,
                                color: '#2196f3',
                                borderRadius: 4,
                                maxWidth: '90%',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                cursor: onReplyQuoteClick ? 'pointer' : 'default',
                                transition: 'background 0.15s, box-shadow 0.15s',
                            }}
                            title="원본 메시지로 이동"
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(33,150,243,0.18)'; e.currentTarget.style.boxShadow = '0 0 8px #2196f3'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(33,150,243,0.08)'; e.currentTarget.style.boxShadow = 'none'; }}
                            onClick={e => { e.stopPropagation(); onReplyQuoteClick && onReplyQuoteClick(msg.reply.id); }}
                        >
                            <span style={{ fontWeight: 600, marginRight: 4, fontSize: 12 }}>↩️ {msg.reply.sender || '익명'}</span>
                            <span style={{ fontStyle: 'italic', color: '#1976d2' }}>
                                {msg.reply.text ? (msg.reply.text.split('\n')[0].slice(0, 40) + (msg.reply.text.length > 40 ? '...' : '')) : '[첨부/삭제됨]'}
                            </span>
                        </div>
                    )}
                    <div className="message-bubble-row" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        {/* 메시지 버블 */}
                        <div className="message-bubble"
                            style={{
                                backgroundColor: isMyMessage ? undefined : getSenderColor(msg.sender),
                                color: isMyMessage ? undefined : (getSenderColor(msg.sender) ? '#fff' : undefined),
                                position: 'relative',
                                width: '100%',
                                maxWidth: '100%',
                            }}>
                            {/* AI 메시지일 때만 질문자 username을 왼쪽 상단에 표시 */}
                            <div className="message-questioner-username">
                                {(msg.questioner_username && (msg.type === 'ai' || msg.sender_type === 'ai')) && (
                                    <>
                                        To.
                                        <span className="questioner-username-highlight">{msg.questioner_username}</span>{' '}
                                        {new Date(msg.date || msg.timestamp).toLocaleString('ko-KR', {
                                            year: '2-digit', month: '2-digit', day: '2-digit',
                                            hour: '2-digit', minute: '2-digit', hour12: false
                                        })}
                                    </>
                                )}
                            </div>
                            {msg.imageUrl && (
                                <img
                                    src={getImageUrl(msg.imageUrl)}
                                    alt="첨부 이미지"
                                    className="message-image"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onImageClick) onImageClick(getImageUrl(msg.imageUrl));
                                    }}
                                />
                            )}
                            <div className="message-text">{msg.text || msg.content}</div>
                        </div>
                    </div>
                    {/* 아래쪽에 날짜/시간(회색, 24시간) */}
                    <div style={{ color: '#bbb', fontSize: 11, marginTop: 2, textAlign: 'left' }}>
                        {new Date(msg.date || msg.timestamp).toLocaleString('ko-KR', {
                            year: '2-digit', month: '2-digit', day: '2-digit',
                            hour: '2-digit', minute: '2-digit', hour12: false
                        })}
                    </div>
                    {/* 리액션 UI */}
                    <div className="message-reactions-row" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        {reactions.length > 0 && (
                            <div className="message-reactions">
                                {reactions.map((reaction, i) => (
                                    <span
                                        key={i}
                                        className={`reaction-emoji${reaction.users && reaction.users.includes(user) ? ' my-reaction' : ''}`}
                                        onClick={() => toggleReaction(msg.id, reaction.emoji)}
                                        style={{
                                            cursor: 'pointer',
                                            fontWeight: reaction.users && reaction.users.includes(user) ? 700 : 400,
                                            border: reaction.users && reaction.users.includes(user) ? '2px solid #2196f3' : '1px solid #ccc',
                                            borderRadius: 8,
                                            padding: '2px 6px',
                                            background: reaction.users && reaction.users.includes(user) ? 'rgba(33,150,243,0.08)' : '#222',
                                            color: reaction.users && reaction.users.includes(user) ? '#2196f3' : '#fff',
                                            boxShadow: reaction.users && reaction.users.includes(user) ? '0 0 4px #2196f3' : 'none',
                                            transition: 'all 0.15s',
                                            marginRight: 2
                                        }}
                                        title={reaction.users && reaction.users.length > 0 ? reaction.users.join(', ') : '리액션'}
                                    >
                                        {reaction.emoji} {reaction.count}
                                    </span>
                                ))}
                            </div>
                        )}
                        {/* 이모지 추가 버튼 */}
                        <button
                            className="add-emoji-btn"
                            style={{
                                marginLeft: 2,
                                fontSize: 16,
                                background: emojiPickerMsgId === msg.id ? 'rgba(33,150,243,0.15)' : 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: emojiPickerMsgId === msg.id ? '#2196f3' : '#888',
                                borderRadius: 8,
                                padding: '0 6px',
                                transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => {
                                if (emojiPickerMsgId !== msg.id) {
                                    e.currentTarget.style.background = 'rgba(33,150,243,0.08)';
                                    e.currentTarget.style.color = '#2196f3';
                                }
                            }}
                            onMouseLeave={e => {
                                if (emojiPickerMsgId !== msg.id) {
                                    e.currentTarget.style.background = 'none';
                                    e.currentTarget.style.color = '#888';
                                }
                            }}
                            onClick={() => setEmojiPickerMsgId(emojiPickerMsgId === msg.id ? null : msg.id)}
                        >
                            {emojiPickerMsgId === msg.id ? '−' : '+'}
                        </button>

                        {/* 컨텍스트 메뉴 */}
                        {emojiPickerMsgId === msg.id && (
                            <div
                                className="context-menu-popup"
                                style={{
                                    position: 'absolute',
                                    left: isMyMessage ? 'auto' : '75px',
                                    right: isMyMessage ? '75px' : 'auto',
                                    backgroundColor: '#2d2d2d',
                                    border: '1px solid #444',
                                    borderRadius: 8,
                                    padding: '8px 0',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                    zIndex: 1000,
                                    minWidth: 120,
                                }}
                            >
                                {/* 이모지 선택 영역 */}
                                <div style={{ padding: '8px 12px', borderBottom: '1px solid #444' }}>
                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                        {['👍', '❤️', '😂', '😮', '😢', '😡'].map(emoji => (
                                            <button
                                                key={emoji}
                                                onClick={() => {
                                                    toggleReaction(msg.id, emoji);
                                                    setEmojiPickerMsgId(null);
                                                }}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    fontSize: 20,
                                                    cursor: 'pointer',
                                                    padding: 4,
                                                    borderRadius: 4,
                                                    transition: 'background 0.15s',
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* 액션 버튼들 */}
                                <div style={{ padding: '4px 0' }}>
                                    {/* 답장 버튼 */}
                                    <button
                                        onClick={() => {
                                            onReply(msg);
                                            setEmojiPickerMsgId(null);
                                        }}
                                        style={{
                                            width: '100%',
                                            background: 'none',
                                            border: 'none',
                                            padding: '8px 12px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            color: '#fff',
                                            fontSize: 14,
                                            transition: 'background 0.15s',
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(33,150,243,0.1)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                    >
                                        <div style={{
                                            width: 16,
                                            height: 16,
                                            backgroundColor: '#2196f3',
                                            borderRadius: 3,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: 10,
                                            color: '#fff'
                                        }}>
                                            ↶
                                        </div>
                                        답장
                                    </button>

                                    {/* 고정핀 버튼 */}
                                    <button
                                        className={`pin-btn${pinnedIds.includes(msg.id) ? ' pinned' : ''}`}
                                        onClick={e => { e.stopPropagation(); togglePin(msg.id); }}
                                        title={pinnedIds.includes(msg.id) ? '핀 해제' : '상단 고정'}
                                        style={{
                                            width: '100%',
                                            background: 'none',
                                            border: 'none',
                                            padding: '8px 12px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            color: '#ff9800',
                                            fontSize: 14,
                                            transition: 'background 0.15s',
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,152,0,0.1)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                    >
                                        <div style={{ fontSize: 16 }}>📌</div>
                                        고정핀
                                    </button>

                                    {/* 즐겨찾기(▽/▼) 버튼 */}
                                    <button
                                        className="favorite-btn"
                                        title={favoriteMessages.includes(msg.id) ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                                        onClick={e => { e.stopPropagation(); onToggleFavorite(msg); }}
                                        style={{
                                            width: '100%',
                                            background: 'none',
                                            border: 'none',
                                            padding: '8px 12px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            color: '#4aa8d8',
                                            fontSize: 14,
                                            transition: 'background 0.15s',
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 68, 255, 0.1)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                    >
                                        <div style={{ fontSize: 16 }}>{favoriteMessages.includes(msg.id) ? '▼' : '▽'}</div>
                                        즐겨찾기
                                    </button>

                                    {/* 메시지 삭제 버튼 (본인 메시지만 삭제 가능) */}
                                    {isMyMessage && (
                                        <button
                                            onClick={() => {
                                                if (window.confirm('이 메시지를 삭제하시겠습니까?')) {
                                                    handleDeleteMessage(msg);
                                                    setEmojiPickerMsgId(null);
                                                }
                                            }}
                                            style={{
                                                width: '100%',
                                                background: 'none',
                                                border: 'none',
                                                padding: '8px 12px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                color: '#f44336',
                                                fontSize: 14,
                                                transition: 'background 0.15s',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(244,67,54,0.1)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                        >
                                            <div style={{ fontSize: 16 }}>🗑️</div>
                                            삭제
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }, [messages, loginUser, onMessageClick, getSenderColor, localReactions, emojiPickerMsgId, onReply, onReplyQuoteClick, pinnedIds, onImageClick, favoriteMessages, onToggleFavorite, tempHighlightedId, deleteMessage]);

    // 메시지 목록이 바뀌면 localReactions 동기화
    useEffect(() => {
        const map = {};
        messages.forEach(msg => {
            map[msg.id] = msg.reactions || [];
        });
        setLocalReactions(map);
    }, [messages]);

    // 이모지 토글 API 호출
    const toggleReaction = async (messageId, emoji) => {
        try {
            const res = await fetch(`/api/reactions/${messageId}/toggle/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ emoji })
            });
            const data = await res.json();
            // optimistic update: 바로 반영
            setLocalReactions(prev => {
                const prevList = prev[messageId] || [];
                const user = loginUser?.username;
                let updated;
                if (data.status === 'added') {
                    // 이미 해당 이모지+유저가 있으면 중복 방지
                    if (prevList.some(r => r.emoji === emoji && r.users?.includes(user))) return prev;
                    // 기존 이모지 있으면 count+1, users 추가
                    let found = false;
                    updated = prevList.map(r => {
                        if (r.emoji === emoji) {
                            found = true;
                            return { ...r, count: r.count + 1, users: [...(r.users || []), user] };
                        }
                        return r;
                    });
                    if (!found) updated = [...updated, { emoji, count: 1, users: [user] }];
                } else if (data.status === 'removed') {
                    // count-1, users에서 제거, count=0이면 삭제
                    updated = prevList.map(r => {
                        if (r.emoji === emoji) {
                            const users = (r.users || []).filter(u => u !== user);
                            return { ...r, count: r.count - 1, users };
                        }
                        return r;
                    }).filter(r => r.count > 0);
                } else {
                    updated = prevList;
                }
                return { ...prev, [messageId]: updated };
            });
        } catch (e) {
            alert('이모지 반응 처리 실패');
        }
    };

    // 메시지 삭제 함수
    const handleDeleteMessage = async (msg) => {
        if (!msg.id) return;
        if (!(loginUser && (msg.username === loginUser.username || msg.user_id === loginUser.id))) {
            alert('본인 메시지만 삭제할 수 있습니다.');
            return;
        }
        if (!window.confirm('정말 이 메시지를 삭제하시겠습니까?')) return;
        try {
            const res = await csrfFetch(`${getApiBase()}/api/chat/messages/${msg.id}/`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (res.ok) {
                // 삭제 성공 후 부모 콜백 호출!
                if (onMessageDelete) onMessageDelete(msg.id);
            } else {
                alert('메시지 삭제에 실패했습니다.');
            }
        } catch (e) {
            alert('메시지 삭제 중 오류: ' + e.message);
        }
    };

    // 핀 토글 함수
    const togglePin = (msgId) => {
        setPinnedIds(prev => prev.includes(msgId) ? prev.filter(id => id !== msgId) : [...prev, msgId]);
    };

    // 핀된 메시지 추출 (최신순, 최대 3개)
    const pinnedMessages = messages.filter(m => pinnedIds.includes(m.id)).slice(-3).reverse();

    // 메뉴가 열린 후 아무 곳이나 클릭하면 닫히도록 처리
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (emojiPickerMsgId && !event.target.closest('.context-menu-popup') && !event.target.closest('.add-emoji-btn')) {
                setEmojiPickerMsgId(null);
            }
        };

        if (emojiPickerMsgId) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [emojiPickerMsgId]);

    return (
        <div className="virtualized-message-list" style={{ position: 'relative', height: '100%' }}>
            {/* 상단 고정 메시지 영역 */}
            {pinnedMessages.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                    {pinnedMessages.map(msg => (
                        <div key={msg.id} className="pinned-message">
                            <span style={{ fontWeight: 600, marginRight: 8 }}>📌 {msg.sender || msg.username || 'Unknown'}</span>
                            <span>{msg.text ? msg.text.slice(0, 60) : '[첨부/삭제됨]'}</span>
                            <button className="pin-btn pinned" style={{ marginLeft: 8 }} onClick={() => togglePin(msg.id)}>해제</button>
                        </div>
                    ))}
                </div>
            )}
            {/* 새 메시지 도착 알림 */}
            {showNewMsgAlert && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: 24,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: '#FFD600',
                        color: '#222',
                        borderRadius: 16,
                        padding: '8px 24px',
                        fontWeight: 700,
                        fontSize: 15,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                        zIndex: 1000,
                        cursor: 'pointer',
                        transition: 'background 0.2s, color 0.2s',
                    }}
                    onClick={handleNewMsgAlertClick}
                >
                    🔥 새 메시지 도착! (클릭 시 최신으로)
                </div>
            )}
            {/* 일반 스크롤 기반 메시지 리스트 */}
            <div
                ref={scrollRef}
                style={{
                    height: '100%',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#888 #f1f1f1',
                }}
            >
                {messages.map((msg, index) => renderMessage(msg, index))}
            </div>
        </div>
    );
};

export default VirtualizedMessageList; 