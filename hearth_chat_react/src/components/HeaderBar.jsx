import React from 'react';
import { useNavigate } from 'react-router-dom';
import './HeaderBar.css';

const CreateRoomButton = ({ onClick }) => (
    <button
        className="header-create-room-btn"
        onClick={onClick}
        title="새 채팅방 만들기"
        aria-label="새 채팅방 만들기"
        style={{ background: 'none', border: 'none', padding: 0, marginRight: 10, cursor: 'pointer', outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
        <span style={{ fontSize: 28, userSelect: 'none', transition: 'transform 0.15s' }} role="img" aria-label="logo">🔥</span>
    </button>
);

export default function HeaderBar({
    activeTab,
    onTabChange,
    onSearchClick,
    onNotifyClick,
    onSettingsClick,
    onCreateRoomClick,
    onLoginClick,
    loginUser,
    title, // 중앙에 표시할 텍스트(채팅방 이름/앱명)
    unreadNotifications = 0, // 읽지 않은 알림 개수
    isInRoom = false // 새로 추가된 prop
}) {
    const navigate = useNavigate();

    return (
        <header className="header-bar">
            <div className="header-left-group">
                <CreateRoomButton onClick={onCreateRoomClick} />
                {/* 오버레이와 동일한 탭 UI로 교체 */}
                <div className="header-tabs" style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
                    <button onClick={() => onTabChange('personal')} className={`header-tab-btn${!isInRoom && activeTab === 'personal' ? ' active' : ''}`}>개인</button>
                    <button onClick={() => onTabChange('open')} className={`header-tab-btn${!isInRoom && activeTab === 'open' ? ' active' : ''}`}>오픈</button>
                    <button onClick={() => onTabChange('favorite')} className={`header-tab-btn${!isInRoom && activeTab === 'favorite' ? ' active' : ''}`}>★</button>
                </div>
            </div>
            <div className="header-center">
                {title && <span className="header-title-text">{title}</span>}
            </div>
            <div className="header-actions">
                {/* 관리자 링크 (관리자만 표시) */}
                {loginUser && loginUser.is_staff && (
                    <button
                        className="header-action-btn"
                        onClick={() => navigate('/admin')}
                        title="관리자 대시보드"
                        style={{
                            marginRight: 8,
                            background: '#ff6b6b',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '8px 12px',
                            cursor: 'pointer'
                        }}
                    >
                        <span role="img" aria-label="admin" style={{ fontSize: 18 }}>👑</span>
                    </button>
                )}
                {/* 로그인/유저 버튼 */}
                {loginUser ? (
                    <button
                        className="header-action-btn"
                        onClick={onSettingsClick}
                        title="내 계정"
                        style={{ marginRight: 8 }}
                    >
                    </button>
                ) : (
                    <button
                        className="header-action-btn"
                        onClick={() => {
                            console.log('HeaderBar 로그인 버튼 클릭됨!');
                            onLoginClick();
                        }}
                        title="로그인"
                        style={{
                            marginRight: 8,
                            background: '#f0f0f0',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            padding: '8px 12px',
                            cursor: 'pointer'
                        }}
                    >
                        <span role="img" aria-label="login" style={{ fontSize: 20 }}>🔑</span>
                    </button>
                )}
                <button className="header-action-btn" onClick={onSearchClick} title="검색">
                    <span role="img" aria-label="search" style={{ fontSize: 22 }}>🔍</span>
                </button>
                <button className="header-action-btn notify-btn" onClick={onNotifyClick} title="알림">
                    <span role="img" aria-label="notify" style={{ fontSize: 22 }}>🔔</span>
                    {unreadNotifications > 0 && (
                        <span className="notification-badge">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>
                    )}
                </button>
                <button className="header-action-btn" onClick={() => {
                    console.log('HeaderBar 설정 버튼 클릭됨!');
                    onSettingsClick();
                }} title="설정">
                    <span role="img" aria-label="settings" style={{ fontSize: 22 }}>⚙️</span>
                </button>
            </div>
        </header>
    );
} 