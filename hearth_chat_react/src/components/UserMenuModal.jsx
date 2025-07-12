import React, { useEffect, useState } from 'react';
import './LoginModal.css';

const API_BASE = '/chat/api';
// 환경변수 기반 ALLAUTH_BASE 자동 설정
const ALLAUTH_BASE = (process.env.REACT_APP_API_BASE || (window.location.origin + '/accounts'));

const SOCIAL_PROVIDERS = [
    { provider: 'google', label: 'Google' },
    { provider: 'kakao', label: 'Kakao' },
    { provider: 'naver', label: 'Naver' },
    { provider: 'github', label: 'GitHub' },
];

function getProviderLabel(provider) {
    if (provider === 'google') return 'Google';
    if (provider === 'kakao') return 'Kakao';
    if (provider === 'naver') return 'Naver';
    if (provider === 'github') return 'GitHub';
    return provider;
}

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

export default function UserMenuModal({ isOpen, onClose }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [logoutLoading, setLogoutLoading] = useState(false);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showConnectionsModal, setShowConnectionsModal] = useState(false);

    // 이메일 변경 상태
    const [emailForm, setEmailForm] = useState('');
    const [emailMsg, setEmailMsg] = useState(null);
    // 비밀번호 변경 상태
    const [pwForm, setPwForm] = useState({ old: '', pw1: '', pw2: '' });
    const [pwMsg, setPwMsg] = useState(null);

    // 계정 연결 상태
    const [connections, setConnections] = useState([]);
    const [connMsg, setConnMsg] = useState(null);

    // 계정 연결 상태 fetch 함수 분리 (JSON API 사용)
    const fetchConnections = () => {
        fetch('http://localhost:8000/api/social-connections/', { credentials: 'include' })
            .then(res => res.json())
            .then(data => {
                setConnections(data.social_accounts || []);
            })
            .catch(() => setConnections([]));
    };

    // 계정 연결 모달 열릴 때 목록 조회
    useEffect(() => {
        if (showConnectionsModal) {
            fetchConnections();
        }
    }, [showConnectionsModal]);

    // 소셜 계정 해제
    const handleDisconnect = async (provider) => {
        setConnMsg(null);
        const csrftoken = getCookie('csrftoken');
        const form = new FormData();
        form.append('action', 'disconnect');
        form.append('account', provider);
        try {
            const res = await fetch('http://localhost:8000/accounts/connections/', {
                method: 'POST',
                credentials: 'include',
                headers: { 'X-CSRFToken': csrftoken },
                body: form,
            });
            if (res.ok) {
                setConnMsg('연결 해제 성공');
                // 목록 갱신
                fetchConnections();
            } else {
                setConnMsg('연결 해제 실패');
            }
        } catch {
            setConnMsg('서버 오류');
        }
    };

    // 소셜 계정 연결(팝업)
    const handleConnect = (provider) => {
        const popup = window.open(
            `http://localhost:8000/accounts/${provider}/login/?process=connect`,
            'social_connect',
            'width=600,height=700'
        );
        // 팝업에서 인증 완료 후 postMessage로 알림
        const listener = (event) => {
            if (event.data === 'social_connected') {
                setShowConnectionsModal(false);
                setConnMsg('연결 성공!');
                window.removeEventListener('message', listener);
                // 연결 목록 즉시 갱신
                fetchConnections();
            }
        };
        window.addEventListener('message', listener);
    };

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

    // 이메일 변경 핸들러
    const handleEmailChange = async (e) => {
        e.preventDefault();
        setEmailMsg(null);
        const csrftoken = getCookie('csrftoken');
        const form = new FormData();
        form.append('email', emailForm);
        try {
            const res = await fetch(`${ALLAUTH_BASE}/email/`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'X-CSRFToken': csrftoken },
                body: form,
            });
            const text = await res.text();
            if (res.ok) {
                setEmailMsg('이메일 변경 요청이 완료되었습니다. (확인 메일을 확인하세요)');
            } else {
                setEmailMsg('실패: ' + (text.match(/<li>(.*?)<\/li>/)?.[1] || '입력값을 확인하세요.'));
            }
        } catch {
            setEmailMsg('서버 오류');
        }
    };

    // 비밀번호 변경 핸들러
    const handlePwChange = async (e) => {
        e.preventDefault();
        setPwMsg(null);
        if (pwForm.pw1 !== pwForm.pw2) {
            setPwMsg('새 비밀번호가 일치하지 않습니다.');
            return;
        }
        const csrftoken = getCookie('csrftoken');
        const form = new FormData();
        form.append('oldpassword', pwForm.old);
        form.append('password1', pwForm.pw1);
        form.append('password2', pwForm.pw2);
        try {
            const res = await fetch(`${ALLAUTH_BASE}/password/change/`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'X-CSRFToken': csrftoken },
                body: form,
            });
            const text = await res.text();
            if (res.ok) {
                setPwMsg('비밀번호가 성공적으로 변경되었습니다.');
            } else {
                setPwMsg('실패: ' + (text.match(/<li>(.*?)<\/li>/)?.[1] || '입력값을 확인하세요.'));
            }
        } catch {
            setPwMsg('서버 오류');
        }
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
                                <div style={{ marginTop: 8, fontSize: 13, color: '#888' }}>
                                    로그인 방식: {user.social_accounts && user.social_accounts.length > 0 ? (
                                        <>
                                            {user.social_accounts.map(p => getProviderLabel(p)).join(', ')}
                                            {user.has_password ? ' + 이메일/비밀번호' : ''}
                                        </>
                                    ) : '이메일/비밀번호'}
                                </div>
                            </div>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                <li>
                                    <button
                                        className="login-modal-submit"
                                        style={{ width: '100%', marginBottom: 8 }}
                                        onClick={() => setShowEmailModal(true)}
                                    >
                                        이메일 변경
                                    </button>
                                </li>
                                <li>
                                    {user.is_social_only ? (
                                        <div style={{ color: '#888', fontSize: 14, marginBottom: 8, textAlign: 'center' }}>
                                            소셜 계정만 연결된 사용자는 비밀번호를 변경할 수 없습니다.
                                        </div>
                                    ) : (
                                        <button
                                            className="login-modal-submit"
                                            style={{ width: '100%', marginBottom: 8 }}
                                            onClick={() => setShowPasswordModal(true)}
                                        >
                                            비밀번호 변경
                                        </button>
                                    )}
                                </li>
                                <li>
                                    <button
                                        className="login-modal-submit"
                                        style={{ width: '100%', marginBottom: 8 }}
                                        onClick={() => setShowConnectionsModal(true)}
                                    >
                                        계정 연결
                                    </button>
                                </li>
                                <li>
                                    <button className="login-modal-submit" style={{ width: '100%', background: '#eee', color: '#333' }} onClick={handleLogout} disabled={logoutLoading}>
                                        {logoutLoading ? '로그아웃 중...' : '로그아웃'}
                                    </button>
                                </li>
                            </ul>
                            {/* 이메일 변경 모달 */}
                            {showEmailModal && (
                                <div className="login-modal-overlay" onClick={() => { setShowEmailModal(false); setEmailMsg(null); }}>
                                    <div className="login-modal" onClick={e => e.stopPropagation()}>
                                        <div className="login-modal-header">
                                            <h2>이메일 변경</h2>
                                            <button className="login-modal-close" onClick={() => { setShowEmailModal(false); setEmailMsg(null); }} aria-label="닫기">✕</button>
                                        </div>
                                        <div className="login-modal-content">
                                            <form className="login-modal-form" onSubmit={handleEmailChange}>
                                                <input type="email" className="login-modal-input" placeholder="새 이메일 주소" value={emailForm} onChange={e => setEmailForm(e.target.value)} required />
                                                <button className="login-modal-submit" style={{ width: '100%' }} type="submit">변경</button>
                                            </form>
                                            {emailMsg && <div style={{ color: emailMsg.startsWith('실패') ? 'red' : 'green', marginTop: 8, textAlign: 'center' }}>{emailMsg}</div>}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {/* 비밀번호 변경 모달 */}
                            {showPasswordModal && (
                                <div className="login-modal-overlay" onClick={() => { setShowPasswordModal(false); setPwMsg(null); }}>
                                    <div className="login-modal" onClick={e => e.stopPropagation()}>
                                        <div className="login-modal-header">
                                            <h2>비밀번호 변경</h2>
                                            <button className="login-modal-close" onClick={() => { setShowPasswordModal(false); setPwMsg(null); }} aria-label="닫기">✕</button>
                                        </div>
                                        <div className="login-modal-content">
                                            <form className="login-modal-form" onSubmit={handlePwChange}>
                                                <input type="password" className="login-modal-input" placeholder="현재 비밀번호" value={pwForm.old} onChange={e => setPwForm(f => ({ ...f, old: e.target.value }))} required />
                                                <input type="password" className="login-modal-input" placeholder="새 비밀번호" value={pwForm.pw1} onChange={e => setPwForm(f => ({ ...f, pw1: e.target.value }))} required />
                                                <input type="password" className="login-modal-input" placeholder="새 비밀번호 확인" value={pwForm.pw2} onChange={e => setPwForm(f => ({ ...f, pw2: e.target.value }))} required />
                                                <button className="login-modal-submit" style={{ width: '100%' }} type="submit">변경</button>
                                            </form>
                                            {pwMsg && <div style={{ color: pwMsg.startsWith('실패') ? 'red' : 'green', marginTop: 8, textAlign: 'center' }}>{pwMsg}</div>}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {/* 계정 연결 모달 */}
                            {showConnectionsModal && (
                                <div className="login-modal-overlay" onClick={() => { setShowConnectionsModal(false); setConnMsg(null); }}>
                                    <div className="login-modal" onClick={e => e.stopPropagation()}>
                                        <div className="login-modal-header">
                                            <h2>계정 연결</h2>
                                            <button className="login-modal-close" onClick={() => { setShowConnectionsModal(false); setConnMsg(null); }} aria-label="닫기">✕</button>
                                        </div>
                                        <div className="login-modal-content">
                                            <div style={{ marginBottom: 12 }}>
                                                <b>연결된 소셜 계정:</b><br />
                                                {connections.length > 0 ? (
                                                    connections.map(acc => (
                                                        <span key={acc.provider} style={{ marginRight: 8 }}>
                                                            {getProviderLabel(acc.provider)}
                                                            <button style={{ marginLeft: 6, fontSize: 13 }} onClick={() => handleDisconnect(acc.provider)}>해제</button>
                                                        </span>
                                                    ))
                                                ) : '없음'}
                                            </div>
                                            <div style={{ marginBottom: 12 }}>
                                                <b>연결 가능한 소셜 계정:</b><br />
                                                {SOCIAL_PROVIDERS.filter(p => !connections.find(c => c.provider === p.provider)).map(p => (
                                                    <button key={p.provider} className="login-modal-submit" style={{ marginRight: 8, marginBottom: 8, fontSize: 15, padding: '6px 12px' }} onClick={() => handleConnect(p.provider)}>
                                                        {p.label} 연결
                                                    </button>
                                                ))}
                                            </div>
                                            {connMsg && <div style={{ color: connMsg.includes('성공') ? 'green' : 'red', marginTop: 8, textAlign: 'center' }}>{connMsg}</div>}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    );
} 