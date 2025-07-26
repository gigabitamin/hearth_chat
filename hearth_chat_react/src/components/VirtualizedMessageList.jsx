import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Virtuoso } from 'react-virtuoso';
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
    firstItemIndex = 0, // 전체 메시지 중 현재 배열의 시작 인덱스
    totalCount = 0, // 전체 메시지 개수
}) => {
    const virtuosoRef = useRef(null);
    const [emojiPickerMsgId, setEmojiPickerMsgId] = useState(null);
    const [localReactions, setLocalReactions] = useState({}); // {messageId: [reactions]}
    const [pinnedIds, setPinnedIds] = useState([]);
    const [isScrollingUp, setIsScrollingUp] = useState(false); // 위로 스크롤 중인지 상태
    // 메시지 강조 기능 제거됨

    // deleteMessage 함수
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
            const messageIndex = messages.findIndex(msg => msg.id === scrollToMessageId);
            if (messageIndex !== -1 && virtuosoRef.current) {
                virtuosoRef.current.scrollToIndex({
                    index: messageIndex,
                    align: 'center',
                    behavior: 'smooth'
                });
            }
        }
    }, [scrollToMessageId, messages]);

    // 2. highlightMessageId로 스크롤 (강조 기능 제거)
    useEffect(() => {
        if (highlightMessageId && messages.length > 0) {
            const messageIndex = messages.findIndex(msg => msg.id === highlightMessageId);
            if (messageIndex !== -1 && virtuosoRef.current) {
                virtuosoRef.current.scrollToIndex({
                    index: messageIndex,
                    align: 'center',
                    behavior: 'smooth'
                });
            }
        }
    }, [highlightMessageId, messages]);

    // 3. 방이 바뀔 때 스크롤 상태 리셋
    useEffect(() => {
        setIsScrollingUp(false);
    }, [selectedRoomId]);

    // 4. Virtuoso에서 위로 스크롤 시(이전 메시지 fetch)
    const handleStartReached = useCallback(() => {
        if (hasMore && onLoadMore && !loadingMessages) {
            onLoadMore(true); // true = 위로 스크롤 (prepend)
            setIsScrollingUp(true); // 위로 스크롤 시 상태 업데이트
        }
    }, [hasMore, onLoadMore, loadingMessages]);

    // 5. Virtuoso에서 아래로 스크롤 시(최신 메시지 fetch, 필요시)
    const handleEndReached = useCallback(() => {
        if (hasMore && onLoadMore && !loadingMessages) {
            onLoadMore(false); // false = 아래로 스크롤 (append)
            setIsScrollingUp(false); // 아래로 스크롤 시 상태 리셋
        }
    }, [hasMore, onLoadMore, loadingMessages]);

    // 5. 메시지 렌더링 함수
    const renderMessage = useCallback((index, message) => {
        if (!message) {
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

        const isMyMessage = message.type === 'send' ||
            (loginUser && (message.username === loginUser.username || message.user_id === loginUser.id));
        const reactions = localReactions[message.id] || [];
        const user = loginUser?.username;

        return (
            <div
                key={message.id}
                className={`message-item ${isMyMessage ? 'my-message' : 'other-message'}`}
                id={`message-${message.id}`}
            >
                <div className="message-content">
                    {/* 메시지 헤더: 위쪽에 username(흰색, 굵게) + 답장/핀/즐겨찾기 버튼 */}
                    <div className="message-header"
                        style={{
                            display: 'flex',
                        }}
                    >
                        <span style={{ color: '#fff', fontWeight: 700, fontSize: 13, marginRight: 8 }}>
                            {message.sender || message.username || 'Unknown'}
                        </span>
                        {/* 핀(고정) 버튼 */}
                        <button
                            className={`pin-btn${pinnedIds.includes(message.id) ? ' pinned' : ''}`}
                            onClick={e => { e.stopPropagation(); togglePin(message.id); }}
                            title={pinnedIds.includes(message.id) ? '핀 해제' : '상단 고정'}
                        >📌</button>
                        {/* 즐겨찾기(▽/▼) 버튼 */}
                        <button
                            className="favorite-btn"
                            style={{ marginLeft: 8, fontSize: 18, color: favoriteMessages.includes(message.id) ? '#1976d2' : '#bbb', background: 'none', border: 'none', cursor: 'pointer' }}
                            title={favoriteMessages.includes(message.id) ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                            onClick={e => { e.stopPropagation(); onToggleFavorite(message); }}
                        >
                            {favoriteMessages.includes(message.id) ? '▼' : '▽'}
                        </button>
                    </div>
                    {/* 답장 인용 표시 */}
                    {message.reply && (
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
                            onClick={e => { e.stopPropagation(); onReplyQuoteClick && onReplyQuoteClick(message.reply.id); }}
                        >
                            <span style={{ fontWeight: 600, marginRight: 4, fontSize: 12 }}>↩️ {message.reply.sender || '익명'}</span>
                            <span style={{ fontStyle: 'italic', color: '#1976d2' }}>
                                {message.reply.text ? (message.reply.text.split('\n')[0].slice(0, 40) + (message.reply.text.length > 40 ? '...' : '')) : '[첨부/삭제됨]'}
                            </span>
                        </div>
                    )}
                    <div className="message-bubble-row" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        {/* 메시지 버블 */}
                        <div className="message-bubble"
                            style={{
                                backgroundColor: isMyMessage ? undefined : getSenderColor(message.sender),
                                color: isMyMessage ? undefined : (getSenderColor(message.sender) ? '#fff' : undefined),
                                position: 'relative',
                                width: '100%',
                                maxWidth: '100%',
                            }}>
                            {/* AI 메시지일 때만 질문자 username을 왼쪽 상단에 표시 */}
                            <div className="message-questioner-username">
                                {(message.questioner_username && (message.type === 'ai' || message.sender_type === 'ai')) && (
                                    <>
                                        To.
                                        <span className="questioner-username-highlight">{message.questioner_username}</span>{' '}
                                        {new Date(message.date || message.timestamp).toLocaleString('ko-KR', {
                                            year: '2-digit', month: '2-digit', day: '2-digit',
                                            hour: '2-digit', minute: '2-digit', hour12: false
                                        })}
                                    </>
                                )}
                            </div>
                            {message.imageUrl && (
                                <img
                                    src={getImageUrl(message.imageUrl)}
                                    alt="첨부 이미지"
                                    className="message-image"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onImageClick) onImageClick(getImageUrl(message.imageUrl));
                                    }}
                                />
                            )}
                            <div className="message-text">{message.text || message.content}</div>
                        </div>
                    </div>
                    {/* 아래쪽에 날짜/시간(회색, 24시간) */}
                    <div style={{ color: '#bbb', fontSize: 11, marginTop: 2, textAlign: 'left' }}>
                        {new Date(message.date || message.timestamp).toLocaleString('ko-KR', {
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
                                        onClick={() => toggleReaction(message.id, reaction.emoji)}
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
                                background: emojiPickerMsgId === message.id ? 'rgba(33,150,243,0.15)' : 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: emojiPickerMsgId === message.id ? '#2196f3' : '#888',
                                borderRadius: 8,
                                padding: '0 6px',
                                transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => {
                                if (emojiPickerMsgId !== message.id) {
                                    e.currentTarget.style.background = 'rgba(33,150,243,0.08)';
                                    e.currentTarget.style.color = '#2196f3';
                                }
                            }}
                            onMouseLeave={e => {
                                if (emojiPickerMsgId !== message.id) {
                                    e.currentTarget.style.background = 'none';
                                    e.currentTarget.style.color = '#888';
                                }
                            }}
                            onClick={() => setEmojiPickerMsgId(emojiPickerMsgId === message.id ? null : message.id)}
                        >
                            {emojiPickerMsgId === message.id ? '−' : '+'}
                        </button>

                        {/* 컨텍스트 메뉴 */}
                        {emojiPickerMsgId === message.id && (
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
                                                    toggleReaction(message.id, emoji);
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
                                            onReply(message);
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
                                        className={`pin-btn${pinnedIds.includes(message.id) ? ' pinned' : ''}`}
                                        onClick={e => { e.stopPropagation(); togglePin(message.id); }}
                                        title={pinnedIds.includes(message.id) ? '핀 해제' : '상단 고정'}
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
                                        title={favoriteMessages.includes(message.id) ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                                        onClick={e => { e.stopPropagation(); onToggleFavorite(message); }}
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
                                        <div style={{ fontSize: 16 }}>{favoriteMessages.includes(message.id) ? '▼' : '▽'}</div>
                                        즐겨찾기
                                    </button>

                                    {/* 메시지 삭제 버튼 (본인 메시지만 삭제 가능) */}
                                    {isMyMessage && (
                                        <button
                                            onClick={() => {
                                                if (window.confirm('이 메시지를 삭제하시겠습니까?')) {
                                                    handleDeleteMessage(message);
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
    }, [messages, loginUser, onMessageClick, getSenderColor, localReactions, emojiPickerMsgId, onReply, onReplyQuoteClick, pinnedIds, onImageClick, favoriteMessages, onToggleFavorite, deleteMessage, isScrollingUp]);

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

    // scrollToMessageId 처리
    useEffect(() => {
        if (scrollToMessageId && messages.length > 0) {
            const targetIndex = messages.findIndex(m => m.id == scrollToMessageId);
            if (targetIndex !== -1 && virtuosoRef.current) {
                console.log('[Virtuoso] scrollToIndex 호출:', targetIndex, '메시지 ID:', scrollToMessageId);
                virtuosoRef.current.scrollToIndex({ index: targetIndex, align: 'start' });
                // 스크롤 실행 후 즉시 scrollToMessageId를 null로 리셋하여 반복 스크롤 방지
                setTimeout(() => {
                    // 부모 컴포넌트에 scrollToMessageId를 null로 리셋하도록 알림
                    if (onMessageClick) {
                        onMessageClick(null, 'resetScrollToMessageId');
                    }
                }, 100);
            }
        }
    }, [scrollToMessageId, messages]);

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

            {/* Virtuoso 기반 메시지 리스트 */}
            <Virtuoso
                ref={virtuosoRef}
                data={messages}
                firstItemIndex={firstItemIndex}
                totalCount={totalCount}
                itemContent={renderMessage}
                startReached={handleStartReached}
                endReached={handleEndReached}
                followOutput={!scrollToMessageId && !isScrollingUp} // scrollToMessageId가 있으면 false로 고정
                overscan={200}
                increaseViewportBy={{ top: 100, bottom: 100 }}
                style={{ height: '100%' }}
                onMount={() => {
                    console.log('[Virtuoso onMount] firstItemIndex:', firstItemIndex, 'messages.length:', messages.length, 'totalCount:', totalCount, 'followOutput:', !scrollToMessageId && !isScrollingUp);
                }}
            />
        </div>
    );
};

export default VirtualizedMessageList; 