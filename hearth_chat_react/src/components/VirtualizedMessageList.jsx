import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import './VirtualizedMessageList.css';

const VirtualizedMessageList = ({
    messages = [],
    onLoadMore,
    hasMore = false,
    itemHeight = 80,
    loginUser,
    highlightMessageId,
    onMessageClick,
    getSenderColor
}) => {
    const [listRef, setListRef] = useState(null);
    const [loading, setLoading] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

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

        return (
            <div
                style={style}
                className={`message-item ${isHighlighted ? 'highlighted' : ''} ${isMyMessage ? 'my-message' : 'other-message'}`}
                onClick={() => onMessageClick && onMessageClick(msg)}
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
                    </div>
                    <div
                        className="message-bubble"
                        style={{
                            backgroundColor: isMyMessage ? undefined : getSenderColor(msg.sender),
                            color: isMyMessage ? undefined : (getSenderColor(msg.sender) ? '#fff' : undefined),
                        }}
                    >
                        {msg.imageUrl && (
                            <img
                                src={msg.imageUrl}
                                alt="첨부 이미지"
                                className="message-image"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    // 이미지 뷰어 열기
                                }}
                            />
                        )}
                        <div className="message-text">{msg.text || msg.content}</div>
                    </div>
                    {msg.reactions && msg.reactions.length > 0 && (
                        <div className="message-reactions">
                            {msg.reactions.map((reaction, i) => (
                                <span key={i} className="reaction-emoji">
                                    {reaction.emoji} {reaction.count}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }, [messages, highlightedIndex, loginUser, onMessageClick, getSenderColor]);

    // 아이템이 로드되었는지 확인
    const isItemLoaded = useCallback((index) => {
        return index < messages.length;
    }, [messages.length]);

    // 아이템 개수 (로딩 중인 경우 +1)
    const itemCount = hasMore ? messages.length + 1 : messages.length;

    return (
        <div className="virtualized-message-list">
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
        </div>
    );
};

export default VirtualizedMessageList; 