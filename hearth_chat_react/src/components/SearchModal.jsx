import React, { useState } from 'react';
import './SearchModal.css';
import { useNavigate } from 'react-router-dom';

export default function SearchModal({ open, onClose, rooms = [], messages = [], users = [] }) {
    const [query, setQuery] = useState('');
    const [scope, setScope] = useState('all'); // all, room, message, user
    const [useAnd, setUseAnd] = useState(false);
    const [useRegex, setUseRegex] = useState(false);
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

    // 검색 결과 클릭 핸들러
    const onResultClick = async (r) => {
        if (r.type === 'room') {
            navigate(`/room/${r.id}`);
            if (onClose) onClose();
        } else if (r.type === 'message') {
            navigate(`/room/${r.room_id}`);
            if (onClose) onClose();
            // 메시지 강조(추후 구현 가능)
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
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <select value={scope} onChange={e => setScope(e.target.value)} style={{ fontSize: 14 }}>
                            <option value="all">전체</option>
                            <option value="room">방</option>
                            <option value="message">메시지</option>
                            <option value="user">유저</option>
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
                                    <li key={i} className="search-result-item" style={{ cursor: 'pointer' }} onClick={() => onResultClick(r)}>
                                        {r.type === 'room' && <span style={{ color: '#2196f3', fontWeight: 600 }}>[방]</span>}
                                        {r.type === 'message' && <span style={{ color: '#4caf50', fontWeight: 600 }}>[메시지]</span>}
                                        {r.type === 'user' && <span style={{ color: '#ff9800', fontWeight: 600 }}>[유저]</span>}
                                        {' '}
                                        {r.type === 'room' && highlight(r.name)}
                                        {r.type === 'message' && <>{highlight(r.content)} <span style={{ color: '#888', fontSize: 12 }}>({r.room_name})</span></>}
                                        {r.type === 'user' && highlight(r.username)}
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