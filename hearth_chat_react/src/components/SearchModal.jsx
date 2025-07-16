import React, { useState, useEffect } from 'react';
import './SearchModal.css';
import { useNavigate } from 'react-router-dom';
import { FixedSizeList as List } from 'react-window';

export default function SearchModal({ open, onClose, rooms = [], messages = [], users = [] }) {
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
        fetch(`/api/search?${params.toString()}`, { credentials: 'include' })
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
            navigate(`/room/${r.id}`);
            if (onClose) onClose();
        } else if (r.type === 'message') {
            navigate(`/room/${r.room_id}?messageId=${r.id}`);
            if (onClose) onClose();
        } else if (r.type === 'user') {
            // 1:1 채팅방 생성/이동
            try {
                const getCookie = (name) => {
                    const value = `; ${document.cookie}`;
                    const parts = value.split(`; ${name}=`);
                    if (parts.length === 2) return parts.pop().split(';').shift();
                };

                const csrfToken = getCookie('csrftoken');

                const res = await fetch('http://localhost:8000/api/chat/rooms/user_chat_alt/', {
                    method: 'POST',
                    credentials: 'include', // 세션 쿠키 전송
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

    const renderResultItem = ({ index, style }) => {
        const r = filteredDisplayResults[index];
        const isSelected = selectedIndexes.includes(index);
        return (
            <li
                key={index}
                className={`search-result-item${index === activeIndex ? ' active' : ''}${isSelected ? ' selected' : ''}`}
                style={style}
                onClick={e => handleResultClick(index, e)}
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
                <div className="search-modal-header">
                    <span>검색</span>
                    <button className="search-modal-close" onClick={onClose} aria-label="닫기">✕</button>
                </div>
                <div className="search-modal-content">
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                        <select value={scope} onChange={e => setScope(e.target.value)} style={{ fontSize: 14 }}>
                            <option value="all">전체</option>
                            <option value="room">방</option>
                            <option value="message">메시지</option>
                            <option value="user">유저</option>
                        </select>
                        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ fontSize: 14 }}>
                            <option value="relevance">정확도순</option>
                            <option value="date">최신순</option>
                        </select>
                        <label style={{ fontSize: 13 }}><input type="checkbox" checked={useAnd} onChange={e => setUseAnd(e.target.checked)} /> AND</label>
                        <label style={{ fontSize: 13 }}><input type="checkbox" checked={useRegex} onChange={e => setUseRegex(e.target.checked)} /> 정규식</label>
                        <label style={{ fontSize: 13 }}><input type="checkbox" checked={useApiSearch} onChange={e => setUseApiSearch(e.target.checked)} /> API 검색</label>
                        <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => setResultTypeFilter('all')} style={{ fontWeight: resultTypeFilter === 'all' ? 700 : 400 }}>전체</button>
                            <button onClick={() => setResultTypeFilter('message')} style={{ fontWeight: resultTypeFilter === 'message' ? 700 : 400 }}>메시지</button>
                            <button onClick={() => setResultTypeFilter('room')} style={{ fontWeight: resultTypeFilter === 'room' ? 700 : 400 }}>방</button>
                            <button onClick={() => setResultTypeFilter('user')} style={{ fontWeight: resultTypeFilter === 'user' ? 700 : 400 }}>유저</button>
                        </div>
                    </div>
                    <input
                        className="search-input"
                        type="text"
                        placeholder="채팅방, 메시지, 사용자 검색..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        autoFocus
                    />
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