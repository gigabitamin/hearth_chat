import React, { useEffect, useState } from "react";
import './MediaFileList.css';

// 파일 목록 보기 컴포넌트
function MediaFileList({ API_BASE, onDelete, onDownload, filterValue, onFilterChange }) {
  const [mediaFiles, setMediaFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);  
  const [modalImage, setModalImage] = useState(null);

  const fetchMediaFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      // 목록 API에서 데이터 받아오기
      const resp = await fetch(`${API_BASE}/admin_list_media_files/`, {
        credentials: "include"
      });
      if (!resp.ok) throw new Error(`오류: ${resp.status}`);
      const data = await resp.json();
      setMediaFiles(data);
      console.log('MediaFileList data:', data);
    } catch (err) {
      setError(err.message || '파일 목록 로딩 실패');
    } finally {
      setLoading(false);
    }
  };

  // 유틸 함수 예시
  function isImageFile(name) {
    return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(name || "");
  }

  function formatDate(dt) {
    if (!dt) return "";
    return new Date(dt).toLocaleString("ko-KR");
  }

  // 모달 닫기 핸들러
  function handleModalClose(e) {
    // 모달 바깥 클릭 시만 닫기 (이벤트 버블링 방지)
    if (e.target.classList.contains('media-modal')) {
      setModalImage(null);
    }
  }

  useEffect(() => {
    fetchMediaFiles();
  }, []);

  if (loading) return <div>파일 목록 불러오는 중...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!mediaFiles.length) return <div>업로드된 파일이 없습니다.</div>;

  const displayedFiles = mediaFiles.filter(f =>
    !filterValue || f.name.toLowerCase().includes(filterValue.toLowerCase())
  );

  return (
    <div className="media-file-list">
      {/* 모달 */}
      {modalImage && (
        <div className="media-modal" onClick={handleModalClose}>
          <img src={modalImage} className="media-modal-img" alt="미리보기" onClick={() => setModalImage(null)} />
        </div>
      )}
      <div style={{ marginBottom: 12 }}>
        <input
          type="text"
          placeholder="파일명으로 검색/필터"
          value={filterValue}
          onChange={e => onFilterChange(e.target.value)}
        />
      </div>
      <table style={{ width: "100%" }}>
        <thead>
          <tr>
            <th>썸네일</th>
            <th>파일명</th>
            <th>업로드</th>
            <th>액션</th>
          </tr>
        </thead>
        <tbody>
          {displayedFiles.map(f =>
            <tr key={f.id || f.name}>
              <td>{isImageFile(f.name)
                ? <img src={f.file} className="media-thumb" alt={f.name} onClick={() => setModalImage(f.file)} style={{ cursor: 'pointer' }} />
                : <span style={{ color: "#aaa" }}>–</span>
              }</td>
              <td>{f.name}</td>
              <td>{formatDate(f.uploaded_at)}</td>
              <td>
                <button onClick={() => onDownload(f.url, f.name)}>다운로드</button>
                <button className="danger" onClick={() => onDelete(f.id)}>삭제</button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {displayedFiles.length === 0 && <div style={{ marginTop: 12, color: '#ccc' }}>파일 없음</div>}
    </div>
  );
}

export default MediaFileList;



