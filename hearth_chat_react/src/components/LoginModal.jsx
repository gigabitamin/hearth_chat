import React, { useState } from 'react';
import SocialLoginButtons from './SocialLoginButtons';
import './LoginModal.css';

// 환경에 따라 API_BASE 자동 설정
const hostname = window.location.hostname;
const isProd = process.env.NODE_ENV === 'production';
const API_BASE = isProd
    ? 'https://hearthchat-production.up.railway.app'
    : (hostname === 'localhost' || hostname === '127.0.0.1')
        ? 'http://localhost:8000'
        : hostname === '192.168.44.9'
            ? 'http://192.168.44.9:8000'
            : `http://${hostname}:8000`;

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

const LoginModal = ({ isOpen, onClose, onSocialLogin }) => {
    const [tab, setTab] = useState('login'); // 'login' or 'signup'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [password2, setPassword2] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const resetForm = () => {
        setEmail('');
        setPassword('');
        setPassword2('');
        setError(null);
    };

    const handleTab = (t) => {
        setTab(t);
        resetForm();
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        const form = new FormData();
        form.append('login', email);
        form.append('password', password);
        form.append('remember', 'on');
        const csrftoken = getCookie('csrftoken');
        if (!csrftoken) {
            setError('CSRF 토큰이 없습니다. 새로고침 후 다시 시도해 주세요.');
            setLoading(false);
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/api/chat/login/`, {
                method: 'POST',
                credentials: 'include',
                body: form,
                headers: { 'X-CSRFToken': csrftoken },
            });
            if (res.redirected || res.ok) {
                onClose();
                window.location.reload();
                return;
            }
            const text = await res.text();
            setError('로그인 실패: ' + (text.match(/<li>(.*?)<\/li>/)?.[1] || '이메일/비밀번호를 확인하세요.'));
        } catch {
            setError('서버 오류');
        } finally {
            setLoading(false);
        }
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        if (password !== password2) {
            setError('비밀번호가 일치하지 않습니다.');
            setLoading(false);
            return;
        }
        const form = new FormData();
        form.append('email', email);
        form.append('password1', password);
        form.append('password2', password2);
        const csrftoken = getCookie('csrftoken');
        if (!csrftoken) {
            setError('CSRF 토큰이 없습니다. 새로고침 후 다시 시도해 주세요.');
            setLoading(false);
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/api/chat/signup/`, {
                method: 'POST',
                credentials: 'include',
                body: form,
                headers: { 'X-CSRFToken': csrftoken },
            });
            if (res.redirected || res.ok) {
                onClose();
                window.location.reload();
                return;
            }
            const text = await res.text();
            setError('회원가입 실패: ' + (text.match(/<li>(.*?)<\/li>/)?.[1] || '입력값을 확인하세요.'));
        } catch {
            setError('서버 오류');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-modal-overlay" onClick={onClose}>
            <div className="login-modal" onClick={e => e.stopPropagation()}>
                <div className="login-modal-header">
                    <h2>로그인</h2>
                    <button className="login-modal-close" onClick={onClose} aria-label="로그인 모달 닫기">✕</button>
                </div>
                <div className="login-modal-content">
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                        <button onClick={() => handleTab('login')} className={tab === 'login' ? 'login-modal-tab-active' : 'login-modal-tab'}>이메일 로그인</button>
                        <button onClick={() => handleTab('signup')} className={tab === 'signup' ? 'login-modal-tab-active' : 'login-modal-tab'}>회원가입</button>
                    </div>
                    {error && <div style={{ color: 'red', textAlign: 'center', marginBottom: 8 }}>{error}</div>}
                    {tab === 'login' ? (
                        <form className="login-modal-form" onSubmit={handleLogin} autoComplete="on">
                            <input
                                type="email"
                                placeholder="이메일 주소"
                                className="login-modal-input"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                autoFocus
                            />
                            <input
                                type="password"
                                placeholder="비밀번호"
                                className="login-modal-input"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                            />
                            <button type="submit" className="login-modal-submit" disabled={loading}>
                                {loading ? '로그인 중...' : '로그인'}
                            </button>
                        </form>
                    ) : (
                        <form className="login-modal-form" onSubmit={handleSignup} autoComplete="on">
                            <input
                                type="email"
                                placeholder="이메일 주소"
                                className="login-modal-input"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                autoFocus
                            />
                            <input
                                type="password"
                                placeholder="비밀번호"
                                className="login-modal-input"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                            />
                            <input
                                type="password"
                                placeholder="비밀번호 확인"
                                className="login-modal-input"
                                value={password2}
                                onChange={e => setPassword2(e.target.value)}
                                required
                            />
                            <button type="submit" className="login-modal-submit" disabled={loading}>
                                {loading ? '회원가입 중...' : '회원가입'}
                            </button>
                        </form>
                    )}
                    <div className="login-modal-divider">
                        <span>또는</span>
                    </div>
                    <div className="login-modal-social">
                        <SocialLoginButtons onSocialLogin={onSocialLogin} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginModal; 