import React, { useState, useRef } from 'react';
import axios from 'axios';
import { getCookie } from '../utils/apiConfig';

const MultiImageUpload = ({ onImagesUploaded, onImagesRemoved, maxImages = 5 }) => {
    const [attachedImages, setAttachedImages] = useState([]);
    const [attachedImagePreviews, setAttachedImagePreviews] = useState([]);
    const fileInputRef = useRef(null);

    // 이미지 파일 검증 함수
    const validateImageFile = (file) => {
        const allowedExt = ['jpg', 'jpeg', 'png', 'webp'];
        const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
        const maxSize = 4 * 1024 * 1024;
        const ext = file.name.split('.').pop().toLowerCase();

        if (!allowedExt.includes(ext)) {
            alert('허용되지 않는 확장자입니다: ' + ext);
            return false;
        }
        if (file.size > maxSize) {
            alert('파일 용량은 4MB 이하만 허용됩니다.');
            return false;
        }
        if (!allowedMime.includes(file.type)) {
            alert('허용되지 않는 이미지 형식입니다: ' + file.type);
            return false;
        }
        return true;
    };

    // 다중 이미지 업로드 핸들러
    const handleImageUpload = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        // 최대 이미지 개수 체크
        if (attachedImages.length + files.length > maxImages) {
            alert(`최대 ${maxImages}개의 이미지만 첨부할 수 있습니다.`);
            return;
        }

        const validFiles = [];
        const validPreviews = [];

        files.forEach(file => {
            if (validateImageFile(file)) {
                validFiles.push(file);
                validPreviews.push(URL.createObjectURL(file));
            }
        });

        if (validFiles.length > 0) {
            const newImages = [...attachedImages, ...validFiles];
            const newPreviews = [...attachedImagePreviews, ...validPreviews];

            setAttachedImages(newImages);
            setAttachedImagePreviews(newPreviews);

            if (onImagesUploaded) {
                onImagesUploaded(newImages);
            }
        }

        // 파일 입력 초기화
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // 특정 이미지 제거
    const handleRemoveAttachedImage = (index) => {
        setAttachedImages(prev => {
            const newImages = prev.filter((_, i) => i !== index);
            if (onImagesRemoved) {
                onImagesRemoved(newImages);
            }
            return newImages;
        });

        setAttachedImagePreviews(prev => {
            const newPreviews = prev.filter((_, i) => i !== index);
            // URL.revokeObjectURL 호출하여 메모리 정리
            if (prev[index]) {
                URL.revokeObjectURL(prev[index]);
            }
            return newPreviews;
        });
    };

    // 모든 이미지 제거
    const handleRemoveAllAttachedImages = () => {
        // 모든 미리보기 URL 해제
        attachedImagePreviews.forEach(url => {
            URL.revokeObjectURL(url);
        });
        setAttachedImages([]);
        setAttachedImagePreviews([]);

        if (onImagesRemoved) {
            onImagesRemoved([]);
        }
    };

    // 파일 선택 버튼 클릭
    const handleFileSelect = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    return (
        <div className="multi-image-upload">
            {/* 이미지 미리보기 영역 */}
            {attachedImagePreviews.length > 0 && (
                <div className="image-previews" style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    marginBottom: '8px',
                    padding: '8px',
                    background: '#f5f5f5',
                    borderRadius: '8px'
                }}>
                    {attachedImagePreviews.map((preview, index) => (
                        <div key={index} className="image-preview-item" style={{
                            position: 'relative',
                            display: 'inline-block'
                        }}>
                            <img
                                src={preview}
                                alt={`첨부 이미지 ${index + 1}`}
                                style={{
                                    width: '80px',
                                    height: '80px',
                                    objectFit: 'cover',
                                    borderRadius: '4px',
                                    border: '1px solid #ddd'
                                }}
                            />
                            <button
                                onClick={() => handleRemoveAttachedImage(index)}
                                style={{
                                    position: 'absolute',
                                    top: '-8px',
                                    right: '-8px',
                                    background: '#ff4444',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '20px',
                                    height: '20px',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                ×
                            </button>
                        </div>
                    ))}

                    {/* 모든 이미지 제거 버튼 */}
                    {attachedImagePreviews.length > 1 && (
                        <button
                            onClick={handleRemoveAllAttachedImages}
                            style={{
                                background: '#ff6666',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                alignSelf: 'flex-start'
                            }}
                        >
                            모두 제거
                        </button>
                    )}
                </div>
            )}

            {/* 파일 선택 버튼 */}
            <button
                type="button"
                onClick={handleFileSelect}
                disabled={attachedImages.length >= maxImages}
                style={{
                    border: 'none',
                    cursor: attachedImages.length >= maxImages ? 'not-allowed' : 'pointer',
                    background: 'transparent',
                    margin: '0 auto',
                    opacity: attachedImages.length >= maxImages ? 0.5 : 1
                }}
                title={attachedImages.length >= maxImages ? `최대 ${maxImages}개 이미지` : '이미지 첨부'}
            >
                <span style={{ fontSize: 20 }}>🖼︎</span>
            </button>

            {/* 숨겨진 파일 입력 */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={handleImageUpload}
            />

            {/* 이미지 개수 표시 */}
            {attachedImages.length > 0 && (
                <div style={{
                    fontSize: '12px',
                    color: '#666',
                    textAlign: 'center',
                    marginTop: '4px'
                }}>
                    {attachedImages.length}/{maxImages} 이미지
                </div>
            )}
        </div>
    );
};

export default MultiImageUpload; 