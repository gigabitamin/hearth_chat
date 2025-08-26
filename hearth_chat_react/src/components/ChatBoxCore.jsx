import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getApiBase, getCookie, csrfFetch, API_BASE, LILY_API_URL, getWebSocketUrl } from '../utils/apiConfig';
import aiService from '../services/aiService';
import axios from 'axios';

// 이미지 URL을 절대 경로로 변환하는 함수
const getImageUrl = (imageUrl) => {
    if (!imageUrl) return null;

    // 이미 절대 URL인 경우 그대로 반환
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return imageUrl;
    }

    // 상대 경로인 경우 Django 서버 주소를 앞에 붙임
    if (imageUrl.startsWith('/media/')) {
        return `${API_BASE}${imageUrl}`;
    }

    // 기타 경우는 그대로 반환
    return imageUrl;
};

// WebSocket 연결 및 메시지 전송 관련 함수들
export const useWebSocket = (selectedRoom, loginUser) => {
    const [webSocket, setWebSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    const safeWebSocketSend = useCallback((message) => {
        if (webSocket && webSocket.readyState === WebSocket.OPEN) {
            webSocket.send(JSON.stringify(message));
        }
    }, [webSocket]);

    useEffect(() => {
        if (!selectedRoom || !loginUser) return;

        // 변경 전: const ws = new WebSocket(`ws://${window.location.host}/ws/chat/${selectedRoom.id}/`);
        const ws = new WebSocket(getWebSocketUrl(`/ws/chat/${selectedRoom.id}/`));

        ws.onopen = () => {
            setIsConnected(true);
            console.log('WebSocket 연결됨');
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            // 메시지 처리 로직은 상위 컴포넌트에서 처리
        };

        ws.onclose = () => {
            setIsConnected(false);
            console.log('WebSocket 연결 끊어짐');
        };

        setWebSocket(ws);

        return () => {
            ws.close();
        };
    }, [selectedRoom, loginUser]);

    return { webSocket, isConnected, safeWebSocketSend };
};

// 메시지 전송 관련 함수들
export const useMessageHandling = (selectedRoom, loginUser, webSocket) => {
    const sendMessage = useCallback(async (messageText = null) => {
        if (!messageText || !selectedRoom || !loginUser) return;

        try {
            const messageData = {
                room: selectedRoom.id,
                content: messageText,
                sender: loginUser.username,
                timestamp: new Date().toISOString(),
            };

            // WebSocket으로 메시지 전송
            if (webSocket && webSocket.readyState === WebSocket.OPEN) {
                webSocket.send(JSON.stringify({
                    type: 'chat_message',
                    ...messageData
                }));
            }

            // Django API로도 메시지 저장
            const response = await csrfFetch(`${getApiBase()}/api/chat/messages/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(messageData)
            });

            if (!response.ok) {
                throw new Error('메시지 전송 실패');
            }

            return await response.json();
        } catch (error) {
            console.error('메시지 전송 오류:', error);
            throw error;
        }
    }, [selectedRoom, loginUser, webSocket]);

    const generateAIResponse = useCallback(async (userMessage) => {
        if (!selectedRoom || !loginUser) return;

        try {
            const response = await aiService.generateResponse({
                message: userMessage,
                room_id: selectedRoom.id,
                user_id: loginUser.id
            });

            return response;
        } catch (error) {
            console.error('AI 응답 생성 오류:', error);
            throw error;
        }
    }, [selectedRoom, loginUser]);

    return { sendMessage, generateAIResponse };
};

// 메시지 fetch 관련 함수들
export const useMessageFetching = (selectedRoom) => {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const fetchMessages = useCallback(async (roomId, offset = 0, limit = 20, isPrepending = false, isInit = false, scrollToId = null) => {
        if (!roomId) return;

        try {
            setLoading(true);
            const response = await csrfFetch(`${getApiBase()}/api/chat/messages/?room_id=${roomId}&offset=${offset}&limit=${limit}`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                const newMessages = data.results || [];

                if (isPrepending) {
                    setMessages(prev => [...newMessages, ...prev]);
                } else if (isInit) {
                    setMessages(newMessages);
                } else {
                    setMessages(prev => [...prev, ...newMessages]);
                }

                setHasMore(data.next !== null);
            }
        } catch (error) {
            console.error('메시지 fetch 오류:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchTotalCountAndFetchLatest = useCallback(async (roomId) => {
        if (!roomId) return;

        try {
            const response = await csrfFetch(`${getApiBase()}/api/chat/messages/?room_id=${roomId}&limit=1`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                const totalCount = data.count || 0;

                if (totalCount > 0) {
                    const latestOffset = Math.max(0, totalCount - 20);
                    await fetchMessages(roomId, latestOffset, 20, false, true);
                }
            }
        } catch (error) {
            console.error('최신 메시지 fetch 오류:', error);
        }
    }, [fetchMessages]);

    return {
        messages,
        setMessages,
        loading,
        hasMore,
        fetchMessages,
        fetchTotalCountAndFetchLatest
    };
};

// 즐겨찾기 메시지 관련 함수들
export const useFavoriteMessages = (loginUser) => {
    const [favoriteMessages, setFavoriteMessages] = useState([]);

    const fetchMyFavoriteMessages = useCallback(async () => {
        if (!loginUser) return;

        try {
            const response = await csrfFetch(`${getApiBase()}/api/chat/favorites/`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setFavoriteMessages(data);
            }
        } catch (error) {
            console.error('즐겨찾기 메시지 fetch 오류:', error);
        }
    }, [loginUser]);

    const handleToggleFavorite = useCallback(async (msg) => {
        if (!loginUser) return;

        try {
            const response = await csrfFetch(`${getApiBase()}/api/chat/favorites/${msg.id}/`, {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                await fetchMyFavoriteMessages();
            }
        } catch (error) {
            console.error('즐겨찾기 토글 오류:', error);
        }
    }, [loginUser, fetchMyFavoriteMessages]);

    return {
        favoriteMessages,
        fetchMyFavoriteMessages,
        handleToggleFavorite
    };
};

// fetchMyFavoriteMessages와 handleToggleFavorite를 별도로 export
export const fetchMyFavoriteMessages = async (loginUser) => {
    if (!loginUser) return;

    try {
        const response = await csrfFetch(`${getApiBase()}/api/chat/favorites/`, {
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            return data;
        }
    } catch (error) {
        console.error('즐겨찾기 메시지 fetch 오류:', error);
    }
};

export const handleToggleFavorite = async (msg, loginUser) => {
    if (!loginUser) return;

    try {
        const response = await csrfFetch(`${getApiBase()}/api/chat/favorites/${msg.id}/`, {
            method: 'POST',
            credentials: 'include'
        });

        if (response.ok) {
            await fetchMyFavoriteMessages(loginUser);
        }
    } catch (error) {
        console.error('즐겨찾기 토글 오류:', error);
    }
};

// 메시지 삭제 관련 함수들
export const useMessageDeletion = (selectedRoom, loginUser) => {
    const handleDeleteMessage = useCallback(async (msg) => {
        if (!loginUser || !selectedRoom) return false;

        try {
            const response = await csrfFetch(`${getApiBase()}/api/chat/messages/${msg.id}/delete/`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                return true;
            } else {
                const data = await response.json();
                alert(data.error || '메시지 삭제에 실패했습니다.');
                return false;
            }
        } catch (error) {
            console.error('메시지 삭제 오류:', error);
            alert('메시지 삭제 중 오류가 발생했습니다.');
            return false;
        }
    }, [selectedRoom, loginUser]);

    return { handleDeleteMessage };
};

// 유틸리티 함수들
export const getRandomColor = () => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
    return colors[Math.floor(Math.random() * colors.length)];
};

export const getSenderColor = (sender) => {
    if (!sender) return '#666';

    // 사용자별 고정 색상 매핑
    const colorMap = {
        'AI': '#4ECDC4',
        'System': '#FF6B6B',
        'Admin': '#DDA0DD'
    };

    if (colorMap[sender]) return colorMap[sender];

    // 해시 기반 색상 생성
    let hash = 0;
    for (let i = 0; i < sender.length; i++) {
        hash = sender.charCodeAt(i) + ((hash << 5) - hash);
    }

    const hue = hash % 360;
    return `hsl(${hue}, 70%, 60%)`;
};

export { getImageUrl };

// 메시지 관련 함수들
export const fetchMessages = async (
    roomId,
    offset = 0,
    limit = 20,
    isPrepending = false,
    isInit = false,
    scrollToId = null,
    setLoadingMessages,
    setTotalCount,
    messages,
    setMessages,
    setFirstItemIndex,
    setMessageOffset
) => {
    // 메시지 불러오기 함수 - ChatBoxCore에서 import됨
    if (setLoadingMessages) setLoadingMessages(true);

    try {
        const res = await fetch(`${API_BASE}/api/chat/messages/messages/?room=${roomId}&limit=${limit}&offset=${offset}`, {
            credentials: 'include',
        });
        if (res.ok) {
            const data = await res.json();
            if (setTotalCount) setTotalCount(data.count || 0);

            // 중복 제거 로직을 실제 메시지 ID 기반으로 변경
            let uniqueNewMessages = data.results;

            // 항상 중복 제거 수행 (isInit 여부와 관계없이)
            if (messages && messages.length > 0) {
                const existingIds = new Set(messages.map(m => m.id));
                uniqueNewMessages = data.results.filter(msg => !existingIds.has(msg.id));
            }

            if (uniqueNewMessages.length === 0) {
                return;
            }

            if (isPrepending) {
                if (setMessages) {
                    setMessages(prev => {
                        const newArr = [...uniqueNewMessages, ...prev];
                        const sliced = newArr.slice(0, 40); // 앞쪽 40개만 유지
                        if (setFirstItemIndex) setFirstItemIndex(offset);
                        if (setMessageOffset) setMessageOffset(offset);
                        return sliced;
                    });
                }
            } else {
                if (setMessages) {
                    setMessages(prev => {
                        const newArr = [...prev, ...uniqueNewMessages];
                        const sliced = newArr.slice(-40); // 뒤쪽 40개만 유지
                        if (setFirstItemIndex) setFirstItemIndex(offset);
                        if (setMessageOffset) setMessageOffset(offset);
                        return sliced;
                    });
                }
            }
        }
    } catch (error) {
        console.error('[fetchMessages] 오류:', error);
    } finally {
        if (setLoadingMessages) setLoadingMessages(false);
    }
};

export const fetchTotalCountAndFetchLatest = async (
    roomId,
    setTotalCount,
    setFirstItemIndex,
    setMessageOffset,
    setMessages,
    messages
) => {
    try {
        const res = await fetch(`${API_BASE}/api/chat/messages/messages/?room=${roomId}&limit=1&offset=0`, { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            const total = data.count || 0;
            if (setTotalCount) setTotalCount(total);
            const offset = Math.max(0, total - 20);
            // fetchMessages 호출 시 필요한 상태 변수들을 전달
            if (setFirstItemIndex) setFirstItemIndex(offset);
            if (setMessageOffset) setMessageOffset(offset);

            // 실제 메시지도 가져오기
            if (setMessages) {
                await fetchMessages(
                    roomId,
                    offset,
                    20,
                    false,
                    true,
                    null,
                    null,
                    setTotalCount,
                    messages,
                    setMessages,
                    setFirstItemIndex,
                    setMessageOffset
                );
            }
        }
    } catch (e) {
        if (setFirstItemIndex) setFirstItemIndex(0);
        if (setMessageOffset) setMessageOffset(0);
    }
};

export const fetchOffsetForMessageId = async (
    roomId,
    messageId,
    setIsJumpingToMessage,
    setFirstItemIndex,
    setMessageOffset
) => {
    try {
        const res = await fetch(`${API_BASE}/api/chat/messages/offset/?room=${roomId}&messageId=${messageId}&page_size=40`, {
            credentials: 'include',
        });

        if (res.ok) {
            const data = await res.json();
            const offset = data.offset;
            if (setIsJumpingToMessage) setIsJumpingToMessage(true);
            if (setFirstItemIndex) setFirstItemIndex(offset);
            if (setMessageOffset) setMessageOffset(offset);
        } else {
            console.error('[특정 메시지 이동] API 오류:', res.status);
            if (setIsJumpingToMessage) setIsJumpingToMessage(true);
            if (setFirstItemIndex) setFirstItemIndex(0);
            if (setMessageOffset) setMessageOffset(0);
        }
    } catch (error) {
        console.error('[특정 메시지 이동] 네트워크 오류:', error);
        if (setIsJumpingToMessage) setIsJumpingToMessage(true);
        if (setFirstItemIndex) setFirstItemIndex(0);
        if (setMessageOffset) setMessageOffset(0);
    }
};

export const handleRoomSettingsSuccess = (updatedRoom, selectedRoom) => {
    // 방 정보 갱신 핸들러
    if (updatedRoom && selectedRoom && updatedRoom.id === selectedRoom.id) {
        Object.assign(selectedRoom, updatedRoom);
    }
};

export const handleMessageClick = (message, action, setScrollToMessageId, setIsJumpingToMessage) => {
    if (action === 'resetScrollToMessageId') {
        if (setScrollToMessageId) setScrollToMessageId(null);
        if (setIsJumpingToMessage) setIsJumpingToMessage(false);
    }
};

export const handleRemoveAttachedImage = (index) => {
    // 첨부 이미지 해제/제거 - ChatBoxMedia에서 import됨
};

export const handleRemoveAllAttachedImages = () => {
    // 첨부 이미지 해제/제거 - ChatBoxMedia에서 import됨
};

// LILY_API_URL export
export { LILY_API_URL }; 