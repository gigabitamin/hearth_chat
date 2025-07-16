import React, { useState, useEffect } from 'react';
import './NotifyModal.css';

export default function NotifyModal({ open, onClose, notifications = [], onNotificationRead, unreadList = [], onMarkAllAsRead }) {
    if (!open) return null;
    return (
        <div className="notify-modal-overlay" onClick={onClose}>
            <div className="notify-modal" onClick={e => e.stopPropagation()}>
                <div className="notify-modal-header">
                    <span>알림</span>
                    {unreadList.length > 0 && (
                        <button className="notify-markall-btn" onClick={onMarkAllAsRead} style={{ marginLeft: 12, fontSize: 13, padding: '2px 8px', borderRadius: 4, border: '1px solid #ddd', background: '#f7f7f7', cursor: 'pointer' }}>전체 읽음</button>
                    )}
                    <button className="notify-modal-close" onClick={onClose} aria-label="닫기">✕</button>
                </div>
                <div className="notify-modal-content">
                    {notifications.length === 0 ? (
                        <div className="notify-empty">새로운 알림이 없습니다.</div>
                    ) : (
                        <ul className="notify-list">
                            {notifications.map((n, i) => {
                                const isUnread = unreadList.some(u => u.message_id === n.messageId);
                                return (
                                    <li key={i} className={`notify-item ${isUnread ? 'unread' : 'read'}`}>
                                        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{n.roomName}</div>
                                        <div style={{ fontSize: 13, color: '#555' }}>
                                            <span style={{ fontWeight: 500 }}>{n.sender}:</span> {n.latestMessage}
                                        </div>
                                        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>{n.timestamp && (new Date(n.timestamp)).toLocaleString()}</div>
                                        <button
                                            className={`notify-enter-btn ${isUnread ? 'unread' : 'read'}`}
                                            onClick={() => {
                                                if (onNotificationRead) onNotificationRead(n.id, n.roomId, n.messageId);
                                                const url = n.messageId
                                                    ? `/room/${n.roomId}?messageId=${n.messageId}`
                                                    : `/room/${n.roomId}`;
                                                window.location.href = url;
                                            }}
                                        >
                                            입장
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
} 