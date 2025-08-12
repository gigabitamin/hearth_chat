// components/ChatMessage.tsx
import React from "react";
import AiMessageRenderer from "./AiMessageRenderer";

interface ChatMessageProps {
  role: "user" | "ai";
  content: string;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ role, content }) => {
  return (
    <div className={`my-2 p-3 rounded-xl ${role === "ai" ? "bg-gray-100" : "bg-blue-100"}`}>
      <AiMessageRenderer content={content} />
    </div>
  );
};

export default ChatMessage;
