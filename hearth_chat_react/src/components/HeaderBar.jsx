import React from 'react';
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
    onLoginClick, // 추가: 로그인 버튼 클릭 핸들러
    isLoggedIn,   // 추가: 로그인 상태
    title // 중앙에 표시할 텍스트(채팅방 이름/앱명)
}) {
    return (
        <header className="header-bar">
            <div className="header-left-group">
                <CreateRoomButton onClick={onCreateRoomClick} />
                <nav className="header-tabs">
                    <button
                        className={`header-tab-btn${activeTab === 'personal' ? ' active' : ''}`}
                        onClick={() => onTabChange('personal')}
                    >
                        개인
                    </button>
                    <button
                        className={`header-tab-btn${activeTab === 'open' ? ' active' : ''}`}
                        onClick={() => onTabChange('open')}
                    >
                        오픈
                    </button>
                    <button
                        className={`header-tab-btn${activeTab === 'favorite' ? ' active' : ''}`}
                        onClick={() => onTabChange('favorite')}
                        title="즐겨찾기"
                    >
                        ★
                    </button>
                </nav>
            </div>
            <div className="header-center">
                {title && <span className="header-title-text">{title}</span>}
            </div>
            <div className="header-actions">
                {/* 로그인 버튼: 검색 버튼 왼쪽에 위치 */}
                <button
                    className="header-action-btn header-login-btn"
                    onClick={onLoginClick}
                    style={{ marginRight: 8 }}
                >
                    {isLoggedIn ? '로그아웃' : '로그인'}
                </button>
                <button className="header-action-btn" onClick={onSearchClick} title="검색">
                    <span role="img" aria-label="search" style={{ fontSize: 22 }}>🔍</span>
                </button>
                <button className="header-action-btn" onClick={onNotifyClick} title="알림">
                    <span role="img" aria-label="notify" style={{ fontSize: 22 }}>🔔</span>
                </button>
                <button className="header-action-btn" onClick={onSettingsClick} title="설정">
                    <span role="img" aria-label="settings" style={{ fontSize: 22 }}>⚙️</span>
                </button>
            </div>
        </header>
    );
} 