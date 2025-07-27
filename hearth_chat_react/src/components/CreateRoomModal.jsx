import React, { useState, useEffect } from 'react';
import './CreateRoomModal.css';
import { getApiBase, getCookie } from '../utils/apiConfig';

const AI_PROVIDERS = [
    { value: 'GEMINI', label: 'Gemini' },
    { value: 'CHATGPT', label: 'ChatGPT' },
    { value: 'CLUDE', label: 'Clude' },
];

const CreateRoomModal = ({ open, onClose, onSuccess, defaultMaxMembers = 4 }) => {
    const [createType, setCreateType] = useState('user'); // 기본값을 'user'로 변경
    const [createName, setCreateName] = useState('');
    const [createAI, setCreateAI] = useState('GEMINI');
    const [createIsPublic, setCreateIsPublic] = useState(false);
    const [createMaxMembers, setCreateMaxMembers] = useState(defaultMaxMembers);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState(null);
    const [aiResponseEnabled, setAiResponseEnabled] = useState(false); // user 타입이므로 기본값 false

    useEffect(() => {
        setCreateMaxMembers(defaultMaxMembers);
    }, [defaultMaxMembers, open]);

    // 대화방 타입 변경 시 AI 응답 옵션 기본값 자동 설정
    useEffect(() => {
        if (createType === 'ai') setAiResponseEnabled(true);
        else setAiResponseEnabled(false);
    }, [createType]);

    if (!open) return null;

    // 방제가 비어있을 때 자동 생성하는 함수
    const generateDefaultRoomName = () => {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 19).replace('T', ' ').replace(/:/g, '-');
        const randomId = Math.random().toString(36).substr(2, 9);
        return `${randomId} - ${dateStr}`;
    };

    const handleCreateRoom = async (e) => {
        e.preventDefault();
        setCreating(true);
        setCreateError(null);
        console.log('========test========')
        try {
            // 방제가 비어있으면 자동 생성
            const roomName = createName.trim() || generateDefaultRoomName();

            const body = {
                // name: createName || (createType === 'ai' ? `${createAI}와의 대화` : ''),
                name: roomName,
                room_type: createType,
                ai_provider: createType === 'ai' ? createAI : '',
                is_public: createIsPublic,
                max_members: createMaxMembers,
                ai_response_enabled: aiResponseEnabled,
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
            // 방 생성 후, ai_response_enabled가 true면 사용자 설정도 자동 ON                        
            if (aiResponseEnabled) {
                try {
                    await fetch(`${getApiBase()}/api/chat/user/settings/`, {
                        method: 'PATCH',
                        credentials: 'include',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': csrftoken,
                        },
                        body: JSON.stringify({ ai_response_enabled: true }),
                    });
                } catch (e) { /* 무시 */ }
            }
            // 이미지 첨부 자동 메시지 전송을 위해 localStorage에 방 id도 함께 저장
            if (window.localStorage) {
                if (createName && window.pendingImageUrl) {
                    localStorage.setItem('pending_auto_message', createName);
                    localStorage.setItem('pending_image_url', window.pendingImageUrl);
                    localStorage.setItem('pending_room_id', newRoom.id);
                }
            }
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
                            <option value="user">1:N 채팅</option>
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
                    <div className="form-group">
                        <label>최대 인원수</label>
                        <input
                            type="number"
                            min={2}
                            max={20}
                            value={createMaxMembers}
                            onChange={e => setCreateMaxMembers(Math.max(2, Math.min(20, Number(e.target.value))))}
                        />
                        <small>2~20명 사이로 설정 (기본 4명)</small>
                    </div>
                    <div className="form-group">
                        <label>AI 응답</label>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <input
                                type="checkbox"
                                checked={aiResponseEnabled}
                                onChange={e => setAiResponseEnabled(e.target.checked)}
                            />
                            {aiResponseEnabled ? 'ON' : 'OFF'}
                        </label>
                        <small style={{ marginLeft: 8, color: '#888' }}>
                            (AI 채팅: ON, 1:1/그룹: OFF 기본값, 직접 변경 가능)
                        </small>
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