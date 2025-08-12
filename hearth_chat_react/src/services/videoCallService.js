class VideoCallService {
    constructor() {
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.signalingSocket = null;
        this.roomId = null;
        this.userId = null;
        this.onRemoteStreamReceived = null;
        this.onConnectionStateChange = null;
        this.onIceConnectionStateChange = null;
        this.isScreenSharing = false; // 화면공유 상태 추가
        this.screenShareStream = null; // 화면공유 스트림 추가
    }

    async initializeVideoCall(roomId, userId) {
        this.roomId = roomId;
        this.userId = userId;

        try {
            console.log('[VideoCallService] 화상채팅 초기화 시작');

            // 로컬 미디어 스트림 획득
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            console.log('[VideoCallService] 로컬 스트림 획득 성공:', this.localStream.getTracks().length, '개 트랙');

            // WebRTC 연결 설정
            this.peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });
            console.log('[VideoCallService] RTCPeerConnection 생성됨');

            // 로컬 스트림 추가
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
                console.log('[VideoCallService] 트랙 추가됨:', track.kind);
            });

            // 원격 스트림 처리
            this.peerConnection.ontrack = (event) => {
                console.log('[VideoCallService] 원격 스트림 수신됨:', event.streams.length, '개 스트림');
                this.remoteStream = event.streams[0];
                if (this.onRemoteStreamReceived) {
                    this.onRemoteStreamReceived(this.remoteStream);
                }
            };

            // ICE 후보 처리
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log('[VideoCallService] ICE 후보 생성됨');
                    this.sendSignalingMessage({
                        type: 'ice_candidate',
                        candidate: event.candidate,
                        roomId: this.roomId,
                        userId: this.userId
                    });
                }
            };

            // 연결 상태 변화 모니터링
            this.peerConnection.onconnectionstatechange = () => {
                const state = this.peerConnection.connectionState;
                console.log('[VideoCallService] WebRTC 연결 상태 변경:', state);
                if (this.onConnectionStateChange) {
                    this.onConnectionStateChange(state);
                }
            };

            this.peerConnection.oniceconnectionstatechange = () => {
                const state = this.peerConnection.iceConnectionState;
                console.log('[VideoCallService] ICE 연결 상태 변경:', state);
                if (this.onIceConnectionStateChange) {
                    this.onIceConnectionStateChange(state);
                }
            };

            // 초기 상태 설정
            if (this.onConnectionStateChange) {
                this.onConnectionStateChange(this.peerConnection.connectionState);
            }
            if (this.onIceConnectionStateChange) {
                this.onIceConnectionStateChange(this.peerConnection.iceConnectionState);
            }

            console.log('[VideoCallService] 화상채팅 초기화 완료');
            return this.localStream;
        } catch (error) {
            console.error('[VideoCallService] 화상채팅 초기화 실패:', error);
            throw error;
        }
    }

    async createOffer() {
        try {
            console.log('[VideoCallService] Offer 생성 시작');
            const offer = await this.peerConnection.createOffer();
            console.log('[VideoCallService] Offer 생성됨:', offer.type);

            await this.peerConnection.setLocalDescription(offer);
            console.log('[VideoCallService] 로컬 설명 설정됨');

            const message = {
                type: 'offer',
                offer: offer,
                roomId: this.roomId,
                userId: this.userId
            };

            console.log('[VideoCallService] Offer 메시지 전송 시도:', message);
            this.sendSignalingMessage(message);

        } catch (error) {
            console.error('[VideoCallService] Offer 생성 실패:', error);
            throw error;
        }
    }

    async handleOffer(offer, remoteUserId) {
        try {
            console.log('[VideoCallService] Offer 처리 시작:', remoteUserId);
            console.log('[VideoCallService] Offer SDP:', offer.sdp.substring(0, 100) + '...');

            await this.peerConnection.setRemoteDescription(offer);
            console.log('[VideoCallService] 원격 설명 설정 완료');

            const answer = await this.peerConnection.createAnswer();
            console.log('[VideoCallService] Answer 생성됨:', answer.type);

            await this.peerConnection.setLocalDescription(answer);
            console.log('[VideoCallService] 로컬 Answer 설명 설정 완료');

            const message = {
                type: 'answer',
                answer: answer,
                roomId: this.roomId,
                userId: this.userId,
                targetUserId: remoteUserId
            };

            console.log('[VideoCallService] Answer 메시지 전송 시도:', message);
            this.sendSignalingMessage(message);
            console.log('[VideoCallService] Answer 전송 완료');

        } catch (error) {
            console.error('[VideoCallService] Offer 처리 실패:', error);
            throw error;
        }
    }

    async handleAnswer(answer) {
        try {
            console.log('[VideoCallService] Answer 처리 시작');
            console.log('[VideoCallService] Answer SDP:', answer.sdp.substring(0, 100) + '...');

            await this.peerConnection.setRemoteDescription(answer);
            console.log('[VideoCallService] 원격 Answer 설명 설정 완료');

        } catch (error) {
            console.error('[VideoCallService] Answer 처리 실패:', error);
            throw error;
        }
    }

    async handleIceCandidate(candidate) {
        try {
            console.log('[VideoCallService] ICE 후보 처리 시작:', candidate.candidate.substring(0, 50) + '...');

            await this.peerConnection.addIceCandidate(candidate);
            console.log('[VideoCallService] ICE 후보 추가 완료');

        } catch (error) {
            console.error('[VideoCallService] ICE 후보 처리 실패:', error);
            throw error;
        }
    }

    sendSignalingMessage(message) {
        console.log('[VideoCallService] 시그널링 메시지 전송 시도:', {
            type: message.type,
            hasSocket: !!this.signalingSocket,
            readyState: this.signalingSocket?.readyState,
            message: message
        });

        if (this.signalingSocket && this.signalingSocket.readyState === WebSocket.OPEN) {
            try {
                const messageStr = JSON.stringify(message);
                console.log('[VideoCallService] 메시지 직렬화됨:', messageStr);
                this.signalingSocket.send(messageStr);
                console.log('[VideoCallService] 시그널링 메시지 전송 성공:', message.type);
            } catch (error) {
                console.error('[VideoCallService] 메시지 전송 중 오류:', error);
            }
        } else {
            console.error('[VideoCallService] 시그널링 소켓이 연결되지 않음:', {
                hasSocket: !!this.signalingSocket,
                readyState: this.signalingSocket?.readyState,
                expectedState: WebSocket.OPEN
            });
        }
    }

    setSignalingSocket(socket) {
        this.signalingSocket = socket;
    }

    setCallbacks(callbacks) {
        if (callbacks.onRemoteStreamReceived) {
            this.onRemoteStreamReceived = callbacks.onRemoteStreamReceived;
        }
        if (callbacks.onConnectionStateChange) {
            this.onConnectionStateChange = callbacks.onConnectionStateChange;
        }
        if (callbacks.onIceConnectionStateChange) {
            this.onIceConnectionStateChange = callbacks.onIceConnectionStateChange;
        }
    }

    stopVideoCall() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }
        if (this.peerConnection) {
            this.peerConnection.close();
        }
        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;
    }

    // 카메라/마이크 제어
    toggleMute() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                return !audioTrack.enabled;
            }
        }
        return false;
    }

    toggleVideo() {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                return !videoTrack.enabled;
            }
        }
        return false;
    }

    async toggleScreenShare() {
        try {
            if (!this.isScreenSharing) {
                // 화면공유 시작
                const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true
                });

                const videoTrack = screenStream.getVideoTracks()[0];
                const sender = this.peerConnection
                    .getSenders()
                    .find(s => s.track && s.track.kind === 'video');

                if (sender) {
                    sender.replaceTrack(videoTrack);
                }

                this.isScreenSharing = true;
                this.screenShareStream = screenStream; // 화면공유 스트림 저장

                // 화면공유 스트림 반환
                return screenStream;
            } else {
                // 원래 카메라로 복원
                const cameraStream = await navigator.mediaDevices.getUserMedia({
                    video: true
                });

                const videoTrack = cameraStream.getVideoTracks()[0];
                const sender = this.peerConnection
                    .getSenders()
                    .find(s => s.track && s.track.kind === 'video');

                if (sender) {
                    sender.replaceTrack(videoTrack);
                }

                // 기존 화면공유 스트림 정리
                if (this.screenShareStream) {
                    this.screenShareStream.getTracks().forEach(track => track.stop());
                    this.screenShareStream = null;
                }

                this.isScreenSharing = false;

                // 카메라 스트림 반환
                return cameraStream;
            }
        } catch (error) {
            console.error('화면 공유 전환 실패:', error);
            throw error;
        }
    }

    // 화면공유 상태 확인
    getScreenSharingState() {
        return this.isScreenSharing;
    }

    // 화면공유 스트림 가져오기
    getScreenShareStream() {
        return this.screenShareStream;
    }
}

export default new VideoCallService(); 