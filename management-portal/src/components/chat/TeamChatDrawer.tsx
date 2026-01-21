import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { X, Send, MessageCircle } from "lucide-react";
import { format } from "date-fns";

type ChatMessage = {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  createdAt?: Date;
};

export const TeamChatDrawer = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const { currentUser, userData } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Real-time listener for messages
  useEffect(() => {
    if (!currentUser) return;

    const ref = collection(db, "teamChatMessages");
    const q = query(ref, orderBy("createdAt", "asc"), limit(200));

    // onSnapshot for REAL-TIME updates
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const next = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            text: data.text || "",
            senderId: data.senderId || "",
            senderName: data.senderName || "Unknown",
            senderRole: data.senderRole || "member",
            createdAt: data.createdAt?.toDate?.() ?? undefined,
          } as ChatMessage;
        });

        console.log("Real-time update - Messages:", next.length); // Debug log
        setMessages(next);

        // Auto-scroll to bottom
        setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      },
      (error) => {
        console.error("Error in chat listener:", error);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  const send = async () => {
    if (!currentUser || !userData) {
      console.error("No user data");
      return;
    }

    const msg = text.trim();
    if (!msg) return;

    setSending(true);
    try {
      console.log("Sending message:", msg); // Debug log

      await addDoc(collection(db, "teamChatMessages"), {
        text: msg,
        senderId: currentUser.uid,
        senderName: userData.displayName || "Unknown",
        senderRole: userData.role || "member",
        createdAt: serverTimestamp(),
      });

      console.log("Message sent successfully!"); // Debug log
      setText("");
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message. Check console for details.");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/40 z-40" 
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white z-50 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="h-16 px-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-lg font-bold text-gray-900">Team Chat</p>
            <p className="text-xs text-gray-500">Live messages • {messages.length} total</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5 text-gray-700" />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <MessageCircle className="h-16 w-16 mb-3 opacity-50" />
              <p className="text-sm font-medium">No messages yet</p>
              <p className="text-xs mt-1">Start the conversation!</p>
            </div>
          ) : (
            messages.map((m) => {
              const mine = m.senderId === currentUser?.uid;
              return (
                <div 
                  key={m.id} 
                  className={`flex ${mine ? "justify-end" : "justify-start"} animate-fadeIn`}
                >
                  <div className={`max-w-[85%] ${mine ? "text-right" : "text-left"}`}>
                    {/* Sender Info */}
                    {!mine && (
                      <div className="flex items-center gap-2 mb-1 text-xs">
                        <span className="font-semibold text-gray-700">{m.senderName}</span>
                        <span
                          className={`uppercase px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            m.senderRole === "superadmin"
                              ? "bg-red-100 text-red-700"
                              : m.senderRole === "admin"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {m.senderRole}
                        </span>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-500">
                          {m.createdAt ? format(m.createdAt, "hh:mm a") : "sending..."}
                        </span>
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div
                      className={`rounded-2xl px-4 py-2 text-sm break-words whitespace-pre-wrap shadow-sm ${
                        mine
                          ? "bg-primary-600 text-white rounded-tr-sm"
                          : "bg-white text-gray-900 rounded-tl-sm border border-gray-200"
                      }`}
                    >
                      {m.text}
                    </div>

                    {/* Time for your messages */}
                    {mine && (
                      <div className="text-xs text-gray-500 mt-1">
                        {m.createdAt ? format(m.createdAt, "hh:mm a") : "sending..."}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-200 flex-shrink-0 bg-white">
          <div className="flex items-end gap-2">
            <textarea
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type message... (Shift+Enter for new line)"
              className="flex-1 resize-none px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={sending}
            />
            <button
              onClick={send}
              disabled={sending || !text.trim()}
              className="p-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-md active:scale-95"
              title="Send message"
            >
              {sending ? (
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Press Enter to send • Shift+Enter for new line
          </p>
        </div>
      </div>
    </>
  );
};