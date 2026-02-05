import { useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { X, Send, MessageCircle, Trash2, Loader2, AlertCircle } from "lucide-react";
import { format } from "date-fns";

type ChatMessage = {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderDepartment: string;
  createdAt?: Date;
};

export const TeamChatDrawer = ({
  open,
  onClose,
  unreadCount,
  onMarkAsRead,
}: {
  open: boolean;
  onClose: () => void;
  unreadCount: number;
  onMarkAsRead: () => void;
}) => {
  const { currentUser, userData } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isSuperAdmin = userData?.role === "superadmin";

  // Drawer animation
  useEffect(() => {
    if (open) {
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
    }
  }, [open]);

  // Scroll to bottom
  const scrollToBottom = () => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // Real-time messages listener
  useEffect(() => {
    if (!open) return;
    
    console.log("🔥 Starting chat listener...");
    setLoading(true);
    setError(null);

    const messagesRef = collection(db, "teamChatMessages");
    const q = query(messagesRef, orderBy("createdAt", "desc"), limit(50));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log("✅ Got messages:", snapshot.size);
        
        const newMessages = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              text: data.text || "",
              senderId: data.senderId || "",
              senderName: data.senderName || "Unknown",
              senderDepartment: data.senderDepartment || "",
              createdAt: data.createdAt?.toDate?.() ?? undefined,
            } as ChatMessage;
          })
          .reverse(); // Oldest first

        setMessages(newMessages);
        setLoading(false);
        scrollToBottom();
      },
      (err) => {
        console.error("❌ Listener error:", err);
        console.error("Error code:", err.code);
        console.error("Error message:", err.message);
        setError(`Error: ${err.message}`);
        setLoading(false);
      }
    );

    return () => {
      console.log("🛑 Stopping chat listener");
      unsubscribe();
    };
  }, [open]);

  // Mark as read
  useEffect(() => {
    if (open && unreadCount > 0) {
      onMarkAsRead();
    }
  }, [open, unreadCount, onMarkAsRead]);

  // Focus textarea
  useEffect(() => {
    if (open && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
  }, [open]);

  // Send message
  const send = async () => {
    if (!currentUser || !userData) {
      console.error("❌ No user data");
      alert("Please login first!");
      return;
    }

    const msg = text.trim();
    if (!msg) {
      console.log("⚠️ Empty message");
      return;
    }

    console.log("📤 Sending message...", msg.substring(0, 30));
    setSending(true);
    
    // Clear input immediately
    setText("");
    
    try {
      const docRef = await addDoc(collection(db, "teamChatMessages"), {
        text: msg,
        senderId: currentUser.uid,
        senderName: userData.displayName || "Unknown",
        senderDepartment: userData.department || "",
        createdAt: serverTimestamp(),
      });

      console.log("✅ Message sent! ID:", docRef.id);
      scrollToBottom();
      setTimeout(() => textareaRef.current?.focus(), 50);
    } catch (err: any) {
      console.error("❌ Send failed:", err);
      console.error("Error code:", err.code);
      console.error("Error message:", err.message);
      alert(`Failed to send message: ${err.message}`);
      setText(msg); // Restore message
    } finally {
      setSending(false);
    }
  };

  // Delete message
  const deleteMessage = async (messageId: string, mine: boolean) => {
    const confirmed = window.confirm(
      mine ? "Delete your message?" : "Delete this message? (Admin)"
    );
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "teamChatMessages", messageId));
      console.log("✅ Message deleted");
    } catch (err: any) {
      console.error("❌ Delete failed:", err);
      alert(`Failed to delete: ${err.message}`);
    }
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // Close drawer
  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 250);
  };

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div 
        className={`fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white z-50 shadow-2xl flex flex-col transition-transform duration-300 ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="h-16 px-4 border-b flex items-center justify-between bg-gradient-to-r from-purple-600 to-purple-700 text-white">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-6 w-6" />
            <div>
              <span className="font-semibold text-base">Team Chat</span>
              {!loading && (
                <p className="text-xs opacity-90">{messages.length} messages</p>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-white/20 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {loading && (
            <div className="flex flex-col items-center justify-center h-full">
              <Loader2 className="h-12 w-12 text-purple-600 animate-spin mb-3" />
              <p className="text-gray-500 text-sm">Loading messages...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full">
              <AlertCircle className="h-12 w-12 text-red-500 mb-3" />
              <p className="text-sm text-red-600 font-medium mb-1">Failed to load chat</p>
              <p className="text-xs text-gray-500 mb-4">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium"
              >
                Reload Page
              </button>
            </div>
          )}

          {!loading && !error && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <MessageCircle className="h-16 w-16 mb-3 opacity-30" />
              <p className="font-medium">No messages yet</p>
              <p className="text-sm mt-1">Be the first to say hi! 👋</p>
            </div>
          )}

          {!loading && !error && messages.map((m) => {
            const mine = m.senderId === currentUser?.uid;
            const canDelete = mine || isSuperAdmin;
            
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"} gap-2`}
              >
                <div className={`max-w-[75%] flex flex-col ${mine ? "items-end" : "items-start"}`}>
                  {!mine && (
                    <div className="text-xs text-gray-600 px-2 mb-1">
                      <span className="font-semibold">{m.senderName}</span>
                      {m.senderDepartment && (
                        <span className="text-gray-500"> • {m.senderDepartment}</span>
                      )}
                    </div>
                  )}

                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                      mine
                        ? "bg-purple-600 text-white rounded-tr-sm"
                        : "bg-white text-gray-800 border border-gray-200 rounded-tl-sm"
                    }`}
                    style={{
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {m.text}
                  </div>

                  <span className="text-[10px] text-gray-400 mt-1 px-2">
                    {m.createdAt ? format(m.createdAt, "h:mm a") : "Sending..."}
                  </span>
                </div>

                {canDelete && (
                  <button
                    onClick={() => deleteMessage(m.id, mine)}
                    className="self-center p-2 rounded-lg hover:bg-red-50 text-red-500 opacity-60 hover:opacity-100 transition"
                    title={mine ? "Delete your message" : "Delete (Admin)"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t bg-white">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1 resize-none px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              disabled={sending || loading}
              maxLength={5000}
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
            <button
              onClick={send}
              disabled={sending || !text.trim() || loading}
              className="p-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md hover:shadow-lg"
            >
              {sending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 px-1">
            {text.length}/5000 • Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </>
  );
};
