import React from 'react';
import './NotifyModal.css';

export default function NotifyModal({ open, onClose, notifications = [] }) {
    if (!open) return null;
    return (
        <div className="notify-modal-overlay" onClick={onClose}>
            <div className="notify-modal" onClick={e => e.stopPropagation()}>
                <div className="notify-modal-header">
                    <span>알림</span>
                    <button className="notify-modal-close" onClick={onClose} aria-label="닫기">✕</button>
                </div>
                <div className="notify-modal-content">
                    {notifications.length === 0 ? (
                        <div className="notify-empty">새로운 알림이 없습니다.</div>
                    ) : (
                        <ul className="notify-list">
                            {notifications.map((n, i) => (
                                <li key={i} className="notify-item">{n.text}</li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
} 