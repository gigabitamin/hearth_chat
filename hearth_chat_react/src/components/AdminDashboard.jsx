import React, { useState, useEffect } from 'react';
import './AdminDashboard.css';
import CreateRoomModal from './CreateRoomModal';
// import React, { useEffect, useState } from "react";
import MediaFileList from "./MediaFileList";

const getApiBase = () => {
    const hostname = window.location.hostname;
    const isProd = process.env.NODE_ENV === 'production';
  
    if (isProd) return 'https://hearthchat-production.up.railway.app';
    if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:8000';
    if (hostname === '192.168.44.9') return 'http://192.168.44.9:8000';
  
    return `http://${hostname}:8000`;
};

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('overview');
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [messages, setMessages] = useState([]);    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedItems, setSelectedItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [defaultMaxMembers, setDefaultMaxMembers] = useState(4);
    const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);



    // API 기본 URL
    const API_BASE = `${getApiBase()}/api/admin`;
    // const API_BASE = `/api/admin`

    // API 호출 함수
    const fetchData = async (endpoint, params = {}) => {
        try {
            const queryString = new URLSearchParams(params).toString();
            const url = `${API_BASE}${endpoint}${queryString ? `?${queryString}` : ''}`;

            const response = await fetch(url, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error('관리자 권한이 필요합니다.');
                }
                throw new Error(`API 오류: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API 호출 오류:', error);
            throw error;
        }
    };   

    // 통계 데이터 로드
    const loadStats = async () => {
        try {
            const data = await fetchData('/stats/');
            setStats(data);
        } catch (error) {
            setError(error.message);
        }
    };

    // 유저 목록 로드
    const loadUsers = async (page = 1, search = '') => {
        try {
            const params = { page, page_size: 20 };
            if (search) params.search = search;

            const data = await fetchData('/users/', params);
            setUsers(data.results || data);
            setTotalPages(Math.ceil((data.count || data.length) / 20));
        } catch (error) {
            setError(error.message);
        }
    };

    // 방 목록 로드
    const loadRooms = async (page = 1, search = '') => {
        try {
            const params = { page, page_size: 20 };
            if (search) params.search = search;

            const data = await fetchData('/rooms/', params);
            setRooms(data.results || data);
            setTotalPages(Math.ceil((data.count || data.length) / 20));
        } catch (error) {
            setError(error.message);
        }
    };

    // 메시지 목록 로드
    const loadMessages = async (page = 1, search = '') => {
        try {
            const params = { page, page_size: 20 };
            if (search) params.search = search;

            const data = await fetchData('/messages/', params);
            setMessages(data.results || data);
            setTotalPages(Math.ceil((data.count || data.length) / 20));
        } catch (error) {
            setError(error.message);
        }
    };

    // 대량 액션 실행
    const executeBulkAction = async (action, ids) => {
        try {
            const response = await fetch(`${API_BASE}/bulk-action/`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: action,
                    ids: ids
                }),
            });

            if (!response.ok) {
                throw new Error(`대량 액션 실패: ${response.status}`);
            }

            const result = await response.json();
            alert(`${action} 완료: ${result.deleted_count || result.updated_count}개 처리됨`);

            // 데이터 새로고침
            refreshData();
            setSelectedItems([]);
        } catch (error) {
            setError(error.message);
        }
    };

    // 개별 액션 실행
    const executeAction = async (action, id, additionalData = {}) => {
        try {
            const response = await fetch(`${API_BASE}/${action.split('_')[1]}/${id}/${action.split('_')[0]}/`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(additionalData),
            });

            if (!response.ok) {
                throw new Error(`액션 실패: ${response.status}`);
            }

            const result = await response.json();
            alert(`${action} 완료`);

            // 데이터 새로고침
            refreshData();
        } catch (error) {
            setError(error.message);
        }
    };

    // 데이터 새로고침
    const refreshData = () => {
        setLoading(true);
        setError(null);

        Promise.all([
            loadStats(),
            loadUsers(currentPage, searchTerm),
            loadRooms(currentPage, searchTerm),
            loadMessages(currentPage, searchTerm)
        ]).finally(() => setLoading(false));
    };

    // 초기 데이터 로드
    useEffect(() => {
        refreshData();
    }, []);

    // 검색 처리
    const handleSearch = (e) => {
        e.preventDefault();
        setCurrentPage(1);
        refreshData();
    };

    // 페이지 변경
    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
        refreshData();
    };

    // 아이템 선택 토글
    const toggleItemSelection = (id) => {
        setSelectedItems(prev =>
            prev.includes(id)
                ? prev.filter(item => item !== id)
                : [...prev, id]
        );
    };

    // 전체 선택/해제
    const toggleAllSelection = () => {
        const currentItems = activeTab === 'users' ? users :
            activeTab === 'rooms' ? rooms : messages;

        setSelectedItems(prev =>
            prev.length === currentItems.length ? [] : currentItems.map(item => item.id)
        );
    };

    function getCookie(name) {
        const match = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
        return match ? match.pop() : '';
    }

    // ① 파일 업로드용 컴포넌트 추가
    function MediaUploader({ onUploaded }) {
        const [uploading, setUploading] = useState(false);
        const [file, setFile] = useState(null);
        const [name, setName] = useState('');
        const [error, setError] = useState(null);
        const [result, setResult] = useState(null);
    
        // 기존 fetchData와 같은 베이스를 씀. (단, 파일업로드만 특별 케이스)
        const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) return setError('파일을 선택하세요!');
        setUploading(true);
        setError(null);
    
        try {
            const data = await uploadMediaFile(file, name);
            setResult(data);
            setFile(null);
            setName('');
            onUploaded?.(data);
        } catch (err) {
            setError(err.message);
            setResult(null);
        } finally {
            setUploading(false);
        }
        };
    
        return (
        <div className="media-uploader">
            <form onSubmit={handleUpload}>
            <input
                type="text"
                placeholder="파일 이름(생략 시 원본 파일명)"
                value={name}
                onChange={e => setName(e.target.value)}
            />
            <input
                type="file"
                onChange={e => setFile(e.target.files[0])}
            />
            <button type="submit" disabled={uploading}>업로드</button>
            </form>
            {error && <div className="error">{error}</div>}
            {result && <div className="success">{result.name} 업로드 완료!</div>}
        </div>
        );
    }         


    // 업로드 함수
    const uploadMediaFile = async (file, name) => {
        const form = new FormData();
        form.append('file', file);
        form.append('name', name || file.name);
    
        const resp = await fetch(`${API_BASE}/upload_media/`, {
        method: 'POST',
        credentials: 'include',
        body: form,
        headers: {
            'X-CSRFToken': getCookie('csrftoken')    // 이 한 줄이 핵심!
        }
        });
    
        if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `업로드 오류: ${resp.status}`);
        }
        return resp.json();
    };
      

    // 오버뷰 탭 렌더링
    const renderOverview = () => {
        if (!stats) return <div>로딩 중...</div>;

        return (
            <div className="admin-overview">
                <div className="stats-grid">
                    <div className="stat-card">
                        <h3>전체 유저</h3>
                        <p className="stat-number">{stats.overview?.total_users || 0}</p>
                        <small>활성: {stats.overview?.active_users_30d || 0}명</small>
                    </div>
                    <div className="stat-card">
                        <h3>전체 방</h3>
                        <p className="stat-number">{stats.overview?.total_rooms || 0}</p>
                        <small>오늘 생성: {stats.today_stats?.new_rooms || 0}개</small>
                    </div>
                    <div className="stat-card">
                        <h3>전체 메시지</h3>
                        <p className="stat-number">{stats.overview?.total_messages || 0}</p>
                        <small>오늘 전송: {stats.today_stats?.new_messages || 0}개</small>
                    </div>
                    <div className="stat-card">
                        <h3>신규 유저</h3>
                        <p className="stat-number">{stats.today_stats?.new_users || 0}</p>
                        <small>오늘 가입</small>
                    </div>
                </div>

                <div className="stats-details">
                    <div className="stats-section">
                        <h4>방 타입별 통계</h4>
                        <div className="stats-list">
                            {stats.room_type_stats?.map((stat, index) => (
                                <div key={index} className="stat-item">
                                    <span>{stat.room_type}</span>
                                    <span>{stat.count}개</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="stats-section">
                        <h4>메시지 타입별 통계</h4>
                        <div className="stats-list">
                            {stats.message_type_stats?.map((stat, index) => (
                                <div key={index} className="stat-item">
                                    <span>{stat.sender_type}</span>
                                    <span>{stat.count}개</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="recent-activity">
                    <div className="recent-section">
                        <h4>최근 메시지</h4>
                        <div className="recent-list">
                            {stats.recent_messages?.map((msg, index) => (
                                <div key={index} className="recent-item">
                                    <div className="recent-content">
                                        <strong>{msg.sender}</strong>
                                        <span>{msg.content}</span>
                                        <small>{msg.room_name}</small>
                                    </div>
                                    <small>{new Date(msg.timestamp).toLocaleString()}</small>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="recent-section">
                        <h4>최근 가입 유저</h4>
                        <div className="recent-list">
                            {stats.recent_users?.map((user, index) => (
                                <div key={index} className="recent-item">
                                    <div className="recent-content">
                                        <strong>{user.username}</strong>
                                        <span>{user.email}</span>
                                        <small>{user.is_staff ? '관리자' : '일반유저'}</small>
                                    </div>
                                    <small>{new Date(user.date_joined).toLocaleDateString()}</small>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // 유저 관리 탭 렌더링
    const renderUsers = () => {
        return (
            <div className="admin-users">
                <div className="table-header">
                    <div className="search-box">
                        <form onSubmit={handleSearch}>
                            <input
                                type="text"
                                placeholder="유저명 또는 이메일로 검색..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <button type="submit">검색</button>
                        </form>
                    </div>
                    <div className="bulk-actions">
                        {selectedItems.length > 0 && (
                            <>
                                <button onClick={() => executeBulkAction('deactivate_users', selectedItems)}>
                                    선택 비활성화
                                </button>
                                <button onClick={() => executeBulkAction('activate_users', selectedItems)}>
                                    선택 활성화
                                </button>
                                <button onClick={() => executeBulkAction('delete_users', selectedItems)}>
                                    선택 삭제
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>
                                    <input
                                        type="checkbox"
                                        checked={selectedItems.length === users.length && users.length > 0}
                                        onChange={toggleAllSelection}
                                    />
                                </th>
                                <th>ID</th>
                                <th>유저명</th>
                                <th>이메일</th>
                                <th>상태</th>
                                <th>권한</th>
                                <th>가입일</th>
                                <th>액션</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => (
                                <tr key={user.id}>
                                    <td>
                                        <input
                                            type="checkbox"
                                            checked={selectedItems.includes(user.id)}
                                            onChange={() => toggleItemSelection(user.id)}
                                        />
                                    </td>
                                    <td>{user.id}</td>
                                    <td>{user.username}</td>
                                    <td>{user.email}</td>
                                    <td>
                                        <span className={`status ${user.is_active ? 'active' : 'inactive'}`}>
                                            {user.is_active ? '활성' : '비활성'}
                                        </span>
                                    </td>
                                    <td>
                                        <select
                                            value={user.is_superuser ? 'admin' : user.is_staff ? 'moderator' : 'user'}
                                            onChange={(e) => executeAction('set_role', user.id, { role: e.target.value })}
                                        >
                                            <option value="user">일반유저</option>
                                            <option value="moderator">모더레이터</option>
                                            <option value="admin">관리자</option>
                                        </select>
                                    </td>
                                    <td>{new Date(user.date_joined).toLocaleDateString()}</td>
                                    <td>
                                        <button onClick={() => executeAction('toggle_active', user.id)}>
                                            {user.is_active ? '비활성화' : '활성화'}
                                        </button>
                                        <button onClick={() => executeAction('delete_user', user.id)}>
                                            삭제
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="pagination">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <button
                            key={page}
                            onClick={() => handlePageChange(page)}
                            className={currentPage === page ? 'active' : ''}
                        >
                            {page}
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    // 방 관리 탭 렌더링
    const renderRooms = () => (
        <div>
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <label htmlFor="default-max-members">최대 인원수 기본값:</label>
                <input
                    id="default-max-members"
                    type="number"
                    min={2}
                    max={20}
                    value={defaultMaxMembers}
                    onChange={e => setDefaultMaxMembers(Math.max(2, Math.min(20, Number(e.target.value))))}
                    style={{ width: 60 }}
                />
                <span style={{ fontSize: 13, color: '#888' }}>(방 생성 시 기본값, 2~20명)</span>
                <button onClick={() => setShowCreateRoomModal(true)} style={{ marginLeft: 16 }}>+ 새 방 만들기</button>
            </div>
            {showCreateRoomModal && (
                <CreateRoomModal
                    open={showCreateRoomModal}
                    onClose={() => setShowCreateRoomModal(false)}
                    onSuccess={() => { setShowCreateRoomModal(false); loadRooms(); }}
                    defaultMaxMembers={defaultMaxMembers}
                />
            )}
            <div className="table-header">
                <div className="search-box">
                    <form onSubmit={handleSearch}>
                        <input
                            type="text"
                            placeholder="방 이름으로 검색..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <button type="submit">검색</button>
                    </form>
                </div>
                <div className="bulk-actions">
                    {selectedItems.length > 0 && (
                        <button onClick={() => executeBulkAction('delete_rooms', selectedItems)}>
                            선택 삭제
                        </button>
                    )}
                </div>
            </div>

            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>
                                <input
                                    type="checkbox"
                                    checked={selectedItems.length === rooms.length && rooms.length > 0}
                                    onChange={toggleAllSelection}
                                />
                            </th>
                            <th>ID</th>
                            <th>방 이름</th>
                            <th>타입</th>
                            <th>상태</th>
                            <th>참여자</th>
                            <th>메시지</th>
                            <th>생성일</th>
                            <th>액션</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rooms.map((room) => (
                            <tr key={room.id}>
                                <td>
                                    <input
                                        type="checkbox"
                                        checked={selectedItems.includes(room.id)}
                                        onChange={() => toggleItemSelection(room.id)}
                                    />
                                </td>
                                <td>{room.id}</td>
                                <td>{room.name}</td>
                                <td>{room.room_type}</td>
                                <td>
                                    <span className={`status ${room.is_active ? 'active' : 'inactive'}`}>
                                        {room.is_active ? '활성' : '비활성'}
                                    </span>
                                </td>
                                <td>{room.participant_count || 0}</td>
                                <td>{room.message_count || 0}</td>
                                <td>{new Date(room.created_at).toLocaleDateString()}</td>
                                <td>
                                    <button onClick={() => executeAction('toggle_active', room.id)}>
                                        {room.is_active ? '비활성화' : '활성화'}
                                    </button>
                                    <button onClick={() => executeAction('delete_room', room.id)}>
                                        삭제
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="pagination">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={currentPage === page ? 'active' : ''}
                    >
                        {page}
                    </button>
                ))}
            </div>
        </div>
    );

    // 메시지 관리 탭 렌더링
    const renderMessages = () => {
        return (
            <div className="admin-messages">
                <div className="table-header">
                    <div className="search-box">
                        <form onSubmit={handleSearch}>
                            <input
                                type="text"
                                placeholder="메시지 내용으로 검색..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <button type="submit">검색</button>
                        </form>
                    </div>
                    <div className="bulk-actions">
                        {selectedItems.length > 0 && (
                            <button onClick={() => executeBulkAction('delete_messages', selectedItems)}>
                                선택 삭제
                            </button>
                        )}
                    </div>
                </div>

                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>
                                    <input
                                        type="checkbox"
                                        checked={selectedItems.length === messages.length && messages.length > 0}
                                        onChange={toggleAllSelection}
                                    />
                                </th>
                                <th>ID</th>
                                <th>발신자</th>
                                <th>방</th>
                                <th>내용</th>
                                <th>반응</th>
                                <th>전송시간</th>
                                <th>액션</th>
                            </tr>
                        </thead>
                        <tbody>
                            {messages.map((message) => (
                                <tr key={message.id}>
                                    <td>
                                        <input
                                            type="checkbox"
                                            checked={selectedItems.includes(message.id)}
                                            onChange={() => toggleItemSelection(message.id)}
                                        />
                                    </td>
                                    <td>{message.id}</td>
                                    <td>{message.sender_name}</td>
                                    <td>{message.room_name}</td>
                                    <td className="message-content">
                                        {message.content.length > 50
                                            ? `${message.content.substring(0, 50)}...`
                                            : message.content
                                        }
                                    </td>
                                    <td>{message.reaction_count || 0}</td>
                                    <td>{new Date(message.timestamp).toLocaleString()}</td>
                                    <td>
                                        <button onClick={() => executeAction('delete_message', message.id)}>
                                            삭제
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="pagination">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <button
                            key={page}
                            onClick={() => handlePageChange(page)}
                            className={currentPage === page ? 'active' : ''}
                        >
                            {page}
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    // 미디어 업로더 추가
    const renderMediaUploader = () => {
        return (
            <div className="admin-messages">
                <MediaUploader onUploaded={() => {/* 필요시 업로드 후 목록 새로고침 등 */}} />
                <MediaFileList API_BASE={API_BASE} />
            </div>
        );
    };


    if (loading) {
        return <div className="admin-dashboard loading">로딩 중...</div>;
    }

    if (error) {
        return (
            <div className="admin-dashboard error">
                <h2>오류 발생</h2>
                <p>{error}</p>
                <button onClick={refreshData}>다시 시도</button>
            </div>
        );
    }

    return (
        <div className="admin-dashboard">
            <div className="admin-header">
                <h1>관리자 대시보드</h1>
                <div className="admin-actions">
                    <button onClick={refreshData}>새로고침</button>
                </div>
            </div>

            <div className="admin-tabs">
                <button
                    className={activeTab === 'overview' ? 'active' : ''}
                    onClick={() => setActiveTab('overview')}
                >
                    개요
                </button>
                <button
                    className={activeTab === 'users' ? 'active' : ''}
                    onClick={() => setActiveTab('users')}
                >
                    유저 관리
                </button>
                <button
                    className={activeTab === 'rooms' ? 'active' : ''}
                    onClick={() => setActiveTab('rooms')}
                >
                    방 관리
                </button>
                <button
                    className={activeTab === 'messages' ? 'active' : ''}
                    onClick={() => setActiveTab('messages')}
                >
                    메시지 관리
                </button>
                <button
                    className={activeTab === 'uploadmedia' ? 'active' : ''}
                    onClick={() => setActiveTab('uploadmedia')}
                >
                    미디어 관리
                </button>
            </div>

            <div className="admin-content">
                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'users' && renderUsers()}
                {activeTab === 'rooms' && renderRooms()}
                {activeTab === 'messages' && renderMessages()}
                {activeTab === 'uploadmedia' && renderMediaUploader()}
            </div>
        </div>
    );
};


export default AdminDashboard; 