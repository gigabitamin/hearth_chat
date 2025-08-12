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
            // 로컬 미디어 스트림 획득
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });

            // WebRTC 연결 설정
            this.peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });

            // 로컬 스트림 추가
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // 원격 스트림 처리
            this.peerConnection.ontrack = (event) => {
                this.remoteStream = event.streams[0];
                if (this.onRemoteStreamReceived) {
                    this.onRemoteStreamReceived(this.remoteStream);
                }
            };

            // ICE 후보 처리
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
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
                if (this.onConnectionStateChange) {
                    this.onConnectionStateChange(this.peerConnection.connectionState);
                }
            };

            this.peerConnection.oniceconnectionstatechange = () => {
                if (this.onIceConnectionStateChange) {
                    this.onIceConnectionStateChange(this.peerConnection.iceConnectionState);
                }
            };

            return this.localStream;
        } catch (error) {
            console.error('화상채팅 초기화 실패:', error);
            throw error;
        }
    }

    async createOffer() {
        try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);

            this.sendSignalingMessage({
                type: 'offer',
                offer: offer,
                roomId: this.roomId,
                userId: this.userId
            });
        } catch (error) {
            console.error('Offer 생성 실패:', error);
            throw error;
        }
    }

    async handleOffer(offer, remoteUserId) {
        try {
            await this.peerConnection.setRemoteDescription(offer);
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            this.sendSignalingMessage({
                type: 'answer',
                answer: answer,
                roomId: this.roomId,
                userId: this.userId,
                targetUserId: remoteUserId
            });
        } catch (error) {
            console.error('Offer 처리 실패:', error);
            throw error;
        }
    }

    async handleAnswer(answer) {
        try {
            await this.peerConnection.setRemoteDescription(answer);
        } catch (error) {
            console.error('Answer 처리 실패:', error);
            throw error;
        }
    }

    async handleIceCandidate(candidate) {
        try {
            await this.peerConnection.addIceCandidate(candidate);
        } catch (error) {
            console.error('ICE 후보 처리 실패:', error);
            throw error;
        }
    }

    sendSignalingMessage(message) {
        if (this.signalingSocket && this.signalingSocket.readyState === WebSocket.OPEN) {
            console.log('[VideoCallService] 시그널링 메시지 전송:', message.type);
            this.signalingSocket.send(JSON.stringify(message));
        } else {
            console.error('[VideoCallService] 시그널링 소켓이 연결되지 않음:', {
                hasSocket: !!this.signalingSocket,
                readyState: this.signalingSocket?.readyState
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