import React, { useState } from 'react';
import './SearchModal.css';
import { useNavigate } from 'react-router-dom';

export default function SearchModal({ open, onClose, rooms = [], messages = [], users = [] }) {
    const [query, setQuery] = useState('');
    const [scope, setScope] = useState('all'); // all, room, message, user
    const [useAnd, setUseAnd] = useState(false);
    const [useRegex, setUseRegex] = useState(false);
    const [sortBy, setSortBy] = useState('relevance'); // relevance, date
    const navigate = useNavigate();

    // 프론트 필터링 함수
    const filterItems = () => {
        if (!query) return [];
        let keywords = useAnd ? query.split(/\s+/).filter(Boolean) : [query];
        let regex = null;
        if (useRegex) {
            try { regex = new RegExp(query, 'i'); } catch { regex = null; }
        }
        const match = (text) => {
            if (!text) return false;
            if (regex) return regex.test(text);
            if (useAnd) return keywords.every(k => text.toLowerCase().includes(k.toLowerCase()));
            return text.toLowerCase().includes(query.toLowerCase());
        };
        let results = [];
        if (scope === 'all' || scope === 'room') {
            results = results.concat((rooms || []).filter(r => match(r.name)).map(r => ({ type: 'room', ...r })));
        }
        if (scope === 'all' || scope === 'message') {
            results = results.concat((messages || []).filter(m => match(m.content)).map(m => ({ type: 'message', ...m })));
        }
        if (scope === 'all' || scope === 'user') {
            results = results.concat((users || []).filter(u => match(u.username)).map(u => ({ type: 'user', ...u })));
        }

        // 정렬 로직
        if (sortBy === 'date') {
            results.sort((a, b) => {
                const dateA = a.date || a.created_at || new Date(0);
                const dateB = b.date || b.created_at || new Date(0);
                return new Date(dateB) - new Date(dateA);
            });
        } else {
            // 정확도순 정렬 (키워드 매칭 개수 기준)
            results.sort((a, b) => {
                const getScore = (item) => {
                    let score = 0;
                    const text = (item.name || item.content || item.username || '').toLowerCase();
                    const queryLower = query.toLowerCase();

                    if (useAnd) {
                        const keywords = query.split(/\s+/).filter(Boolean);
                        score = keywords.filter(k => text.includes(k)).length;
                    } else {
                        if (text.includes(queryLower)) score += 2;
                        if (text.startsWith(queryLower)) score += 1;
                    }
                    return score;
                };
                return getScore(b) - getScore(a);
            });
        }

        return results;
    };
    const results = filterItems();

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
                const res = await fetch('/api/chat/rooms/user_chat/', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
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
                            {results.length === 0 ? (
                                <li className="search-result-empty">검색 결과가 없습니다.</li>
                            ) : (
                                results.map((r, i) => (
                                    <li key={i} className="search-result-item" onClick={() => onResultClick(r)}>
                                        <div className="search-result-header">
                                            <span className={`search-result-type${r.type === 'message' ? ' message' : r.type === 'user' ? ' user' : ''}`}>[{r.type === 'room' ? '방' : r.type === 'message' ? '메시지' : '유저'}]</span>
                                            {r.type === 'room' && <span className="search-result-room">{highlight(r.name)}</span>}
                                            {r.type === 'message' && <span className="search-result-room">{r.room_name}</span>}
                                            {r.type === 'user' && <span className="search-result-username">{highlight(r.username)}</span>}
                                            <span className="search-result-date">{formatDate(r.date || r.created_at || r.timestamp)}</span>
                                        </div>
                                        {r.type === 'message' && (
                                            <div className="search-result-preview">
                                                {highlight(getMessagePreview(r.content))}
                                            </div>
                                        )}
                                        {r.type === 'room' && r.description && (
                                            <div className="search-result-preview">{highlight(getMessagePreview(r.description, 80))}</div>
                                        )}
                                    </li>
                                ))
                            )}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
} 