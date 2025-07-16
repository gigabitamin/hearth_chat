import React, { useState, useEffect } from 'react';
import './NotifyModal.css';

export default function NotifyModal({ open, onClose, notifications = [], onNotificationRead }) {
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
                                <li key={i} className={`notify-item ${n.read ? 'read' : 'unread'}`}>
                                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{n.roomName}</div>
                                    <div style={{ fontSize: 13, color: '#555' }}>
                                        <span style={{ fontWeight: 500 }}>{n.sender}:</span> {n.latestMessage}
                                    </div>
                                    <div style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>{n.timestamp && (new Date(n.timestamp)).toLocaleString()}</div>
                                    <button
                                        className={`notify-enter-btn ${n.read ? 'read' : 'unread'}`}
                                        onClick={() => {
                                            if (onNotificationRead) onNotificationRead(n.id);
                                            const url = n.messageId
                                                ? `/room/${n.roomId}?messageId=${n.messageId}`
                                                : `/room/${n.roomId}`;
                                            window.location.href = url;
                                        }}
                                    >
                                        입장
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
} 