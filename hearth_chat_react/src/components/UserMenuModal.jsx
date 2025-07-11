import React, { useEffect, useState } from 'react';
import './LoginModal.css';

const API_BASE = '/chat/api';

export default function UserMenuModal({ isOpen, onClose }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [logoutLoading, setLogoutLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            fetch(`${API_BASE}/user/`, { credentials: 'include' })
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        setUser(data.user);
                        setError(null);
                    } else {
                        setUser(null);
                        setError(data.message || '로그인 정보 없음');
                    }
                })
                .catch(() => setError('서버 오류'))
                .finally(() => setLoading(false));
        }
    }, [isOpen]);

    const handleLogout = async () => {
        setLogoutLoading(true);
        await fetch(`${API_BASE}/logout/`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
        });
        setLogoutLoading(false);
        setUser(null);
        onClose();
        window.location.reload(); // 상태 갱신을 위해 새로고침
    };

    if (!isOpen) return null;

    return (
        <div className="login-modal-overlay" onClick={onClose}>
            <div className="login-modal" onClick={e => e.stopPropagation()}>
                <div className="login-modal-header">
                    <h2>내 계정</h2>
                    <button className="login-modal-close" onClick={onClose} aria-label="닫기">✕</button>
                </div>
                <div className="login-modal-content">
                    {loading ? (
                        <div>로딩 중...</div>
                    ) : error ? (
                        <div style={{ color: 'red', textAlign: 'center' }}>{error}</div>
                    ) : user ? (
                        <>
                            <div style={{ textAlign: 'center', marginBottom: 16 }}>
                                <div style={{ fontWeight: 600, fontSize: 20 }}>{user.username}</div>
                                <div style={{ color: '#888', fontSize: 15 }}>{user.email}</div>
                            </div>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                <li>
                                    <button className="login-modal-submit" style={{ width: '100%', marginBottom: 8 }} disabled>
                                        이메일 변경 (UI만)
                                    </button>
                                </li>
                                <li>
                                    <button className="login-modal-submit" style={{ width: '100%', marginBottom: 8 }} disabled>
                                        비밀번호 변경 (UI만)
                                    </button>
                                </li>
                                <li>
                                    <button className="login-modal-submit" style={{ width: '100%', marginBottom: 8 }} disabled>
                                        계정 연결 (UI만)
                                    </button>
                                </li>
                                <li>
                                    <button className="login-modal-submit" style={{ width: '100%', background: '#eee', color: '#333' }} onClick={handleLogout} disabled={logoutLoading}>
                                        {logoutLoading ? '로그아웃 중...' : '로그아웃'}
                                    </button>
                                </li>
                            </ul>
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    );
} 