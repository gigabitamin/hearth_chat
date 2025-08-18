import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiBase, getCookie } from '../utils/apiConfig';

const AI_PROVIDERS = [
    { value: 'GEMINI', label: 'Gemini' },
    { value: 'CHATGPT', label: 'ChatGPT' },
    { value: 'CLUDE', label: 'Clude' },
];

const RoomSettingsModal = ({ open, onClose, room, onSuccess }) => {
    const navigate = useNavigate();
    const [name, setName] = useState(room?.name || '');
    const [roomType, setRoomType] = useState(room?.room_type || 'ai');
    const [aiProvider, setAiProvider] = useState(room?.ai_provider || 'GEMINI');
    const [isPublic, setIsPublic] = useState(room?.is_public || false);
    const [maxMembers, setMaxMembers] = useState(room?.max_members || 4);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [isDeleteHovered, setIsDeleteHovered] = useState(false);

    // 컴포넌트 스타일
    const styles = {
        modalActions: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '20px',
            gap: '10px'
        },
        leftActions: {
            display: 'flex',
            gap: '10px'
        },
        rightActions: {
            display: 'flex',
            gap: '10px'
        },
        deleteBtn: {
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            transition: 'all 0.3s ease',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        },
        deleteBtnHover: {
            backgroundColor: '#d32f2f',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            transform: 'translateY(-1px)'
        },
        deleteBtnDisabled: {
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: 'not-allowed',
            fontSize: '14px',
            fontWeight: 'bold',
            opacity: 0.6
        }
    };

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

    const handleDeleteRoom = async () => {
        if (!window.confirm('정말로 이 대화방을 삭제하시겠습니까?\n\n삭제된 대화방은 복구할 수 없습니다.')) {
            return;
        }

        try {
            setSaving(true);
            setError(null);
            const csrftoken = getCookie('csrftoken');
            const response = await fetch(`${getApiBase()}/api/chat/rooms/${room.id}/`, {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'X-CSRFToken': csrftoken,
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '대화방 삭제 실패');
            }

            // 삭제 성공 시 모달 닫기
            onClose();

            // 부모 컴포넌트에 삭제 완료 알림
            if (onSuccess) {
                // 삭제된 방 정보를 전달하여 부모에서 처리할 수 있도록 함
                onSuccess({ ...room, deleted: true });
            }

            // 성공 메시지 표시 후 루트 경로로 이동
            alert('대화방이 삭제되었습니다.');

            // 약간의 지연 후 루트 경로로 이동 (사용자가 메시지를 확인할 수 있도록)
            setTimeout(() => {
                navigate('/');
            }, 100);
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
                    <div style={styles.modalActions}>
                        <div style={styles.leftActions}>
                            <button
                                type="button"
                                onClick={handleDeleteRoom}
                                style={saving ? styles.deleteBtnDisabled : (isDeleteHovered ? styles.deleteBtnHover : styles.deleteBtn)}
                                disabled={saving}
                                onMouseEnter={() => !saving && setIsDeleteHovered(true)}
                                onMouseLeave={() => setIsDeleteHovered(false)}
                                title="이 대화방을 영구적으로 삭제합니다. 삭제된 대화방은 복구할 수 없습니다."
                            >
                                🗑️ 방 삭제
                            </button>
                        </div>
                        <div style={styles.rightActions}>
                            <button type="button" onClick={onClose} className="cancel-btn">취소</button>
                            <button type="submit" className="submit-btn" disabled={saving}>
                                {saving ? '저장 중...' : '저장'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RoomSettingsModal;
