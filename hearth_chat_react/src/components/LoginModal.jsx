import React from 'react';
import SocialLoginButtons from './SocialLoginButtons';
import './LoginModal.css';

const LoginModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="login-modal-overlay" onClick={handleOverlayClick}>
            <div className="login-modal">
                <div className="login-modal-header">
                    <h2>로그인</h2>
                    <button
                        className="login-modal-close"
                        onClick={onClose}
                        aria-label="로그인 모달 닫기"
                    >
                        ✕
                    </button>
                </div>

                <div className="login-modal-content">
                    <p className="login-modal-description">
                        소셜 계정으로 간편하게 로그인하세요
                    </p>

                    <div className="login-modal-social">
                        <SocialLoginButtons />
                    </div>

                    <div className="login-modal-divider">
                        <span>또는</span>
                    </div>

                    <div className="login-modal-email">
                        <p>이메일로 로그인</p>
                        <form className="login-modal-form">
                            <input
                                type="email"
                                placeholder="이메일 주소"
                                className="login-modal-input"
                            />
                            <input
                                type="password"
                                placeholder="비밀번호"
                                className="login-modal-input"
                            />
                            <button type="submit" className="login-modal-submit">
                                로그인
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginModal; 