import React from 'react';
import './SocialLoginButtons.css';

// 환경에 따라 BACKEND_URL 자동 설정
const BACKEND_URL = process.env.NODE_ENV === 'production'
    ? 'https://hearthchat-production.up.railway.app'
    : 'http://localhost:8000';

const SOCIALS = [
    {
        name: 'Google',
        url: `${BACKEND_URL}/accounts/google/login/?process=login`,
        className: 'google',
        logo: process.env.PUBLIC_URL + '/oauth_logo/Google.svg',
    },
    {
        name: 'Kakao',
        url: `${BACKEND_URL}/accounts/kakao/login/?process=login`,
        className: 'kakao',
        logo: process.env.PUBLIC_URL + '/oauth_logo/KakaoTalk.svg',
    },
    {
        name: 'Naver',
        url: `${BACKEND_URL}/accounts/naver/login/?process=login`,
        className: 'naver',
        logo: process.env.PUBLIC_URL + '/oauth_logo/Naver.svg',
    },
    {
        name: 'GitHub',
        url: `${BACKEND_URL}/accounts/github/login/?process=login`,
        className: 'github',
        logo: process.env.PUBLIC_URL + '/oauth_logo/Github.svg',
    },
];

export default function SocialLoginButtons({ onSocialLogin }) {
    return (
        <div className="social-login-list">
            {SOCIALS.map(social => (
                <a
                    key={social.name}
                    href={social.url}
                    className={`social-login-btn ${social.className}`}
                    onClick={e => {
                        e.preventDefault();
                        onSocialLogin(social.url);
                    }}
                >
                    <img
                        src={social.logo}
                        alt={`${social.name} logo`}
                        style={{ width: 24, height: 24, background: 'transparent' }}
                    />
                    {social.name} 로 로그인
                </a>
            ))}
        </div>
    );
}