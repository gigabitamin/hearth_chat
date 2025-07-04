import React, { useState, useEffect, useRef } from 'react';
import Avatar3D from './Avatar3D';
import readyPlayerMeService from '../services/readyPlayerMe';
import './chat_box.css';

const ChatBox = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [userAvatar, setUserAvatar] = useState(null);
  const [aiAvatar, setAiAvatar] = useState(null);
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [isAiTalking, setIsAiTalking] = useState(false);
  const [userEmotion, setUserEmotion] = useState('neutral');
  const [aiEmotion, setAiEmotion] = useState('neutral');
  const ws = useRef(null);
  const [displayedAiText, setDisplayedAiText] = useState('');
  const [mouthTrigger, setMouthTrigger] = useState(0);
  const [currentAiMessage, setCurrentAiMessage] = useState('');

  useEffect(() => {
    console.log('ChatBox 컴포넌트 마운트됨');

    // 아바타 초기화
    initializeAvatars();

    // 웹소켓 연결
    ws.current = new WebSocket('ws://localhost:8000/ws/chat/');

    ws.current.onopen = () => {
      console.log('WebSocket 연결 성공');
    };

    ws.current.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setMessages((prev) => [...prev, { type: 'recv', text: data.message }]);
      setCurrentAiMessage(data.message); // 타이핑 효과용

      // AI가 응답할 때 애니메이션 (타이핑이 끝날 때까지 유지)
      setIsAiTalking(true);

      // AI 감정 분석 (간단한 키워드 기반)
      const emotion = analyzeEmotion(data.message);
      setAiEmotion(emotion);
    };

    ws.current.onclose = () => {
      console.log('WebSocket 연결 종료');
    };

    return () => {
      ws.current.close();
    };
  }, []);

  useEffect(() => {
    if (!isAiTalking || !currentAiMessage) {
      // 타이핑이 끝나면 mouthTrigger를 0으로 리셋
      setMouthTrigger(0);
      return;
    }

    let i = 0;
    setDisplayedAiText('');
    const interval = setInterval(() => {
      setDisplayedAiText(currentAiMessage.slice(0, i + 1));
      setMouthTrigger(prev => {
        const newValue = prev + 1;
        console.log('mouthTrigger 증가:', newValue);
        return newValue;
      }); // 트리거 값 증가
      i++;
      if (i >= currentAiMessage.length) {
        clearInterval(interval);
        // 타이핑이 완전히 끝나면 mouthTrigger를 0으로 리셋하고 isAiTalking을 false로 설정
        setTimeout(() => {
          setMouthTrigger(0);
          setIsAiTalking(false); // 타이핑이 끝나면 말하는 상태를 false로
        }, 200);
      }
    }, 30); // 30ms마다 한 글자씩 (빠른 타이핑)
    return () => clearInterval(interval);
  }, [isAiTalking, currentAiMessage]);

  // 아바타 초기화
  const initializeAvatars = async () => {
    try {
      console.log('아바타 초기화 시작');

      // 샘플 아바타 URL 사용 (실제로는 API 호출)
      const sampleAvatars = readyPlayerMeService.getSampleAvatars();
      console.log('샘플 아바타:', sampleAvatars);

      setUserAvatar(sampleAvatars.user);
      setAiAvatar(sampleAvatars.ai);

      // 실제 API 호출 시:
      // const userAvatarUrl = await readyPlayerMeService.createRandomAvatar('male');
      // const aiAvatarUrl = await readyPlayerMeService.createRandomAvatar('female');
      // setUserAvatar(userAvatarUrl);
      // setAiAvatar(aiAvatarUrl);
    } catch (error) {
      console.error('아바타 초기화 실패:', error);
    }
  };

  // 감정 분석 (간단한 키워드 기반)
  const analyzeEmotion = (text) => {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('😊') || lowerText.includes('😄') || lowerText.includes('좋아') || lowerText.includes('행복')) {
      return 'happy';
    } else if (lowerText.includes('😢') || lowerText.includes('😭') || lowerText.includes('슬퍼') || lowerText.includes('안타까워')) {
      return 'sad';
    } else if (lowerText.includes('😠') || lowerText.includes('😡') || lowerText.includes('화나') || lowerText.includes('짜증')) {
      return 'angry';
    }

    return 'neutral';
  };

  const sendMessage = () => {
    if (input.trim() === '') return;

    // 사용자가 말할 때 애니메이션
    setIsUserTalking(true);
    setTimeout(() => setIsUserTalking(false), 2000);

    // 사용자 감정 분석
    const emotion = analyzeEmotion(input);
    setUserEmotion(emotion);

    ws.current.send(JSON.stringify({ message: input }));
    setMessages((prev) => [...prev, { type: 'send', text: input }]);
    setInput('');
  };

  return (
    <div className="chat-container-with-avatars">
      {/* 데스크톱 레이아웃 */}
      <div className="desktop-layout">
        {/* 사용자 아바타 (왼쪽) */}
        <div className="avatar-section left">
          <Avatar3D
            avatarUrl={userAvatar}
            isTalking={isUserTalking}
            emotion={userEmotion}
            position="left"
            size={250}
          />
        </div>

        {/* 채팅창 (중앙) */}
        <div className="chat-section">
          <div className="chat-container">
            <div className="chat-log">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`chat-bubble ${msg.type === 'send' ? 'sent' : 'received'}`}
                >
                  {msg.type === 'recv' && idx === messages.length - 1 && isAiTalking
                    ? displayedAiText
                    : msg.text}
                </div>
              ))}
            </div>
            <div className="chat-input-area">
              <input
                type="text"
                placeholder="메시지를 입력하세요"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              />
              <button onClick={sendMessage}>전송</button>
            </div>
          </div>
        </div>

        {/* AI 아바타 (오른쪽) */}
        <div className="avatar-section right">
          <Avatar3D
            avatarUrl={aiAvatar}
            isTalking={isAiTalking}
            emotion={aiEmotion}
            mouthTrigger={mouthTrigger} // 반드시 추가!
            position="right"
            size={250}
          />
        </div>
      </div>

      {/* 모바일 레이아웃 */}
      <div className="mobile-layout">
        {/* 아바타들을 위쪽에 좌우로 배치 */}
        <div className="avatar-container">
          <div className="avatar-section left">
            <Avatar3D
              avatarUrl={userAvatar}
              isTalking={isUserTalking}
              emotion={userEmotion}
              position="left"
              size={200}
            />
          </div>
          <div className="avatar-section right">
            <Avatar3D
              avatarUrl={aiAvatar}
              isTalking={isAiTalking}
              emotion={aiEmotion}
              mouthTrigger={mouthTrigger} // 반드시 추가!
              position="right"
              size={200}
            />
          </div>
        </div>

        {/* 채팅창 (아래쪽) */}
        <div className="chat-section">
          <div className="chat-container">
            <div className="chat-log">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`chat-bubble ${msg.type === 'send' ? 'sent' : 'received'}`}
                >
                  {msg.type === 'recv' && idx === messages.length - 1 && isAiTalking
                    ? displayedAiText
                    : msg.text}
                </div>
              ))}
            </div>
            <div className="chat-input-area">
              <input
                type="text"
                placeholder="메시지를 입력하세요"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              />
              <button onClick={sendMessage}>전송</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatBox;
