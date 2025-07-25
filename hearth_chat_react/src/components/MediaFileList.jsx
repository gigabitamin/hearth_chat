import React, { useEffect, useState } from "react";
import './MediaFileList.css';

// 파일 목록 보기 컴포넌트
function MediaFileList({ API_BASE }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMediaFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      // 목록 API에서 데이터 받아오기
      const resp = await fetch(`${API_BASE}/list_media_files/`, {
        credentials: "include"
      });
      if (!resp.ok) throw new Error(`오류: ${resp.status}`);
      const data = await resp.json();
      setFiles(data);
    } catch (err) {
      setError(err.message || '파일 목록 로딩 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMediaFiles();
  }, []);

  if (loading) return <div>파일 목록 불러오는 중...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!files.length) return <div>업로드된 파일이 없습니다.</div>;

  return (
    <div className="media-file-list">
      <h3>업로드된 미디어 파일</h3>
      <ul>
        {files.map(f => (
          <li key={f.id}>
            <a href={f.file} target="_blank" rel="noopener noreferrer">
              {f.name || f.file.split("/").pop()}
            </a> <span style={{color:'#888', fontSize:'0.98rem'}}>{new Date(f.uploaded_at).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default MediaFileList;
