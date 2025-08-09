import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getApiBase, getCookie, csrfFetch, LILY_API_URL } from '../utils/apiConfig';
import Webcam from 'react-webcam';
import Cropper from 'react-easy-crop';
import { getCroppedImg, dataURLtoFile } from './cropUtils';

const EMOJI_LIST = ['👍', '😂', '❤️', '😮', '😢', '👏', '🔥', '😡', '🙏', '🎉'];

const GlobalChatInput = ({ room, loginUser, ws, onOpenCreateRoomModal, onImageClick, setPendingImageFile }) => {
    // console.log('[DEBUG] GlobalChatInput 컴포넌트 렌더링됨');
    // console.log('[DEBUG] props:', { room, loginUser, ws, onOpenCreateRoomModal, onImageClick });
    // console.log('onOpenCreateRoomModal 프롭:', onOpenCreateRoomModal);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const inputRef = useRef();
    const [attachedImages, setAttachedImages] = useState([]); // 다중 이미지 지원
    const [attachedImagePreviews, setAttachedImagePreviews] = useState([]); // 다중 이미지 미리보기
    const [attachedDocuments, setAttachedDocuments] = useState([]); // 문서 파일 지원
    const [attachedDocumentPreviews, setAttachedDocumentPreviews] = useState([]); // 문서 파일 미리보기
    const [longPressTimer, setLongPressTimer] = useState(null);

    // --- [수정 1] long-press 발생 여부를 추적할 ref 추가 ---
    const longPressTriggered = useRef(false);
    // --- [수정 2] 타이머와 long-press 상태를 관리할 useRef 선언 ---
    const pressTimer = useRef(null);
    const isLongPress = useRef(false);

    // --- 카메라 및 자르기 기능 관련 상태 추가 ---
    const [showCamera, setShowCamera] = useState(false);
    const [capturedImage, setCapturedImage] = useState(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const webcamRef = useRef(null);

    // --- 카메라 관련 함수 ---    
    // 1. 카메라 버튼 클릭 핸들러
    const handleCameraButtonClick = () => {
        setShowCamera(true);
    };

    // 2. 사진 촬영 핸들러
    const handleCapture = useCallback(() => {
        const imageSrc = webcamRef.current.getScreenshot();
        setCapturedImage(imageSrc);
        setShowCamera(false); // 카메라 모달 닫고, 자르기 모달 열기
    }, [webcamRef]);

    // 3. 자르기 완료 콜백
    const onCropComplete = useCallback((croppedArea, croppedAreaPixelsValue) => {
        setCroppedAreaPixels(croppedAreaPixelsValue);
    }, []);

    // 4. 자르기 실행 및 이미지 첨부 핸들러
    const handleCropImage = async () => {
        if (!capturedImage || !croppedAreaPixels) return;

        try {
            const croppedImageBlobUrl = await getCroppedImg(capturedImage, croppedAreaPixels);
            const croppedImageFile = dataURLtoFile(croppedImageBlobUrl, `capture-${Date.now()}.jpeg`);

            setAttachedImages([croppedImageFile]); // 단일 이미지로 설정
            setAttachedImagePreviews([URL.createObjectURL(croppedImageFile)]);

            // 모든 모달 및 임시 상태 초기화
            setCapturedImage(null);
            setCroppedAreaPixels(null);

        } catch (e) {
            console.error('이미지 자르기에 실패했습니다.', e);
        }
    };

    // 5. 카메라/자르기 취소 핸들러
    const cancelAll = () => {
        setShowCamera(false);
        setCapturedImage(null);
    };

    // 클립보드 이벤트 리스너 추가
    useEffect(() => {
        const handlePaste = async (e) => {
            // Ctrl+V 또는 Cmd+V가 눌렸을 때만 처리
            if (!((e.ctrlKey || e.metaKey) && e.key === 'v')) {
                return;
            }

            try {
                const clipboardItems = await navigator.clipboard.read();
                for (const clipboardItem of clipboardItems) {
                    for (const type of clipboardItem.types) {
                        if (type.startsWith('image/')) {
                            const blob = await clipboardItem.getType(type);
                            const file = new File([blob], `screenshot-${Date.now()}.png`, { type });

                            // 이미지 파일 검증
                            const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
                            const maxSize = 4 * 1024 * 1024;

                            if (!allowedMime.includes(file.type)) {
                                console.log('허용되지 않는 이미지 형식입니다:', file.type);
                                return;
                            }
                            if (file.size > maxSize) {
                                alert('파일 용량은 4MB 이하만 허용됩니다.');
                                return;
                            }

                            // 이미지 첨부 (단일 이미지로 설정)
                            setAttachedImages([file]);
                            setAttachedImagePreviews([URL.createObjectURL(file)]);
                            console.log('클립보드에서 이미지가 자동으로 첨부되었습니다:', file.name);
                            return;
                        }
                    }
                }
            } catch (error) {
                console.log('클립보드 접근 실패 또는 이미지가 없음:', error);
            }
        };

        // 키보드 이벤트 리스너 추가
        document.addEventListener('keydown', handlePaste);

        return () => {
            document.removeEventListener('keydown', handlePaste);
        };
    }, []);

    // textarea 높이 자동 조절 함수
    const adjustTextareaHeight = () => {
        if (inputRef.current) {
            const textarea = inputRef.current;
            // 높이를 초기화하여 정확한 스크롤 높이를 계산
            textarea.style.height = 'auto';
            // 스크롤 높이에 패딩을 고려하여 높이 설정 (최대 120px)
            const newHeight = Math.min(textarea.scrollHeight, 120);
            textarea.style.height = `${newHeight}px`;
        }
    };

    // input 값이 변경될 때마다 높이 조절
    useEffect(() => {
        adjustTextareaHeight();
    }, [input]);

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

    // 문서 파일 검증 함수
    const validateDocumentFile = (file) => {
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain',
            'text/csv'
        ];
        const maxSize = 50 * 1024 * 1024; // 50MB

        if (!allowedTypes.includes(file.type)) {
            alert('지원되지 않는 문서 형식입니다. PDF, Word, Excel, PowerPoint, TXT, CSV 파일만 업로드 가능합니다.');
            return false;
        }

        if (file.size > maxSize) {
            alert('파일 크기가 너무 큽니다. 50MB 이하의 파일만 업로드 가능합니다.');
            return false;
        }

        return true;
    };

    // 파일 타입 판별 함수
    const getFileType = (file) => {
        if (file.type.startsWith('image/')) {
            return 'image';
        } else if (file.type.startsWith('application/') || file.type.startsWith('text/')) {
            return 'document';
        }
        return 'unknown';
    };

    // 통합 파일 업로드 핸들러 (이미지 + 문서)
    const handleFileUpload = (e) => {
        console.log('[DEBUG] handleFileUpload 호출됨');
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const imageFiles = [];
        const documentFiles = [];
        const imagePreviews = [];
        const documentPreviews = [];

        files.forEach(file => {
            console.log('[DEBUG] 선택된 파일:', file.name, file.type);

            const fileType = getFileType(file);

            if (fileType === 'image') {
                if (validateImageFile(file)) {
                    imageFiles.push(file);
                    imagePreviews.push(URL.createObjectURL(file));
                }
            } else if (fileType === 'document') {
                if (validateDocumentFile(file)) {
                    documentFiles.push(file);
                    // 문서 파일은 아이콘으로 미리보기
                    const fileIcon = getDocumentIcon(file.type);
                    documentPreviews.push({
                        name: file.name,
                        icon: fileIcon,
                        size: file.size
                    });
                }
            } else {
                alert(`지원되지 않는 파일 형식입니다: ${file.name}`);
            }
        });

        // 최대 파일 개수 체크 (이미지 5개 + 문서 3개)
        const maxImages = 5;
        const maxDocuments = 3;

        if (attachedImages.length + imageFiles.length > maxImages) {
            alert(`최대 ${maxImages}개의 이미지만 첨부할 수 있습니다.`);
            return;
        }

        if (attachedDocuments.length + documentFiles.length > maxDocuments) {
            alert(`최대 ${maxDocuments}개의 문서만 첨부할 수 있습니다.`);
            return;
        }

        // 상태 업데이트
        if (imageFiles.length > 0) {
            setAttachedImages(prev => [...prev, ...imageFiles]);
            setAttachedImagePreviews(prev => [...prev, ...imagePreviews]);
        }

        if (documentFiles.length > 0) {
            setAttachedDocuments(prev => [...prev, ...documentFiles]);
            setAttachedDocumentPreviews(prev => [...prev, ...documentPreviews]);
        }
    };

    // 문서 아이콘 반환 함수
    const getDocumentIcon = (mimeType) => {
        switch (mimeType) {
            case 'application/pdf':
                return '📄';
            case 'application/msword':
            case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                return '📝';
            case 'application/vnd.ms-excel':
            case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
                return '📊';
            case 'application/vnd.ms-powerpoint':
            case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
                return '📈';
            case 'text/plain':
            case 'text/csv':
                return '📃';
            default:
                return '📎';
        }
    };

    // 기존 이미지 업로드 핸들러 (호환성 유지)
    const handleImageUpload = (e) => {
        console.log('[DEBUG] handleImageUpload 호출됨');
        console.log('[DEBUG] e.target:', e.target);
        console.log('[DEBUG] e.target.files:', e.target.files);
        console.log('[DEBUG] e.target.files.length:', e.target.files ? e.target.files.length : 'undefined');

        const files = Array.from(e.target.files || []);
        if (files.length === 0) {
            console.log('[DEBUG] 파일이 없음');
            return;
        }

        // 최대 이미지 개수 체크
        const maxImages = 5;
        if (attachedImages.length + files.length > maxImages) {
            alert(`최대 ${maxImages}개의 이미지만 첨부할 수 있습니다.`);
            return;
        }

        const validFiles = [];
        const validPreviews = [];

        files.forEach(file => {
            console.log('[DEBUG] 선택된 파일:', file);
            console.log('[DEBUG] 파일 이름:', file.name);
            console.log('[DEBUG] 파일 크기:', file.size);
            console.log('[DEBUG] 파일 타입:', file.type);

            if (validateImageFile(file)) {
                validFiles.push(file);
                validPreviews.push(URL.createObjectURL(file));
            }
        });

        if (validFiles.length > 0) {
            console.log('[DEBUG] 이미지 파일 검증 통과');
            console.log('[DEBUG] 이미지 파일 설정:', validFiles.length, '개');

            setAttachedImages(prev => [...prev, ...validFiles]);
            setAttachedImagePreviews(prev => [...prev, ...validPreviews]);

            console.log('[DEBUG] attachedImages 상태 설정 완료');
        }
    };

    // 특정 이미지 제거
    const handleRemoveAttachedImage = (index) => {
        setAttachedImages(prev => prev.filter((_, i) => i !== index));
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
    };

    // 특정 문서 제거
    const handleRemoveAttachedDocument = (index) => {
        setAttachedDocuments(prev => prev.filter((_, i) => i !== index));
        setAttachedDocumentPreviews(prev => prev.filter((_, i) => i !== index));
    };

    // 모든 문서 제거
    const handleRemoveAllAttachedDocuments = () => {
        setAttachedDocuments([]);
        setAttachedDocumentPreviews([]);
    };

    // 모든 파일 제거 (이미지 + 문서)
    const handleRemoveAllAttachedFiles = () => {
        handleRemoveAllAttachedImages();
        handleRemoveAllAttachedDocuments();
    };

    // 통합 파일 업로드 및 전송 (이미지 + 문서)
    const handleMultipleFilesUploadAndSend = async (messageText) => {
        console.log('[DEBUG] handleMultipleFilesUploadAndSend 호출됨');
        console.log('[DEBUG] messageText:', messageText);
        console.log('[DEBUG] attachedImages:', attachedImages);
        console.log('[DEBUG] attachedDocuments:', attachedDocuments);
        console.log('[DEBUG] ws:', ws);
        console.log('[DEBUG] ws.readyState:', ws?.readyState);
        console.log('[DEBUG] room:', room);

        if (attachedImages.length === 0 && attachedDocuments.length === 0) {
            console.log('[DEBUG] 첨부된 파일이 없음');
            return;
        }

        const finalMessageText = messageText || '파일 첨부';
        console.log('[DEBUG] finalMessageText:', finalMessageText);

        try {
            const uploadedUrls = [];
            const uploadedDocuments = [];

            // 이미지 파일 업로드
            for (let i = 0; i < attachedImages.length; i++) {
                const imageFile = attachedImages[i];
                const formData = new FormData();
                formData.append('file', imageFile);

                const response = await fetch('/api/chat/upload_image/', {
                    method: 'POST',
                    body: formData,
                    credentials: 'include'
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.file_url) {
                        uploadedUrls.push(result.file_url);
                    }
                } else {
                    console.error('이미지 업로드 실패:', response.status, response.statusText);
                    const errorData = await response.json();
                    console.error('에러 상세:', errorData);
                }
            }

            // 문서 파일 업로드 (Lily LLM API로 직접 전송)
            for (let i = 0; i < attachedDocuments.length; i++) {
                const documentFile = attachedDocuments[i];
                const formData = new FormData();
                formData.append('file', documentFile);
                formData.append('user_id', loginUser?.username || 'default_user');

                const response = await fetch(`${LILY_API_URL}/document/upload`, {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        uploadedDocuments.push({
                            document_id: result.document_id,
                            filename: documentFile.name
                        });
                        console.log(`✅ 문서 업로드 성공: ${documentFile.name}`);
                    } else {
                        console.error(`❌ 문서 업로드 실패: ${documentFile.name}`, result);
                    }
                } else {
                    console.error(`❌ 문서 업로드 HTTP 오류: ${documentFile.name}`, response.status, response.statusText);
                    const errorData = await response.json();
                    console.error('에러 상세:', errorData);
                }
            }

            // WebSocket으로 메시지 전송
            console.log('[DEBUG] WebSocket 전송 시작');
            console.log('[DEBUG] ws:', ws);
            console.log('[DEBUG] ws.readyState:', ws?.readyState);

            if (ws && ws.readyState === WebSocket.OPEN) {
                const messageData = {
                    type: 'chat_message',
                    message: finalMessageText,
                    roomId: room.id,
                    imageUrls: uploadedUrls,
                    documents: uploadedDocuments
                };

                console.log('[DEBUG] messageData GlobalChatInput.jsx', messageData);
                console.log('[DEBUG] WebSocket 상태:', ws.readyState);
                console.log('[DEBUG] 전송할 메시지:', JSON.stringify(messageData));
                ws.send(JSON.stringify(messageData));
                console.log('[DEBUG] WebSocket 메시지 전송 완료');
            } else {
                console.error('[DEBUG] WebSocket이 연결되지 않음');
                console.error('[DEBUG] ws:', ws);
                console.error('[DEBUG] ws.readyState:', ws?.readyState);
            }

            // 파일 상태 초기화
            handleRemoveAllAttachedFiles();
            setInput('');
        } catch (error) {
            console.error('파일 업로드 중 오류:', error);
            alert('파일 업로드 중 오류가 발생했습니다.');
        }
    };

    // 다중 이미지 업로드 후 전송 (기존 함수 유지)
    const handleMultipleImagesUploadAndSend = async (messageText) => {
        if (attachedImages.length === 0) return;

        const finalMessageText = messageText || '이미지 첨부';

        try {
            // 각 이미지를 순차적으로 업로드
            const uploadedUrls = [];

            for (let i = 0; i < attachedImages.length; i++) {
                const formData = new FormData();
                formData.append('file', attachedImages[i]);
                formData.append('content', finalMessageText);

                const res = await fetch(`${getApiBase()}/api/chat/upload_image/`, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': getCookie('csrftoken'),
                    },
                    credentials: 'include',
                    body: formData,
                });

                const data = await res.json();
                if (data.status === 'success') {
                    uploadedUrls.push(data.file_url);
                }
            }

            // 모든 이미지가 업로드되면 WebSocket으로 전송
            console.log('uploadedUrls GlobalChatInput.jsx', uploadedUrls);
            if (uploadedUrls.length > 0) {
                if (room && ws && ws.readyState === 1) {
                    const messageData = {
                        message: finalMessageText,
                        imageUrls: uploadedUrls, // 다중 이미지 URL 배열                        
                        roomId: room.id
                    };
                    console.log('messageData GlobalChatInput.jsx', messageData);
                    ws.send(JSON.stringify(messageData));
                } else {
                    // 대기방: localStorage에 임시 저장 후 방 생성
                    localStorage.setItem('pending_image_urls', JSON.stringify(uploadedUrls));
                    localStorage.setItem('pending_auto_message', finalMessageText);
                }
                setInput('');
                handleRemoveAllAttachedImages();
            }
        } catch (error) {
            alert('이미지 업로드에 실패했습니다.');
        }
    };

    // 단일 이미지 업로드 후 전송 (호환성 유지)
    const handleImageUploadAndSendWithFile = async (imageFile, messageText) => {
        if (!imageFile) return;
        try {
            const formData = new FormData();
            formData.append('file', imageFile);
            formData.append('content', messageText || '이미지 첨부');
            const res = await fetch(`${getApiBase()}/api/chat/upload_image/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCookie('csrftoken'),
                },
                credentials: 'include',
                body: formData,
            });
            const data = await res.json();
            if (data.status === 'success') {
                // 방이 있으면 WebSocket 전송, 없으면 localStorage에 임시 저장
                if (room && ws && ws.readyState === 1) {
                    const messageData = {
                        message: messageText || '이미지 첨부',
                        imageUrl: data.file_url,
                        roomId: room.id
                    };
                    ws.send(JSON.stringify(messageData));
                } else {
                    // 대기방: localStorage에 임시 저장 후 방 생성
                    localStorage.setItem('pending_image_url', data.file_url);
                    localStorage.setItem('pending_auto_message', messageText || '이미지 첨부');
                }
                setInput('');
                setAttachedImages([]);
                setAttachedImagePreviews([]);
            }
        } catch (error) {
            alert('이미지 업로드에 실패했습니다.');
        }
    };

    const handleSend = async () => {
        console.log('[DEBUG] handleSend 호출됨, attachedImages:', attachedImages, 'attachedDocuments:', attachedDocuments);

        // 이미지나 문서가 첨부된 경우
        if (attachedImages.length > 0 || attachedDocuments.length > 0) {
            console.log('[DEBUG] 파일이 첨부되어 있으므로 handleMultipleFilesUploadAndSend 호출');
            await handleMultipleFilesUploadAndSend(input);
            return;
        }

        if (!input.trim()) return;
        setLoading(true);
        if (!room) {
            // 대기방: 방 자동 생성 후 이동
            const now = new Date();
            const title = `${input.slice(0, 20)} - ${now.toLocaleString('ko-KR', { hour12: false })}`;
            try {
                // 입력 메시지를 localStorage에 임시 저장
                localStorage.setItem('pending_auto_message', input);
                const res = await csrfFetch(`${getApiBase()}/api/chat/rooms/`, {
                    method: 'POST',
                    body: JSON.stringify({ name: title, is_public: false, room_type: 'ai', ai_provider: 1, ai_response_enabled: true }),
                });
                if (res.ok) {
                    const data = await res.json();
                    // 방 생성 후 user settings도 자동 ON
                    try {
                        await fetch(`${getApiBase()}/api/chat/user/settings/`, {
                            method: 'PATCH',
                            credentials: 'include',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRFToken': getCookie('csrftoken'),
                            },
                            body: JSON.stringify({ ai_response_enabled: true }),
                        });
                    } catch (e) { /* 무시 */ }
                    setTimeout(() => {
                        window.location.href = `/room/${data.id}`;
                    }, 300);
                } else {
                    alert('방 생성 실패');
                }
            } catch {
                alert('방 생성 오류');
            }
        } else {
            // 채팅방: chat_box.jsx와 동일하게 WebSocket 전송 및 pending 메시지 추가
            if (!ws || ws.readyState !== 1) {
                alert('연결이 끊어졌습니다.');
                setLoading(false);
                return;
            }
            const clientId = `${Date.now()}_${Math.random()}`;
            // AI 설정을 WebSocket 페이로드에 포함하여 서버가 즉시 우선 적용하도록 전달
            let clientAI = null;
            try {
                const res = await csrfFetch(`${getApiBase()}/api/chat/user/settings/`, { credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.settings && data.settings.ai_settings) {
                        clientAI = JSON.parse(data.settings.ai_settings);
                    }
                }
            } catch (e) { /* ignore */ }

            const messageData = {
                message: input,
                roomId: room.id,
                client_id: clientId,
                aiProvider: clientAI?.aiProvider,
                lilyApiUrl: clientAI?.lilyApiUrl,
                lilyModel: clientAI?.lilyModel,
                geminiModel: clientAI?.geminiModel,
            };
            ws.send(JSON.stringify(messageData));
            // setRoomMessages 호출 제거 - WebSocket을 통해 받은 메시지가 chat_box.jsx에서 처리됨
        }
        setInput('');
        setLoading(false);
    };

    // 새로운 AI 채팅방 생성 및 이동
    // 방 생성 함수 내에서 localStorage 정리 및 강제 이동 보장
    const handleCreateNewAiRoom = async () => {
        if (!input.trim() && attachedImages.length === 0 && attachedDocuments.length === 0) return;
        setLoading(true);
        const now = new Date();
        const title = `${input.slice(0, 20)} - ${now.toLocaleString('ko-KR', { hour12: false })}`;
        try {
            // 1. 방을 먼저 생성
            const res = await csrfFetch(`${getApiBase()}/api/chat/rooms/`, {
                method: 'POST',
                body: JSON.stringify({ name: title, is_public: false, room_type: 'ai', ai_provider: 1, ai_response_enabled: true }),
            });
            if (res.ok) {
                const roomData = await res.json();
                // 방 생성 후 user settings도 자동 ON
                try {
                    await fetch(`${getApiBase()}/api/chat/user/settings/`, {
                        method: 'PATCH',
                        credentials: 'include',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': getCookie('csrftoken'),
                        },
                        body: JSON.stringify({ ai_response_enabled: true }),
                    });
                } catch (e) { /* 무시 */ }
                // 2. 이미지 첨부가 있으면, 해당 roomId로 이미지 업로드 및 localStorage 저장
                if (attachedImages.length > 0) {
                    try {
                        const uploadedUrls = [];
                        for (let i = 0; i < attachedImages.length; i++) {
                            const formData = new FormData();
                            formData.append('file', attachedImages[i]);
                            formData.append('content', input || '이미지 첨부');
                            const imgRes = await fetch(`${getApiBase()}/api/chat/upload_image/`, {
                                method: 'POST',
                                headers: {
                                    'X-CSRFToken': getCookie('csrftoken'),
                                },
                                credentials: 'include',
                                body: formData,
                            });
                            const imgData = await imgRes.json();
                            if (imgData.status === 'success') {
                                uploadedUrls.push(imgData.file_url);
                            }
                        }
                        if (uploadedUrls.length > 0) {
                            localStorage.setItem('pending_auto_message', input || '이미지 첨부');
                            localStorage.setItem('pending_image_urls', JSON.stringify(uploadedUrls));
                            localStorage.setItem('pending_room_id', String(roomData.id));
                        }
                    } catch {
                        alert('이미지 업로드에 실패했습니다.');
                    }
                } else {
                    // 텍스트만 있을 때도 roomId와 함께 저장
                    localStorage.setItem('pending_auto_message', input);
                    localStorage.setItem('pending_room_id', String(roomData.id));
                    localStorage.removeItem('pending_image_urls');
                }
                setInput('');
                handleRemoveAllAttachedImages();
                setTimeout(() => {
                    window.location.href = `/room/${roomData.id}`;
                }, 300);
            } else {
                // 방 생성 실패 시 localStorage 정리 및 알림
                localStorage.removeItem('pending_auto_message');
                localStorage.removeItem('pending_image_urls');
                localStorage.removeItem('pending_image_message_content');
                localStorage.removeItem('pending_room_id');
                alert('방 생성 실패');
            }
        } catch {
            // 예외 발생 시 localStorage 정리 및 알림
            localStorage.removeItem('pending_auto_message');
            localStorage.removeItem('pending_image_urls');
            localStorage.removeItem('pending_image_message_content');
            localStorage.removeItem('pending_room_id');
            alert('방 생성 오류');
        }
        setLoading(false);
    };

    // 모바일 long-press 핸들러
    const handleTouchStart = () => {
        // --- [수정 2] 타이머 시작 전, 플래그 초기화 ---
        longPressTriggered.current = false;
        const timer = setTimeout(() => {
            if (onOpenCreateRoomModal) onOpenCreateRoomModal();
            // --- [수정 3] long-press가 성공했음을 기록 ---
            longPressTriggered.current = true;
        }, 600);
        setLongPressTimer(timer);
    };

    const handleTouchEnd = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            setLongPressTimer(null);
        }
    };

    // PC용 long-press 핸들러
    const handleMouseDown = (e) => {
        if (e.button !== 0) return;
        // --- [수정 2] 타이머 시작 전, 플래그 초기화 ---
        longPressTriggered.current = false;
        const timer = setTimeout(() => {
            if (onOpenCreateRoomModal) onOpenCreateRoomModal();
            // --- [수정 3] long-press가 성공했음을 기록 ---
            longPressTriggered.current = true;
        }, 600);
        setLongPressTimer(timer);
    };

    const handleMouseUp = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            setLongPressTimer(null);
        }
    };

    // --- [수정 4] 클릭 이벤트를 분기 처리할 새로운 핸들러 ---
    const handleClick = () => {
        // long-press가 실행되었다면, 짧은 클릭 로직(방 생성)을 실행하지 않음
        if (longPressTriggered.current) {
            // 플래그를 다시 초기화하고 함수를 종료
            longPressTriggered.current = false;
            return;
        }
        // long-press가 아니었다면, 기존의 짧은 클릭 로직 실행
        handleCreateNewAiRoom();
    };

    // --- [수정 2] 새로운 이벤트 핸들러 로직 ---

    // 버튼을 누르기 시작할 때 호출될 함수
    const handlePressStart = () => {
        // 이전 타이머가 남아있을 경우를 대비해 초기화
        if (pressTimer.current) {
            clearTimeout(pressTimer.current);
        }
        isLongPress.current = false; // long-press 상태 초기화

        pressTimer.current = setTimeout(() => {
            console.log('Long Press 타이머 실행! 모달을 엽니다.');
            isLongPress.current = true; // 600ms가 지나면 long-press로 처리
            if (onOpenCreateRoomModal) onOpenCreateRoomModal(); // 모달 열기
            // alert('길게 누르기 성공!');
        }, 600);
    };

    // 버튼에서 손을 뗄 때 호출될 함수 (성공적인 클릭)
    const handlePressEnd = () => {
        // 진행 중이던 타이머를 즉시 중단
        if (pressTimer.current) {
            clearTimeout(pressTimer.current);
        }

        // isLongPress 플래그가 false일 때만 짧은 클릭으로 간주
        if (!isLongPress.current) {
            handleCreateNewAiRoom(); // 짧은 클릭 동작 실행
        }
        // isLongPress가 true이면 아무것도 하지 않고 종료 (long-press가 이미 실행됨)
    };

    // 버튼 누른 상태로 벗어나거나 취소될 때 호출될 함수
    const handleCancel = () => {
        if (pressTimer.current) {
            clearTimeout(pressTimer.current);
        }
        // 사용자가 의도적으로 취소한 것이므로 아무 동작도 하지 않음
    };

    // 이모지 추가/리액션 함수 (전역 입력창에서는 임시 alert)
    const handleAddEmoji = (emoji) => {
        alert('이모지 리액션 기능은 채팅방에서만 지원됩니다.');
        // setShowEmojiMenu(false); // 이 부분은 이모지 메뉴 제거로 인해 필요 없어짐
    };
    // 답장/핀/삭제 버튼 핸들러 (전역 입력창에서는 임시 alert)
    const handleReply = () => {
        alert('답장 기능은 채팅방에서만 지원됩니다.'); // setShowEmojiMenu(false); // 이 부분은 이모지 메뉴 제거로 인해 필요 없어짐
    };
    const handlePin = () => {
        alert('고정핀 기능은 채팅방에서만 지원됩니다.'); // setShowEmojiMenu(false); // 이 부분은 이모지 메뉴 제거로 인해 필요 없어짐
    };
    const handleDelete = () => {
        alert('삭제 기능은 채팅방에서만 지원됩니다.'); // setShowEmojiMenu(false); // 이 부분은 이모지 메뉴 제거로 인해 필요 없어짐
    };

    // 이모지 메뉴 관련 상태 및 함수 제거
    // const [showEmojiMenu, setShowEmojiMenu] = useState(false);

    return (
        <div className="global-chat-input" style={{ width: '100%', background: '#23242a', position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 100 }}>

            {/* --- 카메라 모달 --- */}
            {showCamera && (
                <div className="camera-modal" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <Webcam
                        audio={false}
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        width="100%"
                        videoConstraints={{ facingMode: 'user' }}
                    />
                    <div style={{ marginTop: '1rem' }}>
                        <button onClick={handleCapture} style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}>사진 찍기</button>
                        <button onClick={cancelAll} style={{ marginLeft: '1rem', padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}>취소</button>
                    </div>
                </div>
            )}

            {/* --- 이미지 자르기 모달 --- */}
            {capturedImage && (
                <div className="crop-modal" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 400, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ position: 'relative', width: '100%', height: '80%' }}>
                        <Cropper
                            image={capturedImage}
                            crop={crop}
                            zoom={zoom}
                            // aspect={1} // 1:1 비율로 자르기, 자유 비율로 자르고 싶을 때는 비활성화
                            onCropChange={setCrop}
                            onZoomChange={setZoom}
                            onCropComplete={onCropComplete}
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
                        <button onClick={handleCropImage} style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}>자르기 완료</button>
                        <button onClick={cancelAll} style={{ marginLeft: '1rem', padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}>취소</button>
                    </div>
                </div>
            )}

            <div className="global-chat-input-content-box" style={{ position: 'relative', maxWidth: 480, margin: '0 auto' }}>
                {/* 입력창 위에 딱 붙는 첨부 파일 미리보기 (겹치지 않게) */}
                {(attachedImagePreviews.length > 0 || attachedDocumentPreviews.length > 0) && (
                    <div className="attached-file-preview-box" style={{
                        position: 'absolute',
                        left: 0,
                        bottom: '100%',
                        background: '#23242a',
                        borderRadius: 8,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                        padding: 8,
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 8,
                        marginBottom: 4,
                        maxWidth: 320,
                        zIndex: 200
                    }}>
                        {/* 이미지 미리보기 */}
                        {attachedImagePreviews.map((preview, index) => (
                            <div key={`img-${index}`} style={{ position: 'relative' }}>
                                <img
                                    src={preview}
                                    alt={`첨부 이미지 미리보기 ${index + 1}`}
                                    className="attached-image-thumb"
                                    style={{
                                        maxHeight: 120,
                                        maxWidth: 120,
                                        borderRadius: 6,
                                        objectFit: 'cover'
                                    }}
                                />
                                <button
                                    onClick={() => handleRemoveAttachedImage(index)}
                                    className="attached-image-remove-btn"
                                    style={{
                                        position: 'absolute',
                                        top: -8,
                                        right: -8,
                                        color: '#fff',
                                        background: '#f44336',
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

                        {/* 문서 미리보기 */}
                        {attachedDocumentPreviews.map((doc, index) => (
                            <div key={`doc-${index}`} style={{
                                position: 'relative',
                                background: '#2a2b32',
                                borderRadius: 6,
                                padding: 8,
                                minWidth: 120,
                                maxWidth: 200
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: '24px' }}>{doc.icon}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontSize: '12px',
                                            color: '#fff',
                                            fontWeight: 'bold',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {doc.name}
                                        </div>
                                        <div style={{
                                            fontSize: '10px',
                                            color: '#888',
                                            marginTop: 2
                                        }}>
                                            {(doc.size / 1024 / 1024).toFixed(1)}MB
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleRemoveAttachedDocument(index)}
                                    className="attached-document-remove-btn"
                                    style={{
                                        position: 'absolute',
                                        top: -8,
                                        right: -8,
                                        color: '#fff',
                                        background: '#f44336',
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

                        {/* 모두 제거 버튼 */}
                        {(attachedImagePreviews.length + attachedDocumentPreviews.length) > 1 && (
                            <button
                                onClick={handleRemoveAllAttachedFiles}
                                style={{
                                    color: '#fff',
                                    background: '#ff6666',
                                    border: 'none',
                                    borderRadius: 4,
                                    padding: '4px 8px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    alignSelf: 'flex-start'
                                }}
                            >
                                모두 제거
                            </button>
                        )}
                    </div>
                )}

                <div className="global-chat-input-content"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        position: 'relative',
                        background: '#23242a'
                    }}>
                    {/* 이모지(+) 버튼 및 메뉴 */}
                    {/* 이모지 메뉴 제거로 인해 이 부분은 필요 없어짐 */}
                    {/* 새로운 AI 채팅방 생성 버튼 (입력창 왼쪽) */}
                    <button
                        onMouseDown={handlePressStart}
                        onMouseUp={handlePressEnd}
                        onMouseLeave={handleCancel}
                        onTouchStart={handlePressStart}
                        onTouchEnd={handlePressEnd}
                        onTouchCancel={handleCancel}
                        disabled={loading}
                        style={{
                            border: 'none',
                            borderRadius: 8,
                            padding: '8px 8px',
                            cursor: 'pointer',
                            minWidth: 48,
                            margin: '8px 8px 8px 8px',
                        }}
                        title="짧게 클릭: 새 AI 채팅방 자동 생성 / 길게 누르기: 새 대화방 옵션"
                    >
                        <span className="global-chat-input-create-btn-icon">
                            {!room ? '🔥' : '🔥'}
                        </span>
                    </button>
                    <textarea
                        ref={inputRef}
                        placeholder={room ? '안녕하세요' : 'Shot/Long Click 방제 입력 후 새 대화방을 만드세요'}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.stopPropagation(); // 엔터키 전송 방지
                                // e.preventDefault(); // 엔터키 전송, 줄바꿈 방지
                                // handleSend(); // 엔터키 전송
                            }
                        }}
                        rows={1}
                        style={{
                            flex: 1,
                            border: 'none',
                            borderRadius: 8,
                            padding: '4px 4px 4px 8px',
                            fontSize: 15,
                            // background: '#181a20',
                            color: '#fff',
                            resize: 'none',
                            minHeight: '10px',
                            maxHeight: '120px',
                            overflowY: 'auto',
                            textAlign: 'left'
                        }}
                        disabled={loading}
                    />
                    {room && (
                        <button
                            className="global-chat-input-send-btn"
                            onClick={async () => {
                                console.log('[DEBUG] 전송 버튼 클릭됨');
                                console.log('[DEBUG] room:', room);
                                console.log('[DEBUG] attachedImages:', attachedImages);
                                console.log('[DEBUG] attachedDocuments:', attachedDocuments);
                                console.log('[DEBUG] input:', input);

                                if (!room) {
                                    console.log('[DEBUG] 방이 없으므로 handleCreateNewAiRoom 호출');
                                    await handleCreateNewAiRoom();
                                } else if (attachedImages.length > 0 || attachedDocuments.length > 0) {
                                    console.log('[DEBUG] 파일이 첨부되어 있으므로 handleMultipleFilesUploadAndSend 호출');
                                    const currentInput = input;
                                    await handleMultipleFilesUploadAndSend(currentInput);
                                } else {
                                    console.log('[DEBUG] 일반 텍스트 메시지이므로 handleSend 호출');
                                    await handleSend();
                                }
                            }}
                            // disabled={!input.trim() && !attachedImage}
                            style={{
                                border: 'none',
                                borderRadius: 8,
                                padding: '8px 8px',
                                cursor: 'pointer',
                                minWidth: 48,
                                margin: '8px 8px 8px 8px',
                            }}
                        >
                            <span className="global-chat-input-send-btn-icon">
                                🪵
                            </span>
                        </button>
                    )
                    }
                    {room && (
                        <button
                            type="button"
                            className="file-upload-btn-side"
                            onClick={() => {
                                const fileInput = document.getElementById('global-chat-file-upload');
                                if (fileInput) fileInput.click();
                            }}
                            style={{
                                border: 'none',
                                cursor: 'pointer',
                                background: 'transparent',
                                margin: '0 auto',
                            }}
                            title="파일 첨부 (이미지, PDF, 문서)"
                        >
                            <input
                                id="global-chat-file-upload"
                                type="file"
                                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                                multiple={true}
                                style={{ display: 'none' }}
                                onChange={handleFileUpload}
                            />
                            <span className="file-upload-btn-icon"
                                style={{
                                    fontSize: 20,
                                }}
                            >📎</span>
                        </button>
                    )
                    }

                    {/* --- 카메라 버튼 추가 --- */}
                    {room && (
                        <button
                            onClick={handleCameraButtonClick}
                            style={{
                                border: 'none',
                                cursor: 'pointer',
                                background: 'transparent',
                                margin: '0 auto',
                            }}
                        >
                            <span className="global-chat-input-camera-btn-icon"
                                style={{
                                    fontSize: 18,
                                }}
                            >📸</span>
                        </button>
                    )
                    }
                </div>
            </div>
        </div>
    );
};

export default GlobalChatInput; 