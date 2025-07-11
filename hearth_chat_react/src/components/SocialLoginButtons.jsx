import React from 'react';
import styles from './SocialLoginButtons.module.css';

const SOCIALS = [
    {
        name: 'Google',
        url: '/accounts/google/login/',
        className: styles.google,
        logo: process.env.PUBLIC_URL + '/oauth_logo/Google.svg',
    },
    {
        name: 'Kakao',
        url: '/accounts/kakao/login/',
        className: styles.kakao,
        logo: process.env.PUBLIC_URL + '/oauth_logo/KakaoTalk.svg',
    },
    {
        name: 'Naver',
        url: '/accounts/naver/login/',
        className: styles.naver,
        logo: process.env.PUBLIC_URL + '/oauth_logo/Naver.svg',
    },
    {
        name: 'GitHub',
        url: '/accounts/github/login/',
        className: styles.github,
        logo: process.env.PUBLIC_URL + '/oauth_logo/Github.svg',
    },
];

export default function SocialLoginButtons() {
    return (
        <div className={styles['social-login-list']}>
            {SOCIALS.map(social => (
                <a
                    key={social.name}
                    href={social.url}
                    className={`${styles['social-login-btn']} ${social.className}`}
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