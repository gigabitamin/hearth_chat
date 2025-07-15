import React, { useState } from 'react';

const AI_PROVIDERS = [
    { value: 'GEMINI', label: 'Gemini' },
    { value: 'CHATGPT', label: 'ChatGPT' },
    { value: 'CLUDE', label: 'Clude' },
];

const getApiBase = () => {
    const hostname = window.location.hostname;
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) return 'https://hearthchat-production.up.railway.app';
    if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:8000';
    if (hostname === '192.168.44.9') return 'http://192.168.44.9:8000';
    return `http://${hostname}:8000`;
};

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

const CreateRoomModal = ({ open, onClose, onSuccess }) => {
    const [createType, setCreateType] = useState('ai');
    const [createName, setCreateName] = useState('');
    const [createAI, setCreateAI] = useState('GEMINI');
    const [createIsPublic, setCreateIsPublic] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState(null);

    if (!open) return null;

    const handleCreateRoom = async (e) => {
        e.preventDefault();
        setCreating(true);
        setCreateError(null);
        try {
            const body = {
                name: createName || (createType === 'ai' ? `${createAI}와의 대화` : ''),
                room_type: createType,
                ai_provider: createType === 'ai' ? createAI : '',
                is_public: createIsPublic,
            };
            const csrftoken = getCookie('csrftoken');
            const response = await fetch(`${getApiBase()}/api/chat/rooms/`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken,
                },
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '대화방 생성 실패');
            }
            const newRoom = await response.json();
            setCreateName('');
            setCreateType('ai');
            setCreateAI('GEMINI');
            setCreateIsPublic(false);
            if (onSuccess) onSuccess(newRoom);
        } catch (err) {
            setCreateError(err.message);
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <h4>새 대화방 만들기</h4>
                <form onSubmit={handleCreateRoom}>
                    <div className="form-group">
                        <label>대화방 타입</label>
                        <select value={createType} onChange={e => setCreateType(e.target.value)}>
                            <option value="ai">AI 채팅</option>
                            <option value="user">1:1 채팅</option>
                            <option value="group">그룹 채팅</option>
                        </select>
                    </div>
                    {createType === 'ai' && (
                        <div className="form-group">
                            <label>AI 종류</label>
                            <select value={createAI} onChange={e => setCreateAI(e.target.value)}>
                                {AI_PROVIDERS.map(ai => (
                                    <option key={ai.value} value={ai.value}>{ai.label}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="form-group">
                        <label>대화방 이름</label>
                        <input
                            type="text"
                            value={createName}
                            onChange={e => setCreateName(e.target.value)}
                            placeholder={createType === 'ai' ? `${createAI}와의 대화` : '대화방 이름'}
                        />
                    </div>
                    <div className="form-group">
                        <label>공개 설정</label>
                        <div className="radio-group">
                            <label>
                                <input
                                    type="radio"
                                    name="isPublic"
                                    value="false"
                                    checked={!createIsPublic}
                                    onChange={() => setCreateIsPublic(false)}
                                />
                                🔒 비공개 (개인 채팅방)
                            </label>
                            <label>
                                <input
                                    type="radio"
                                    name="isPublic"
                                    value="true"
                                    checked={createIsPublic}
                                    onChange={() => setCreateIsPublic(true)}
                                />
                                🌐 공개 (오픈 채팅방)
                            </label>
                        </div>
                    </div>
                    {createError && <div className="error">{createError}</div>}
                    <div className="modal-actions">
                        <button type="button" onClick={onClose} className="cancel-btn">취소</button>
                        <button type="submit" className="submit-btn" disabled={creating}>
                            {creating ? '생성 중...' : '생성'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateRoomModal; 