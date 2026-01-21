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
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { X, Send, MessageCircle, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";

type ChatMessage = {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderDepartment: string;
  createdAt?: Date;
};

type TypingUser = {
  userId: string;
  userName: string;
  timestamp: Timestamp;
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
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSuperAdmin = userData?.role === "superadmin";

  // Real-time listener for messages
  useEffect(() => {
    if (!currentUser) return;

    const ref = collection(db, "teamChatMessages");
    const q = query(ref, orderBy("createdAt", "asc"), limit(200));

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
            senderDepartment: data.senderDepartment || "",
            createdAt: data.createdAt?.toDate?.() ?? undefined,
          } as ChatMessage;
        });

        setMessages(next);

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

  // Real-time listener for typing indicators
  useEffect(() => {
    if (!currentUser) return;

    const typingRef = collection(db, "chatTyping");
    const unsubscribe = onSnapshot(typingRef, (snapshot) => {
      const now = new Date();
      const typingData = snapshot.docs
        .map((d) => ({
          userId: d.id,
          userName: d.data().userName || "Someone",
          timestamp: d.data().timestamp,
        }))
        .filter((t) => {
          if (t.userId === currentUser.uid) return false;
          const typingTime = t.timestamp?.toDate?.();
          if (!typingTime) return false;
          const diff = now.getTime() - typingTime.getTime();
          return diff < 3000;
        });

      setTypingUsers(typingData);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Mark as read when opened
  useEffect(() => {
    if (open && unreadCount > 0) {
      onMarkAsRead();
    }
  }, [open, unreadCount, onMarkAsRead]);

  // Focus textarea when drawer opens
  useEffect(() => {
    if (open && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open]);

  const updateTypingStatus = async () => {
    if (!currentUser || !userData) return;

    try {
      const typingDocRef = doc(db, "chatTyping", currentUser.uid);
      await updateDoc(typingDocRef, {
        userName: userData.displayName || "Someone",
        timestamp: serverTimestamp(),
      }).catch(async () => {
        await addDoc(collection(db, "chatTyping"), {
          userName: userData.displayName || "Someone",
          timestamp: serverTimestamp(),
        });
      });
    } catch (error) {
      console.error("Error updating typing status:", error);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (e.target.value.trim()) {
      updateTypingStatus();

      typingTimeoutRef.current = setTimeout(async () => {
        if (currentUser) {
          try {
            await deleteDoc(doc(db, "chatTyping", currentUser.uid));
          } catch (error) {
            // Ignore
          }
        }
      }, 2000);
    }
  };

  const send = async () => {
    if (!currentUser || !userData) {
      console.error("No user data");
      return;
    }

    const msg = text.trim();
    if (!msg) return;

    setSending(true);
    try {
      await addDoc(collection(db, "teamChatMessages"), {
        text: msg,
        senderId: currentUser.uid,
        senderName: userData.displayName || "Unknown",
        senderDepartment: userData.department || "",
        createdAt: serverTimestamp(),
      });

      setText("");

      try {
        await deleteDoc(doc(db, "chatTyping", currentUser.uid));
      } catch (error) {
        // Ignore
      }

      setTimeout(() => textareaRef.current?.focus(), 50);
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message. Check console for details.");
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (messageId: string, isOwnMessage: boolean) => {
    const confirmed = window.confirm(
      isOwnMessage 
        ? "Delete your message?" 
        : "Delete this message? (Admin)"
    );
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "teamChatMessages", messageId));
    } catch (error: any) {
      console.error("Error deleting message:", error);
      alert(`Failed to delete message: ${error.message}`);
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
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Drawer - NO HORIZONTAL SCROLL */}
      <div className="fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white z-50 shadow-2xl flex flex-col overflow-x-hidden">
        {/* Header - Minimal */}
        <div className="h-14 px-4 border-b flex items-center justify-between flex-shrink-0 bg-primary-600">
          <div className="flex items-center gap-2 text-white">
            <MessageCircle className="h-5 w-5" />
            <span className="font-semibold">Team Chat</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-white/20 transition text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-2 bg-gray-50">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <MessageCircle className="h-12 w-12 mb-2 opacity-40" />
              <p className="text-sm">No messages yet</p>
            </div>
          ) : (
            messages.map((m) => {
              const mine = m.senderId === currentUser?.uid;
              // User can delete if: it's their own message OR they're superadmin
              const canDelete = mine || isSuperAdmin;
              
              return (
                <div
                  key={m.id}
                  className={`flex ${mine ? "justify-end" : "justify-start"} gap-2`}
                >
                  <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                    {/* Sender Info - DEPARTMENT SHOWN HERE */}
                    {!mine && (
                      <div className="flex items-center gap-1.5 mb-0.5 text-xs px-1">
                        <span className="font-semibold text-gray-700">{m.senderName}</span>
                        {m.senderDepartment && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-500">{m.senderDepartment}</span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div
                      className={`rounded-xl px-3 py-2 text-sm break-words whitespace-pre-wrap ${
                        mine
                          ? "bg-primary-600 text-white"
                          : "bg-white text-gray-800 border border-gray-200"
                      }`}
                    >
                      {m.text}
                    </div>

                    {/* Time */}
                    <span className="text-[10px] text-gray-400 mt-0.5 px-1">
                      {m.createdAt ? format(m.createdAt, "h:mm a") : "..."}
                    </span>
                  </div>

                  {/* Delete Button - ALWAYS VISIBLE for own messages or superadmin */}
                  {canDelete && (
                    <button
                      onClick={() => deleteMessage(m.id, mine)}
                      className="self-center p-1.5 rounded hover:bg-red-50 text-red-500 transition opacity-60 hover:opacity-100"
                      title={mine ? "Delete your message" : "Delete message (Admin)"}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="px-4 py-1.5 bg-gray-50 border-t text-xs text-gray-500 flex items-center gap-2">
            <div className="flex gap-0.5">
              <span className="w-1 h-1 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
              <span className="w-1 h-1 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
              <span className="w-1 h-1 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
            </div>
            <span>
              {typingUsers.length === 1
                ? `${typingUsers[0].userName} is typing...`
                : `${typingUsers.length} people typing...`}
            </span>
          </div>
        )}

        {/* Input - Minimal */}
        <div className="p-3 border-t flex-shrink-0 bg-white">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder="Message..."
              className="flex-1 resize-none px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              disabled={sending}
            />
            <button
              onClick={send}
              disabled={sending || !text.trim()}
              className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition active:scale-95"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
