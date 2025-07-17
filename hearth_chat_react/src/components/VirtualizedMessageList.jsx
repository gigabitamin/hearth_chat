import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import './VirtualizedMessageList.css';

const EMOJI_LIST = ['👍', '😂', '❤️', '😮', '😢', '👏', '🔥', '😡', '🙏', '🎉'];

const VirtualizedMessageList = ({
    messages = [],
    onLoadMore,
    hasMore = false,
    itemHeight = 80,
    loginUser,
    highlightMessageId,
    onMessageClick,
    getSenderColor,
    onReply, // 답장 콜백
    onReplyQuoteClick // 인용 클릭 콜백
}) => {
    const [listRef, setListRef] = useState(null);
    const [loading, setLoading] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [emojiPickerMsgId, setEmojiPickerMsgId] = useState(null); // 이모지 선택창 표시용
    const [localReactions, setLocalReactions] = useState({}); // {messageId: [reactions]}
    // 핀 상태 관리 (프론트 임시)
    const [pinnedIds, setPinnedIds] = useState([]);
    const [viewerImage, setViewerImage] = useState(null); // 이미지 뷰어 모달 상태

    // 핀 토글 함수
    const togglePin = (msgId) => {
        setPinnedIds(prev => prev.includes(msgId) ? prev.filter(id => id !== msgId) : [...prev, msgId]);
    };

    // 핀된 메시지 추출 (최신순, 최대 3개)
    const pinnedMessages = messages.filter(m => pinnedIds.includes(m.id)).slice(-3).reverse();

    // 하이라이트된 메시지 인덱스 찾기
    useEffect(() => {
        if (highlightMessageId && messages.length > 0) {
            const index = messages.findIndex(msg => msg.id === highlightMessageId);
            if (index !== -1) {
                setHighlightedIndex(index);
                // 스크롤하여 하이라이트된 메시지로 이동
                if (listRef) {
                    listRef.scrollToItem(index, 'center');
                }
                // 3초 후 하이라이트 제거
                setTimeout(() => setHighlightedIndex(-1), 3000);
            }
        }
    }, [highlightMessageId, messages, listRef]);

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

        const isHighlighted = highlightedIndex === index;
        const isMyMessage = msg.type === 'send' ||
            (loginUser && (msg.username === loginUser.username || msg.user_id === loginUser.id));
        const reactions = localReactions[msg.id] || [];
        const user = loginUser?.username;

        return (
            <div
                style={style}
                className={`message-item ${isHighlighted ? 'highlighted' : ''} ${isMyMessage ? 'my-message' : 'other-message'}`}
                onClick={() => onMessageClick && onMessageClick(msg)}
                onMouseLeave={() => setEmojiPickerMsgId(null)}
            >
                <div className="message-content">
                    <div className="message-header">
                        <span className="message-sender">{msg.sender || msg.username || 'Unknown'}</span>
                        <span className="message-time">
                            {new Date(msg.date || msg.timestamp).toLocaleTimeString('ko-KR', {
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
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
                    <div
                        className="message-bubble"
                        style={{
                            backgroundColor: isMyMessage ? undefined : getSenderColor(msg.sender),
                            color: isMyMessage ? undefined : (getSenderColor(msg.sender) ? '#fff' : undefined),
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                        }}
                    >
                        {msg.imageUrl && (
                            <img
                                src={msg.imageUrl}
                                alt="첨부 이미지"
                                className="message-image"
                                onClick={e => {
                                    e.stopPropagation();
                                    setViewerImage(msg.imageUrl);
                                }}
                            />
                        )}
                        {msg.text || msg.content ? (
                            <div className="message-text" style={{ marginTop: msg.imageUrl ? 8 : 0 }}>{msg.text || msg.content}</div>
                        ) : null}
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
    }, [messages, highlightedIndex, loginUser, onMessageClick, getSenderColor, localReactions, emojiPickerMsgId, onReply, onReplyQuoteClick, pinnedIds]);

    // 아이템이 로드되었는지 확인
    const isItemLoaded = useCallback((index) => {
        return index < messages.length;
    }, [messages.length]);

    // 아이템 개수 (로딩 중인 경우 +1)
    const itemCount = hasMore ? messages.length + 1 : messages.length;

    return (
        <div className="virtualized-message-list">
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
            <InfiniteLoader
                isItemLoaded={isItemLoaded}
                itemCount={itemCount}
                loadMoreItems={loadMoreItems}
                threshold={5}
            >
                {({ onItemsRendered, ref }) => (
                    <List
                        ref={list => {
                            setListRef(list);
                            ref(list);
                        }}
                        height={600}
                        itemCount={itemCount}
                        itemSize={itemHeight}
                        onItemsRendered={onItemsRendered}
                        overscanCount={5}
                        className="message-list"
                    >
                        {renderMessage}
                    </List>
                )}
            </InfiniteLoader>
            {/* 이미지 전체화면 뷰어 모달 */}
            {viewerImage && (
                <div className="image-viewer-modal" onClick={() => setViewerImage(null)}>
                    <div className="image-viewer-backdrop" />
                    <img src={viewerImage} alt="전체 이미지" className="image-viewer-img" onClick={e => e.stopPropagation()} />
                    <button className="image-viewer-close" onClick={() => setViewerImage(null)}>닫기</button>
                </div>
            )}
        </div>
    );
};

export default VirtualizedMessageList; 