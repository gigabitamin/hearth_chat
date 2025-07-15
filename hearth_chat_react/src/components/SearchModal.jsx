import React, { useState } from 'react';
import './SearchModal.css';

export default function SearchModal({ open, onClose }) {
    const [query, setQuery] = useState('');
    // 더미 검색 결과
    const results = query
        ? [
            { id: 1, text: '테스트 채팅방 1' },
            { id: 2, text: '테스트 채팅방 2' },
            { id: 3, text: '테스트 채팅방 3' },
        ]
        : [];
    if (!open) return null;
    return (
        <div className="search-modal-overlay" onClick={onClose}>
            <div className="search-modal" onClick={e => e.stopPropagation()}>
                <div className="search-modal-header">
                    <span>검색</span>
                    <button className="search-modal-close" onClick={onClose} aria-label="닫기">✕</button>
                </div>
                <div className="search-modal-content">
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
                                results.map(r => (
                                    <li key={r.id} className="search-result-item">{r.text}</li>
                                ))
                            )}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
} 