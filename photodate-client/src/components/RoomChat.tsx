import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { useRoomStore } from "../state/useRoomStore";
import { socket } from "../lib/socket";
export default function RoomChat() {
  const { messages, roomCode, selfId, connectionStatus, status } =
    useRoomStore();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [messages.length]);
  return (
    <section className="room-chat" aria-label="Room chat">
      <h3>
        <MessageCircle size={17} /> Crew chat
      </h3>
      <p className="studio-note">
        Plan poses, pick favorites, and decide the order together.
      </p>
      <div className="chat-messages" ref={list} role="log" aria-live="polite">
        {messages.length ? (
          messages.map((m) => (
            <div
              key={m.id}
              className={
                m.participantId === selfId
                  ? "chat-bubble is-mine"
                  : "chat-bubble"
              }
            >
              <strong>{m.displayName}</strong>
              <p>{m.text}</p>
            </div>
          ))
        ) : (
          <p className="studio-note">Say hello to your crew.</p>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!roomCode || !text.trim() || pending) return;
          setPending(true);
          setError("");
          socket
            .timeout(8000)
            .emit(
              "send-message",
              { code: roomCode, text: text.trim() },
              (timeout, ack) => {
                setPending(false);
                if (timeout)
                  setError(
                    "Message not confirmed. Check the chat before resending.",
                  );
                else if (!ack.ok) setError(ack.error.message);
                else setText("");
              },
            );
        }}
      >
        <input
          aria-label="Message your room"
          placeholder="Message your crew…"
          maxLength={500}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={pending || status === "closed"}
        />
        <button
          aria-label="Send message"
          disabled={
            !text.trim() ||
            pending ||
            connectionStatus !== "joined" ||
            status === "closed"
          }
        >
          <Send size={16} />
        </button>
      </form>
      {error && (
        <p role="alert" className="studio-note">
          {error}
        </p>
      )}
    </section>
  );
}
