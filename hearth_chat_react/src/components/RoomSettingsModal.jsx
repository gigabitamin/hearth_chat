import React, { useState } from 'react';

const AI_PROVIDERS = [
    { value: 'GEMINI', label: 'Gemini' },
    { value: 'CHATGPT', label: 'ChatGPT' },
    { value: 'CLUDE', label: 'Clude' },
];

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

// 환경에 따라 API_BASE 자동 설정 함수 추가
const getApiBase = () => {
    const hostname = window.location.hostname;
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) return 'https://hearthchat-production.up.railway.app';
    if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:8000';
    if (hostname === '192.168.44.9') return 'http://192.168.44.9:8000';
    return `http://${hostname}:8000`;
};

const RoomSettingsModal = ({ open, onClose, room, onSuccess }) => {
    const [name, setName] = useState(room?.name || '');
    const [roomType, setRoomType] = useState(room?.room_type || 'ai');
    const [aiProvider, setAiProvider] = useState(room?.ai_provider || 'GEMINI');
    const [isPublic, setIsPublic] = useState(room?.is_public || false);
    const [maxMembers, setMaxMembers] = useState(room?.max_members || 4);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    if (!open || !room) return null;

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const body = {
                name,
                room_type: roomType,
                ai_provider: roomType === 'ai' ? aiProvider : '',
                is_public: isPublic,
                max_members: maxMembers,
            };
            const csrftoken = getCookie('csrftoken');
            const response = await fetch(`${getApiBase()}/api/chat/rooms/${room.id}/`, {
                method: 'PATCH',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken,
                },
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                const errorData = await response.json();
                console.log('errorData:', errorData);
                throw new Error(errorData.error || '방 정보 수정 실패');
            }
            const updatedRoom = await response.json();
            if (onSuccess) onSuccess(updatedRoom);
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <h4>방 정보 수정</h4>
                <form onSubmit={handleSave}>
                    <div className="form-group">
                        <label>대화방 이름</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label>대화방 타입</label>
                        <select value={roomType} onChange={e => setRoomType(e.target.value)}>
                            <option value="ai">AI 채팅</option>
                            <option value="user">1:1 채팅</option>
                            <option value="group">그룹 채팅</option>
                        </select>
                    </div>
                    {roomType === 'ai' && (
                        <div className="form-group">
                            <label>AI 종류</label>
                            <select value={aiProvider} onChange={e => setAiProvider(e.target.value)}>
                                {AI_PROVIDERS.map(ai => (
                                    <option key={ai.value} value={ai.value}>{ai.label}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="form-group">
                        <label>공개 설정</label>
                        <div className="radio-group">
                            <label>
                                <input
                                    type="radio"
                                    name="isPublic"
                                    value="false"
                                    checked={!isPublic}
                                    onChange={() => setIsPublic(false)}
                                />
                                🔒 비공개 (개인 채팅방)
                            </label>
                            <label>
                                <input
                                    type="radio"
                                    name="isPublic"
                                    value="true"
                                    checked={isPublic}
                                    onChange={() => setIsPublic(true)}
                                />
                                🌐 공개 (오픈 채팅방)
                            </label>
                        </div>
                    </div>
                    <div className="form-group">
                        <label>최대 인원수</label>
                        <input
                            type="number"
                            min={2}
                            max={20}
                            value={maxMembers}
                            onChange={e => setMaxMembers(Math.max(2, Math.min(20, Number(e.target.value))))}
                        />
                        <small>2~20명 사이로 설정 (기본 4명)</small>
                    </div>
                    {error && <div className="error">{error}</div>}
                    <div className="modal-actions">
                        <button type="button" onClick={onClose} className="cancel-btn">취소</button>
                        <button type="submit" className="submit-btn" disabled={saving}>
                            {saving ? '저장 중...' : '저장'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RoomSettingsModal; 