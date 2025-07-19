import React, { useState, useEffect, useRef, useCallback } from 'react';
import { VariableSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import AutoSizer from 'react-virtualized-auto-sizer';
import './VirtualizedMessageList.css';

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
}) => {
    const [listRef, setListRef] = useState(null);
    const [loading, setLoading] = useState(false);
    const [emojiPickerMsgId, setEmojiPickerMsgId] = useState(null); // 이모지 선택창 표시용
    const [localReactions, setLocalReactions] = useState({}); // {messageId: [reactions]}
    // 핀 상태 관리 (프론트 임시)
    const [pinnedIds, setPinnedIds] = useState([]);
    const prevMessagesLength = useRef(0);
    const [showNewMsgAlert, setShowNewMsgAlert] = useState(false);
    const [alertBlink, setAlertBlink] = useState(0);
    const scrollContainerRef = useRef(null);

    // 핀 토글 함수
    const togglePin = (msgId) => {
        setPinnedIds(prev => prev.includes(msgId) ? prev.filter(id => id !== msgId) : [...prev, msgId]);
    };

    // 핀된 메시지 추출 (최신순, 최대 3개)
    const pinnedMessages = messages.filter(m => pinnedIds.includes(m.id)).slice(-3).reverse();

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

    // 무한 스크롤 로딩 처리
    const loadMoreItems = useCallback(async (startIndex, stopIndex) => {
        if (loading || !hasMore) return;

        setLoading(true);
        try {
            await onLoadMore(startIndex, stopIndex);
        } catch (error) {
            console.error('Failed to load more messages:', error);
        } finally {
            setLoading(false);
        }
    }, [loading, hasMore, onLoadMore]);

    // 메시지 높이 계산 보정: 폰트 크기, 패딩, 마진, 이미지 등 모두 반영
    const getItemSize = useCallback((index) => {
        const msg = messages[index];
        if (!msg) return 80;

        // 모바일 환경에서 vw 단위로 보정
        const isMobile = typeof window !== 'undefined' && window.innerWidth <= 600;
        const fontSize = 15;
        const lineHeight = 1.4;
        const maxWidth = isMobile ? window.innerWidth * 0.8 : 480; // 버블 최대 너비와 일치시킴
        const content = msg.text || msg.content || '';
        // 실제 줄 수 계산: 한 줄이 너무 길면 maxWidth 기준으로 줄 수 증가
        const approxCharPerLine = Math.floor(maxWidth / (fontSize * 0.6)); // 한글/영문 혼합 기준
        const lines = content.split('\n').reduce((acc, line) => acc + Math.ceil(line.length / approxCharPerLine), 0);
        const textHeight = Math.max(lines * fontSize * lineHeight, fontSize * lineHeight);
        const bubblePadding = 7 * 2;
        const bubbleMargin = 6 * 2;
        // 메시지 아이템 자체의 패딩과 마진(여백) 보정
        const itemPadding = 8 * 2; // .message-item { padding: 8px 16px; }
        const itemMargin = 12; // .message-item { margin-bottom: 12px; }
        const extraMargin = 32; // 기본 여유 여백(겹침 방지, 기존 24px에서 32px로 증가)
        // 타입 경계에서 추가 여백
        let typeBoundaryMargin = 0;
        if (index > 0) {
            const prev = messages[index - 1];
            if (prev && prev.type !== msg.type) {
                typeBoundaryMargin = 32; // my-message/other-message 경계에서 추가 여백
            }
        }
        // 이미지 높이: 실제 이미지 비율을 알 수 있으면 반영, 없으면 고정값
        let imageHeight = 0;
        if (msg.imageUrl) {
            imageHeight = (msg.imageHeight && msg.imageWidth)
                ? Math.min(200, (msg.imageHeight / msg.imageWidth) * maxWidth) + 8
                : 200 + 8;
        }
        let extra = 0;
        if (msg.reply) extra += 28; // 답장 인용 바 높이
        if (msg.reactions && msg.reactions.length > 0) extra += 28; // 리액션 바 높이
        const mobileExtra = isMobile ? 12 : 0;
        return textHeight + bubblePadding + bubbleMargin + itemPadding + itemMargin + extraMargin + typeBoundaryMargin + imageHeight + extra + mobileExtra;
    }, [messages]);

    // VariableSizeList 높이 캐시 강제 리셋: 메시지/창 크기/폰트 등 변화 시
    useEffect(() => {
        if (listRef && typeof listRef.resetAfterIndex === 'function') {
            listRef.resetAfterIndex(0, true);
        }
    }, [messages, window.innerWidth, window.innerHeight]);


    // 1. highlightMessageId prop이 바뀔 때마다 내부 tempHighlightedId 상태를 1초간 유지하는 useEffect 추가
    const [tempHighlightedId, setTempHighlightedId] = useState(null);
    useEffect(() => {
        if (highlightMessageId) {
            setTempHighlightedId(highlightMessageId);
            const timeout = setTimeout(() => setTempHighlightedId(null), 1000);
            return () => clearTimeout(timeout);
        }
    }, [highlightMessageId]);

    // 메시지 렌더링 함수
    const renderMessage = useCallback(({ index, style }) => {
        const msg = messages[index];
        if (!msg) {
            return (
                <div style={style} className="message-loading">
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
        console.log('[msg]', msg);

        const isMyMessage = msg.type === 'send' ||
            (loginUser && (msg.username === loginUser.username || msg.user_id === loginUser.id));
        const reactions = localReactions[msg.id] || [];
        const user = loginUser?.username;

        return (
            <div
                style={style}
                className={`message-item ${isMyMessage ? 'my-message' : 'other-message'} ${tempHighlightedId === msg.id ? 'temp-highlight' : ''}`}
                // onClick={() => onMessageClick && onMessageClick(msg)}
                onMouseLeave={() => setEmojiPickerMsgId(null)}
            >
                <div className="message-content">
                    {/* 메시지 헤더: 위쪽에 username(흰색, 굵게) + 답장/핀/즐겨찾기 버튼 */}
                    <div className="message-header" style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                        <span style={{ color: '#fff', fontWeight: 700, fontSize: 13, marginRight: 8 }}>
                            {msg.sender || msg.username || 'Unknown'}
                        </span>
                        {/* 답장 버튼 (hover 시 노출) */}
                        <button
                            className="reply-btn"
                            style={{ marginLeft: 8, fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', color: '#2196f3', display: 'inline-block' }}
                            onClick={e => { e.stopPropagation(); onReply && onReply(msg); }}
                            title="답장"
                        >↩️ 답장</button>
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
                    <div className="message-bubble" style={{ backgroundColor: isMyMessage ? undefined : getSenderColor(msg.sender), color: isMyMessage ? undefined : (getSenderColor(msg.sender) ? '#fff' : undefined), position: 'relative' }}>
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
                                src={msg.imageUrl}
                                alt="첨부 이미지"
                                className="message-image"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onImageClick) onImageClick(msg.imageUrl);
                                }}
                            />
                        )}
                        <div className="message-text">{msg.text || msg.content}</div>
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
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#888',
                                borderRadius: 8,
                                padding: '0 6px',
                                transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(33,150,243,0.08)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                            onClick={e => { e.stopPropagation(); setEmojiPickerMsgId(msg.id); }}
                        >
                            ＋
                        </button>
                        {/* 이모지 선택 팝업 */}
                        {emojiPickerMsgId === msg.id && (
                            <div className="emoji-picker-popup" style={{ position: 'absolute', zIndex: 10, background: '#222', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.18)', padding: 6, display: 'flex', gap: 4, top: 32, left: 60 }}>
                                {EMOJI_LIST.map(emoji => (
                                    <span
                                        key={emoji}
                                        style={{ fontSize: 20, cursor: 'pointer', padding: 2 }}
                                        onClick={e => { e.stopPropagation(); toggleReaction(msg.id, emoji); setEmojiPickerMsgId(null); }}
                                    >
                                        {emoji}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }, [messages, loginUser, onMessageClick, getSenderColor, localReactions, emojiPickerMsgId, onReply, onReplyQuoteClick, pinnedIds, onImageClick, favoriteMessages, onToggleFavorite, tempHighlightedId]);

    // 아이템이 로드되었는지 확인
    const isItemLoaded = useCallback((index) => {
        return index < messages.length;
    }, [messages.length]);

    // 아이템 개수 (로딩 중인 경우 +1)
    const itemCount = hasMore ? messages.length + 1 : messages.length;

    // 방이 바뀔 때마다 최신 위치로 이동
    useEffect(() => {
        if (listRef && messages.length > 0) {
            listRef.scrollToItem(messages.length - 1, 'end');
        }
        prevMessagesLength.current = messages.length;
    }, [selectedRoomId, listRef, messages.length]);
    // 새 메시지 도착 시 스크롤이 하단이 아니면 알림 표시
    useEffect(() => {
        if (!listRef || messages.length === 0) return;
        // 스크롤이 하단(최신) 근처인지 확인
        const isAtBottom = () => {
            if (!scrollContainerRef.current) return true;
            const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
            return scrollHeight - scrollTop - clientHeight < 40; // 40px 이내면 하단
        };
        if (prevMessagesLength.current > 0 && messages.length > prevMessagesLength.current) {
            if (isAtBottom()) {
                listRef.scrollToItem(messages.length - 1, 'end');
            } else {
                // 알림 3번 반짝임
                setShowNewMsgAlert(true);
                setAlertBlink(1);
                let count = 0;
                const interval = setInterval(() => {
                    setAlertBlink(v => v + 1);
                    count++;
                    if (count >= 3) {
                        clearInterval(interval);
                        setTimeout(() => setShowNewMsgAlert(false), 1000);
                    }
                }, 1000);
            }
        }
        prevMessagesLength.current = messages.length;
    }, [messages, listRef]);

    return (
        <div className="virtualized-message-list" ref={scrollContainerRef} style={{ position: 'relative' }}>
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
                        background: alertBlink % 2 === 1 ? '#FFD600' : '#222',
                        color: alertBlink % 2 === 1 ? '#222' : '#FFD600',
                        borderRadius: 16,
                        padding: '8px 24px',
                        fontWeight: 700,
                        fontSize: 15,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                        zIndex: 1000,
                        cursor: 'pointer',
                        transition: 'background 0.2s, color 0.2s',
                    }}
                    onClick={() => {
                        if (listRef && messages.length > 0) {
                            listRef.scrollToItem(messages.length - 1, 'end');
                        }
                        setShowNewMsgAlert(false);
                    }}
                >
                    🔥 새 메시지 도착! (클릭 시 최신으로)
                </div>
            )}
            <AutoSizer>
                {({ height, width }) => (
                    <InfiniteLoader
                        isItemLoaded={isItemLoaded}
                        itemCount={itemCount}
                        loadMoreItems={loadMoreItems}
                        threshold={5}
                    >
                        {({ onItemsRendered, ref }) => (
                            <List
                                ref={(list) => {
                                    setListRef(list);
                                    ref(list);
                                }}
                                height={height}
                                width={width}
                                itemCount={itemCount}
                                itemSize={getItemSize}
                                onItemsRendered={onItemsRendered}
                                overscanCount={5}
                                className="message-list"
                            >
                                {renderMessage}
                            </List>
                        )}
                    </InfiniteLoader>
                )}
            </AutoSizer>
        </div>
    );
};

export default VirtualizedMessageList; 