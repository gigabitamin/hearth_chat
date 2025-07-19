import React, { useState, useEffect } from 'react';
import './SearchModal.css';
import { useNavigate } from 'react-router-dom';
import { FixedSizeList as List } from 'react-window';
import copy from 'copy-to-clipboard';
import { getApiBase } from '../app';

export default function SearchModal({
    open, onClose, rooms = [], messages = [], users = [],
    fetchPreviewMessages // ★ props로 받음
}) {
    // previewMessages 상태를 tempHighlightId보다 먼저 선언
    const [previewMessages, setPreviewMessages] = useState([]);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [tempHighlightId, setTempHighlightId] = useState(null);
    useEffect(() => {
        if (previewMessages && previewMessages.length > 0) {
            const centerMsg = previewMessages.find(m => m.isCenter);
            if (centerMsg) {
                setTempHighlightId(centerMsg.id);
                const timeout = setTimeout(() => setTempHighlightId(null), 1000);
                return () => clearTimeout(timeout);
            }
        }
    }, [previewMessages]);
    const [query, setQuery] = useState('');
    const [scope, setScope] = useState('all'); // all, room, message, user
    const [useAnd, setUseAnd] = useState(false);
    const [useRegex, setUseRegex] = useState(false);
    const [sortBy, setSortBy] = useState('relevance'); // relevance, date
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const [debouncedQuery, setDebouncedQuery] = useState(query);
    const [useApiSearch, setUseApiSearch] = useState(false); // API 기반 검색 토글
    const [apiResults, setApiResults] = useState([]);
    const [apiTotal, setApiTotal] = useState(0);
    const [apiPage, setApiPage] = useState(1);
    const [apiPageSize, setApiPageSize] = useState(100);
    const [activeIndex, setActiveIndex] = useState(-1);
    const resultListRef = React.useRef();
    const [resultTypeFilter, setResultTypeFilter] = useState('all'); // all, message, room, user
    const [selectedIndexes, setSelectedIndexes] = useState([]);
    const [copiedIndex, setCopiedIndex] = useState(-1);
    const [favoriteMessagesLoading, setFavoriteMessagesLoading] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);

    // 1. 즐겨찾기 상태 관리 (서버 연동)
    const [favoriteRooms, setFavoriteRooms] = useState([]);
    const [favoriteRoomsLoading, setFavoriteRoomsLoading] = useState(false);

    // (1) 메시지 즐겨찾기 상태 관리
    const [favoriteMessages, setFavoriteMessages] = useState([]);
    const fetchFavoriteMessages = async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/chat/messages/my_favorites/`, {
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!res.ok) throw new Error('Failed to fetch favorite messages');
            const data = await res.json();
            setFavoriteMessages(data.results ? data.results.map(m => m.id) : data.map(m => m.id));
        } catch { }
    };
    useEffect(() => { fetchFavoriteMessages(); }, []);

    // (2) 메시지 즐겨찾기 토글 함수
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }
    const handleToggleFavoriteMessage = async (msg, index) => {
        const isFav = favoriteMessages.includes(msg.id);
        const url = `${getApiBase()}/api/chat/messages/${msg.id}/favorite/`;
        const method = isFav ? 'DELETE' : 'POST';
        try {
            const csrftoken = getCookie('csrftoken');
            await fetch(url, {
                method,
                credentials: 'include',
                headers: { 'X-CSRFToken': csrftoken },
            });
            fetchFavoriteMessages();
        } catch (err) {
            alert('메시지 즐겨찾기 처리 실패: ' + err.message);
        }
    };

    // 내 즐겨찾기 메시지 목록 fetch
    const fetchMyFavoriteMessages = async () => {
        setFavoriteMessagesLoading(true);
        try {
            const res = await fetch(`${getApiBase()}/api/chat/messages/my_favorites/`, {
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
            });
            if (res.ok) {
                const data = await res.json();
                setFavoriteMessages(data.results ? data.results.map(m => m.id) : data.map(m => m.id));
            }
        } catch { }
        setFavoriteMessagesLoading(false);
    };
    useEffect(() => { fetchMyFavoriteMessages(); }, []);

    // 메시지 즐겨찾기 토글
    const handleToggleFavorite = async (msg) => {
        if (!msg.id) return;
        const isFav = favoriteRooms.includes(msg.id);
        const url = `${getApiBase()}/api/chat/rooms/${msg.id}/favorite/`;
        const method = isFav ? 'DELETE' : 'POST';
        try {
            const csrftoken = getCookie('csrftoken');
            await fetch(url, {
                method,
                credentials: 'include',
                headers: { 'X-CSRFToken': csrftoken },
            });
            fetchMyFavoriteRooms();
        } catch (err) {
            alert('방 즐겨찾기 처리 실패: ' + err.message);
        }
    };

    const fetchMyFavoriteRooms = async () => {
        setFavoriteRoomsLoading(true);
        try {
            const response = await fetch(`${getApiBase()}/api/chat/rooms/my_favorites/`, {
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!response.ok) throw new Error('Failed to fetch favorite rooms');
            const data = await response.json();
            setFavoriteRooms(data.results ? data.results.map(r => r.id) : data.map(r => r.id));
        } catch (err) {
            // 무시
        } finally {
            setFavoriteRoomsLoading(false);
        }
    };
    useEffect(() => { fetchMyFavoriteRooms(); }, []);


    // 입력 debounce 처리
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedQuery(query), 250);
        return () => clearTimeout(handler);
    }, [query]);

    // 검색 결과 상태 관리
    const [results, setResults] = useState([]);
    useEffect(() => {
        setError(null);
        setLoading(true);
        try {
            if (!debouncedQuery) {
                setResults([]);
                setLoading(false);
                return;
            }
            let keywords = useAnd ? debouncedQuery.split(/\s+/).filter(Boolean) : [debouncedQuery];
            let regex = null;
            if (useRegex) {
                try { regex = new RegExp(debouncedQuery, 'i'); } catch { regex = null; }
            }
            const match = (text) => {
                if (!text) return false;
                if (regex) return regex.test(text);
                if (useAnd) return keywords.every(k => text.toLowerCase().includes(k.toLowerCase()));
                return text.toLowerCase().includes(debouncedQuery.toLowerCase());
            };
            let filtered = [];
            if (scope === 'all' || scope === 'room') {
                filtered = filtered.concat((rooms || []).filter(r => match(r.name)).map(r => ({ type: 'room', ...r })));
            }
            if (scope === 'all' || scope === 'message') {
                filtered = filtered.concat((messages || []).filter(m => match(m.content)).map(m => ({ type: 'message', ...m })));
            }
            if (scope === 'all' || scope === 'user') {
                filtered = filtered.concat((users || []).filter(u => match(u.username)).map(u => ({ type: 'user', ...u })));
            }
            // 정렬
            if (sortBy === 'date') {
                filtered.sort((a, b) => {
                    const dateA = a.date || a.created_at || new Date(0);
                    const dateB = b.date || b.created_at || new Date(0);
                    return new Date(dateB) - new Date(dateA);
                });
            } else {
                const getScore = (item) => {
                    let score = 0;
                    const text = (item.name || item.content || item.username || '').toLowerCase();
                    const queryLower = debouncedQuery.toLowerCase();
                    if (useAnd) {
                        const keywords = debouncedQuery.split(/\s+/).filter(Boolean);
                        score = keywords.filter(k => text.includes(k)).length;
                    } else {
                        if (text.includes(queryLower)) score += 2;
                        if (text.startsWith(queryLower)) score += 1;
                    }
                    return score;
                };
                filtered.sort((a, b) => getScore(b) - getScore(a));
            }
            setResults(filtered);
            setLoading(false);
        } catch (e) {
            setError('검색 중 오류가 발생했습니다.');
            setResults([]);
            setLoading(false);
        }
    }, [debouncedQuery, scope, useAnd, useRegex, sortBy, rooms, messages, users]);

    // API 기반 검색 useEffect
    useEffect(() => {
        if (!useApiSearch) return;
        if (!debouncedQuery) {
            setApiResults([]); setApiTotal(0); setLoading(false); return;
        }
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({
            query: debouncedQuery,
            scope,
            sort: sortBy,
            and: useAnd ? '1' : '0',
            regex: useRegex ? '1' : '0',
            page: apiPage,
            page_size: apiPageSize
        });
        fetch(`${getApiBase()}/api/search?${params.toString()}`, { credentials: 'include' })
            .then(res => res.json())
            .then(data => {
                setApiResults(data.results || []);
                setApiTotal(data.total || 0);
                setLoading(false);
            })
            .catch(() => {
                setError('검색 서버 오류');
                setApiResults([]);
                setApiTotal(0);
                setLoading(false);
            });
    }, [useApiSearch, debouncedQuery, scope, sortBy, useAnd, useRegex, apiPage, apiPageSize]);

    // 검색 결과 소스 결정
    const displayResults = useApiSearch ? apiResults : results;

    // displayResults를 타입별로 추가 필터링
    const filteredDisplayResults = resultTypeFilter === 'all' ? displayResults : displayResults.filter(r => r.type === resultTypeFilter);

    // 하이라이트 함수
    const highlight = (text) => {
        if (!query || !text) return text;
        let pattern = useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        try {
            const re = new RegExp(pattern, 'gi');
            return text.split(re).reduce((acc, part, i, arr) => {
                if (i < arr.length - 1) {
                    acc.push(part, <mark key={i}>{text.match(re)[i]}</mark>);
                } else {
                    acc.push(part);
                }
                return acc;
            }, []);
        } catch {
            return text;
        }
    };

    // 날짜 포맷 함수
    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        } else if (days === 1) {
            return '어제';
        } else if (days < 7) {
            return `${days}일 전`;
        } else {
            return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
        }
    };

    // 메시지 미리보기 생성 함수
    const getMessagePreview = (content, maxLength = 100) => {
        if (!content) return '';
        const cleanContent = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ');
        return cleanContent.length > maxLength
            ? cleanContent.substring(0, maxLength) + '...'
            : cleanContent;
    };

    // 검색 결과 클릭 핸들러
    const onResultClick = async (r) => {
        if (r.type === 'room') {
            setSelectedUser(null);
            navigate(`/room/${r.id}`);
            if (onClose) onClose();
        } else if (r.type === 'message') {
            setSelectedUser(null);
            navigate(`/room/${r.room_id}?messageId=${r.id}`);
            if (onClose) onClose();
        } else if (r.type === 'user') {
            setSelectedUser(r);
            // 1:1 채팅방 생성/이동 로직은 그대로 유지
            try {
                const getCookie = (name) => {
                    const value = `; ${document.cookie}`;
                    const parts = value.split(`; ${name}=`);
                    if (parts.length === 2) return parts.pop().split(';').shift();
                };
                const csrfToken = getCookie('csrftoken');
                const res = await fetch(`${getApiBase()}/api/chat/rooms/user_chat_alt/`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken,
                    },
                    body: JSON.stringify({ user_id: r.id }),
                });
                if (res.ok) {
                    const data = await res.json();
                    navigate(`/room/${data.id}`);
                    if (onClose) onClose();
                } else {
                    alert('1:1 채팅방 생성 실패');
                }
            } catch {
                alert('1:1 채팅방 생성 오류');
            }
        }
    };

    // 2. 메시지 미리보기 fetch 함수 (기존 fetchPreviewMessages와 유사, SearchModal 내부에서 구현)
    const fetchPreviewMessagesLocal = async (msg) => {
        if (!msg || !msg.room_id || !msg.id) return;
        setPreviewMessages([]); // 기존 메시지 초기화
        setPreviewLoading(true);
        try {
            // 기준 메시지 timestamp 가져오기
            const res = await fetch(`${getApiBase()}/api/chat/messages/${msg.id}/`);
            if (!res.ok) return;
            const baseMsg = await res.json();
            const baseTime = baseMsg.timestamp;
            // 이전 2개
            const prevRes = await fetch(`${getApiBase()}/api/chat/messages/?room=${msg.room_id}&before=${baseTime}&limit=2`);
            const prevMsgs = prevRes.ok ? (await prevRes.json()).results || [] : [];
            // 이후 2개
            const nextRes = await fetch(`${getApiBase()}/api/chat/messages/?room=${msg.room_id}&after=${baseTime}&limit=2`);
            const nextMsgs = nextRes.ok ? (await nextRes.json()).results || [] : [];
            // 기준 메시지
            const centerMsg = { ...msg, isCenter: true };
            setPreviewMessages([...prevMsgs, centerMsg, ...nextMsgs]);
        } catch { }
        setPreviewLoading(false);
    };

    // 3. handlePreview 함수에서 fetchPreviewMessagesLocal 호출
    const handlePreview = (msg) => {
        fetchPreviewMessagesLocal(msg);
    };

    // 4. renderResultItem 내 메시지(li)에서 메시지 타입일 때 onClick에 handlePreview(r) 연결
    // (이미 적용되어 있으면 유지)

    // 1. 방 클릭 시 최신 메시지 10개를 미리보기 정보창에 표시
    const handleRoomPreview = async (room) => {
        setPreviewMessages([]); // 기존 메시지 초기화
        setPreviewLoading(true);
        try {
            const res = await fetch(`${getApiBase()}/api/chat/messages/?room=${room.id}&limit=10&ordering=-timestamp`);
            if (!res.ok) throw new Error('메시지 불러오기 실패');
            let data = await res.json();
            let msgs = data.results || data;
            // 최신순 정렬이므로, 시간순으로 다시 정렬
            msgs = msgs.slice().reverse();
            setPreviewMessages(msgs);
        } catch { }
        setPreviewLoading(false);
    };

    // 5. 하단에 미리보기 정보창 UI 추가 (대기방 정보창과 유사하게)
    // SearchModal return문 하단에 추가
    {
        previewMessages.length > 0 && (
            <div className="search-preview-box" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 9999, background: '#181c24', borderTop: '2px solid #1976d2', padding: 12, marginTop: 0, maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' }}>
                <div style={{ fontWeight: 700, color: '#1976d2', marginBottom: 6 }}>미리보기</div>
                {previewLoading ? (
                    <div style={{ color: '#888' }}>불러오는 중...</div>
                ) : previewMessages.length === 0 ? (
                    <div style={{ color: '#888' }}>미리보기 메시지가 없습니다.</div>
                ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {previewMessages.slice(-5).map(m => (
                            <li key={m.id} className={m.id === tempHighlightId ? 'temp-highlight' : ''} style={{ padding: '6px 0', borderBottom: '1px solid #222', fontWeight: m.isCenter ? 700 : 400, background: m.isCenter ? 'transparent' : 'transparent', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, color: '#1976d2', fontWeight: 600 }}>{m.room_id ? `방 #${m.room_id}` : ''}</div>
                                    <div style={{ fontSize: 14, color: '#fff', margin: '2px 0' }}>{m.content}</div>
                                    <div style={{ fontSize: 11, color: '#888' }}>{m.sender} | {m.timestamp ? new Date(m.timestamp).toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : ''}</div>
                                </div>
                                {/* 복사 버튼 */}
                                <button
                                    className="search-copy-btn"
                                    style={{ fontSize: 13, color: '#2196f3', background: 'none', border: 'none', cursor: 'pointer', alignSelf: 'flex-end', marginLeft: 'auto' }}
                                    title="복사"
                                    onClick={e => { e.stopPropagation(); copy(m.content); }}
                                >📋</button>
                                {/* 즐겨찾기 토글 버튼 */}
                                <button
                                    className="favorite-btn"
                                    style={{ fontSize: 18, color: favoriteMessages.includes(m.id) ? '#1976d2' : '#bbb', background: 'none', border: 'none', cursor: 'pointer' }}
                                    title={favoriteMessages.includes(m.id) ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                                    onClick={e => { e.stopPropagation(); handleToggleFavoriteMessage(m); }}
                                >{favoriteMessages.includes(m.id) ? '★' : '☆'}</button>
                                {/* 입장 버튼: room_id가 존재하면 무조건 이동 */}
                                <button
                                    className="search-enter-btn"
                                    style={{ fontSize: 14, color: '#1976d2', background: 'none', border: '1px solid #1976d2', borderRadius: 4, padding: '2px 10px', cursor: 'pointer', marginLeft: 4 }}
                                    title="입장"
                                    onClick={e => {
                                        e.stopPropagation();
                                        if (onClose) onClose();
                                        navigate(`/room/${m.room_id}?messageId=${m.id}`);
                                    }}
                                >입장</button>
                            </li>
                        ))}
                    </ul>
                )}
                {/* 유저 정보 미리보기: 유저 검색 결과 클릭 시 */}
                {selectedUser && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, padding: 16, background: '#222', borderRadius: 12 }}>
                        {/* 프로필 사진 자리(회색 원형) */}
                        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#bbb' }}>
                            {/* 추후 프로필 이미지 들어갈 자리 */}
                            <span>👤</span>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 18, color: '#fff' }}>{selectedUser.username}</div>
                            <div style={{ fontSize: 14, color: '#bbb', marginTop: 4 }}>가입일: {selectedUser.date_joined ? new Date(selectedUser.date_joined).toLocaleDateString('ko-KR') : '알 수 없음'}</div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // (4) 메시지 입장
    const handleEnterRoom = (room) => {
        navigate(`/room/${room.id}`);
        if (onClose) onClose();
    };

    const handleStartChat = async (user) => {
        try {
            const getCookie = (name) => {
                const value = `; ${document.cookie}`;
                const parts = value.split(`; ${name}=`);
                if (parts.length === 2) return parts.pop().split(';').shift();
            };
            const csrfToken = getCookie('csrftoken');
            const res = await fetch(`${getApiBase()}/api/chat/rooms/user_chat_alt/`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken,
                },
                body: JSON.stringify({ user_id: user.id }),
            });
            if (res.ok) {
                const data = await res.json();
                navigate(`/room/${data.id}`);
                if (onClose) onClose();
            } else {
                alert('1:1 채팅방 생성 실패');
            }
        } catch {
            alert('1:1 채팅방 생성 오류');
        }
    };

    // 키보드 네비게이션 핸들러
    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowDown') {
                setActiveIndex(prev => Math.min(filteredDisplayResults.length - 1, prev + 1));
                e.preventDefault();
            } else if (e.key === 'ArrowUp') {
                setActiveIndex(prev => Math.max(0, prev - 1));
                e.preventDefault();
            } else if (e.key === 'Enter') {
                if (activeIndex >= 0 && activeIndex < filteredDisplayResults.length) {
                    onResultClick(filteredDisplayResults[activeIndex]);
                }
            } else if (e.key === 'Escape') {
                if (onClose) onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, filteredDisplayResults, activeIndex]);
    // 결과가 바뀌면 activeIndex 초기화
    useEffect(() => { setActiveIndex(-1); }, [filteredDisplayResults]);

    // 멀티셀렉트 핸들러
    const handleResultClick = (index, e) => {
        if (e.ctrlKey || e.metaKey) {
            setSelectedIndexes(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]);
        } else if (e.shiftKey && selectedIndexes.length > 0) {
            const last = selectedIndexes[selectedIndexes.length - 1];
            const [start, end] = [Math.min(last, index), Math.max(last, index)];
            const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);
            setSelectedIndexes(prev => Array.from(new Set([...prev, ...range])));
        } else {
            setSelectedIndexes([index]);
        }
        setActiveIndex(index);
    };
    // 복사 버튼 핸들러
    const handleCopySelected = () => {
        const items = selectedIndexes.map(i => filteredDisplayResults[i]);
        const text = items.map(r => {
            if (r.type === 'message') return `[${rooms.find(room => room.id === r.room_id)?.name || ''}] ${r.sender || r.username || ''}: ${r.content}`;
            if (r.type === 'room') return `[방] ${r.name}`;
            if (r.type === 'user') return `[유저] ${r.username}`;
            return '';
        }).join('\n');
        navigator.clipboard.writeText(text);
    };

    // 복사 버튼 클릭 핸들러 (copy-to-clipboard 사용)
    const handleCopy = (r, index) => {
        const text =
            r.type === 'message' ? `${r.sender || r.username || ''}: ${r.content || ''}` :
                r.type === 'room' ? `방: ${r.name}` :
                    r.type === 'user' ? `유저: ${r.username}` : '';
        copy(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(-1), 1200);
    };

    // 검색 결과 렌더링 함수 (일부만 발췌)
    const renderResultItem = ({ index, style }) => {
        const r = filteredDisplayResults[index];
        const isSelected = selectedIndexes.includes(index);
        return (
            <li
                key={index}
                className={`search-result-item${index === activeIndex ? ' active' : ''}${isSelected ? ' selected' : ''}`}
                style={style}
                onClick={r.type === 'message' ? (e => { handlePreview(r); handleResultClick(index, e); }) : r.type === 'room' ? (e => { handleRoomPreview(r); handleResultClick(index, e); }) : (e => handleResultClick(index, e))}
                ref={index === activeIndex ? resultListRef : undefined}
            >
                <div className="search-result-header">
                    <span className={`search-result-type${r.type === 'message' ? ' message' : r.type === 'user' ? ' user' : ''}`}>[{r.type === 'room' ? '방' : r.type === 'message' ? '메시지' : '유저'}]</span>
                    {r.type === 'room' && <span className="search-result-room">{highlight(r.name)}</span>}
                    {r.type === 'user' && <span className="search-result-user">{highlight(r.username)}</span>}
                    {r.type === 'message' && (
                        <>
                            <span className="search-result-room" style={{ color: '#1976d2', fontWeight: 600, marginLeft: 6 }}>{rooms.find(room => room.id === r.room_id)?.name || '알 수 없음'}</span>
                            <span className="search-result-sender" style={{ color: '#555', marginLeft: 8 }}>{r.sender || r.username || '익명'}</span>
                            <span className="search-result-date" style={{ color: '#aaa', marginLeft: 8, fontSize: 12 }}>{formatDate(r.date || r.created_at)}</span>
                        </>
                    )}
                    <button
                        className="search-copy-btn"
                        style={{ marginLeft: 8, fontSize: 13, color: '#2196f3', background: 'none', border: 'none', cursor: 'pointer' }}
                        title="복사"
                        onClick={e => { e.stopPropagation(); handleCopy(r, index); }}
                    >
                        {copiedIndex === index ? '✅' : '📋'}
                    </button>
                    {/* 즐겨찾기 버튼 */}
                    {r.type === 'room' && (
                        <>
                            <button
                                className="search-favorite-btn"
                                style={{ marginLeft: 8, fontSize: 18, color: favoriteRooms.includes(r.id) ? '#FFD600' : '#bbb', background: 'none', border: 'none', cursor: 'pointer' }}
                                title={favoriteRooms.includes(r.id) ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                                onClick={e => { e.stopPropagation(); handleToggleFavorite(r); }}
                            >
                                {favoriteRooms.includes(r.id) ? '★' : '☆'}
                            </button>
                            <button
                                className="search-enter-btn"
                                style={{ marginLeft: 8, fontSize: 15, color: '#1976d2', background: 'none', border: 'none', cursor: 'pointer' }}
                                title="입장"
                                onClick={e => { e.stopPropagation(); handleEnterRoom(r); }}
                            >입장</button>
                        </>
                    )}
                    {r.type === 'message' && (
                        <>
                            <button
                                className="search-favorite-btn"
                                style={{
                                    marginLeft: 8,
                                    fontSize: 18,
                                    color: favoriteMessages.includes(r.id) ? '#FFD600' : '#bbb',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer'
                                }}
                                title={favoriteMessages.includes(r.id) ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                                onClick={e => { e.stopPropagation(); handleToggleFavoriteMessage(r, index); }}
                            >
                                {favoriteMessages.includes(r.id) ? '★' : '☆'}
                            </button>
                            <button
                                className="search-enter-btn"
                                style={{
                                    marginLeft: 8,
                                    fontSize: 15,
                                    color: '#1976d2',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer'
                                }}
                                title="입장"
                                onClick={async e => {
                                    e.stopPropagation();
                                    try {
                                        const res = await fetch(`${getApiBase()}/api/chat/rooms/${r.room_id}/`, {
                                            credentials: 'include'
                                        });
                                        if (!res.ok) {
                                            alert('존재하지 않는 방입니다');
                                            return;
                                        }
                                        if (onClose) onClose();
                                        navigate(`/room/${r.room_id}?messageId=${r.id}`);
                                    } catch {
                                        alert('방 정보 확인 중 오류가 발생했습니다');
                                    }
                                }}
                            >입장</button>
                        </>
                    )}
                    {r.type === 'user' && (
                        <button
                            className="search-chat-btn"
                            style={{ marginLeft: 8, fontSize: 15, color: '#1976d2', background: 'none', border: 'none', cursor: 'pointer' }}
                            title="1:1 대화"
                            onClick={e => { e.stopPropagation(); handleStartChat(r); }}
                        >1:1 대화</button>
                    )}
                </div>
                {r.type === 'message' && (
                    <div className="search-result-preview" style={{ fontSize: 14, color: '#333', marginTop: 2 }}>
                        {(() => {
                            const content = r.content || '';
                            const idx = content.toLowerCase().indexOf(debouncedQuery.toLowerCase());
                            let preview = content;
                            if (idx !== -1) {
                                const start = Math.max(0, idx - 20);
                                const end = Math.min(content.length, idx + debouncedQuery.length + 20);
                                preview = (start > 0 ? '...' : '') + content.slice(start, end) + (end < content.length ? '...' : '');
                            }
                            return highlight(preview);
                        })()}
                    </div>
                )}
                {r.type === 'room' && <div className="search-result-preview" style={{ fontSize: 14, color: '#333', marginTop: 2 }}>{highlight(r.name)}</div>}
                {r.type === 'user' && <div className="search-result-preview" style={{ fontSize: 14, color: '#333', marginTop: 2 }}>{highlight(r.username)}</div>}
            </li>
        );
    };

    // 가상화/일반 리스트 모두에서 activeIndex에 따라 스크롤 보정
    useEffect(() => {
        if (activeIndex < 0) return;
        if (resultListRef.current) {
            resultListRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [activeIndex]);

    if (!open) return null;
    return (
        <div className="search-modal-overlay" onClick={onClose}>
            <div className="search-modal" onClick={e => e.stopPropagation()}>
                <div style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    background: '#222',
                    padding: '12px 0 8px 0',
                    borderBottom: '1px solid #333',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                }}>
                    <select value={scope} onChange={e => setScope(e.target.value)} style={{ fontSize: 14 }}>
                        <option value="all">전체</option>
                        <option value="message">메시지</option>
                        <option value="room">방</option>
                        <option value="user">유저</option>
                    </select>
                    <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ fontSize: 14 }}>
                        <option value="relevance">정확도순</option>
                        <option value="date">최신순</option>
                    </select>
                    <label style={{ fontSize: 13 }}><input type="checkbox" checked={useAnd} onChange={e => setUseAnd(e.target.checked)} /> AND</label>
                    <label style={{ fontSize: 13 }}><input type="checkbox" checked={useRegex} onChange={e => setUseRegex(e.target.checked)} /> 정규식</label>
                    <label style={{ fontSize: 13 }}><input type="checkbox" checked={useApiSearch} onChange={e => setUseApiSearch(e.target.checked)} /> API 검색</label>
                    <button className="search-modal-close" onClick={onClose} aria-label="닫기" style={{ fontSize: 22, background: 'none', border: 'none', color: '#fff', cursor: 'pointer', marginLeft: 8 }}>✕</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="검색어를 입력하세요"
                        style={{ flex: 1, fontSize: 16, padding: '8px 12px', borderRadius: 8, border: '1px solid #333', background: '#222', color: '#fff' }}
                        onKeyDown={e => { if (e.key === 'Enter') setDebouncedQuery(query); }}
                    />
                    <button
                        className="search-copy-btn"
                        style={{ fontSize: 18, color: '#2196f3', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 4, padding: 4 }}
                        title="검색 결과 복사"
                        onClick={handleCopySelected}
                    >📋</button>
                </div>
                <div className="search-modal-content">
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => setResultTypeFilter('all')} style={{ fontWeight: resultTypeFilter === 'all' ? 700 : 400 }}>전체</button>
                            <button onClick={() => setResultTypeFilter('message')} style={{ fontWeight: resultTypeFilter === 'message' ? 700 : 400 }}>메시지</button>
                            <button onClick={() => setResultTypeFilter('room')} style={{ fontWeight: resultTypeFilter === 'room' ? 700 : 400 }}>방</button>
                            <button onClick={() => setResultTypeFilter('user')} style={{ fontWeight: resultTypeFilter === 'user' ? 700 : 400 }}>유저</button>
                        </div>
                    </div>
                    {query && (
                        <ul className="search-result-list">
                            {loading ? (
                                <li className="search-result-loading">검색 중...</li>
                            ) : error ? (
                                <li className="search-result-error">{error}</li>
                            ) : filteredDisplayResults.length === 0 ? (
                                <li className="search-result-empty">검색 결과가 없습니다.</li>
                            ) : filteredDisplayResults.length >= 100 ? (
                                <List
                                    height={Math.min(480, filteredDisplayResults.length * 64)}
                                    itemCount={filteredDisplayResults.length}
                                    itemSize={64}
                                    width={"100%"}
                                    style={{ background: 'none' }}
                                >
                                    {({ index, style }) => renderResultItem({ index, style, results: filteredDisplayResults })}
                                </List>
                            ) : (
                                filteredDisplayResults.map((r, i) => renderResultItem({ index: i, style: {}, results: filteredDisplayResults }))
                            )}
                        </ul>
                    )}
                    {useApiSearch && apiTotal > apiPageSize && (
                        <div style={{ textAlign: 'center', margin: '8px 0' }}>
                            <button disabled={apiPage === 1} onClick={() => setApiPage(apiPage - 1)}>이전</button>
                            <span style={{ margin: '0 12px' }}>{apiPage} / {Math.ceil(apiTotal / apiPageSize)}</span>
                            <button disabled={apiPage * apiPageSize >= apiTotal} onClick={() => setApiPage(apiPage + 1)}>다음</button>
                        </div>
                    )}
                    {selectedIndexes.length > 0 && (
                        <button style={{ margin: '8px 0', fontWeight: 600, background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', cursor: 'pointer' }} onClick={handleCopySelected}>
                            선택 항목 복사 ({selectedIndexes.length})
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
} 