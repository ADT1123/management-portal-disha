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
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { 
  X, 
  Send, 
  MessageCircle, 
  Trash2, 
  Loader2, 
  AlertCircle, 
  Check, 
  CheckCheck, 
  Clock,
  Users,
  ChevronDown
} from "lucide-react";
import { format, isToday, isYesterday, differenceInMinutes } from "date-fns";

type ChatMessage = {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderDepartment: string;
  createdAt?: Date;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  readBy?: string[];
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
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const lastReadMessageRef = useRef<string | null>(null);

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
  const scrollToBottom = (smooth = true) => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    }, 100);
  };

  // Handle scroll to show/hide scroll button
  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    }
  };

  // Format time intelligently
  const formatMessageTime = (date?: Date) => {
    if (!date) return "Sending...";
    
    if (isToday(date)) {
      return format(date, "h:mm a");
    } else if (isYesterday(date)) {
      return `Yesterday ${format(date, "h:mm a")}`;
    } else {
      return format(date, "MMM d, h:mm a");
    }
  };

  // Check if should show time separator
  const shouldShowTimeSeparator = (currentMsg: ChatMessage, prevMsg?: ChatMessage) => {
    if (!prevMsg || !currentMsg.createdAt || !prevMsg.createdAt) return false;
    return differenceInMinutes(currentMsg.createdAt, prevMsg.createdAt) > 30;
  };

  // Mark messages as read
  const markMessagesAsRead = async (messageIds: string[]) => {
    if (!currentUser || messageIds.length === 0) return;

    try {
      const batch = writeBatch(db);
      
      messageIds.forEach(msgId => {
        const msgRef = doc(db, "teamChatMessages", msgId);
        const message = messages.find(m => m.id === msgId);
        const currentReadBy = message?.readBy || [];
        
        if (!currentReadBy.includes(currentUser.uid)) {
          batch.update(msgRef, {
            status: 'read',
            readBy: [...currentReadBy, currentUser.uid]
          });
        }
      });

      await batch.commit();
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  // Real-time messages listener
  useEffect(() => {
    if (!open) return;
    
    console.log("🔥 Starting chat listener...");
    setLoading(true);
    setError(null);

    const messagesRef = collection(db, "teamChatMessages");
    const q = query(messagesRef, orderBy("createdAt", "desc"), limit(100));

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
              status: data.status || 'sent',
              readBy: data.readBy || [],
            } as ChatMessage;
          })
          .reverse();

        setMessages(newMessages);
        setLoading(false);

        // Count unread messages
        if (currentUser) {
          const unread = newMessages.filter(
            m => m.senderId !== currentUser.uid && !m.readBy?.includes(currentUser.uid)
          ).length;
          setUnreadMessages(unread);

          // Auto mark as read if at bottom
          if (messagesContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
            const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
            
            if (isAtBottom) {
              const unreadIds = newMessages
                .filter(m => m.senderId !== currentUser.uid && !m.readBy?.includes(currentUser.uid))
                .map(m => m.id);
              
              if (unreadIds.length > 0 && lastReadMessageRef.current !== unreadIds[unreadIds.length - 1]) {
                lastReadMessageRef.current = unreadIds[unreadIds.length - 1];
                markMessagesAsRead(unreadIds);
              }
            }
          }
        }

        scrollToBottom(false);
      },
      (err) => {
        console.error("❌ Listener error:", err);
        setError(`Error: ${err.message}`);
        setLoading(false);
      }
    );

    return () => {
      console.log("🛑 Stopping chat listener");
      unsubscribe();
    };
  }, [open, currentUser]);

  // Mark as read when opened
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

  // Send message with optimistic update
  const send = async () => {
    if (!currentUser || !userData) {
      alert("Please login first!");
      return;
    }

    const msg = text.trim();
    if (!msg) return;

    setSending(true);
    setText("");
    
    // Optimistic message
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      text: msg,
      senderId: currentUser.uid,
      senderName: userData.displayName || "Unknown",
      senderDepartment: userData.department || "",
      createdAt: new Date(),
      status: 'sending',
      readBy: [],
    };

    setMessages(prev => [...prev, optimisticMessage]);
    scrollToBottom();
    
    try {
      const docRef = await addDoc(collection(db, "teamChatMessages"), {
        text: msg,
        senderId: currentUser.uid,
        senderName: userData.displayName || "Unknown",
        senderDepartment: userData.department || "",
        createdAt: serverTimestamp(),
        status: 'sent',
        readBy: [],
      });

      // Remove optimistic message (real one will come from listener)
      setMessages(prev => prev.filter(m => m.id !== tempId));
      
      console.log("✅ Message sent! ID:", docRef.id);
      setTimeout(() => textareaRef.current?.focus(), 50);
    } catch (err: any) {
      console.error("❌ Send failed:", err);
      alert(`Failed to send: ${err.message}`);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setText(msg);
    } finally {
      setSending(false);
    }
  };

  // Delete message
  const deleteMessage = async (messageId: string, mine: boolean) => {
    if (!window.confirm(mine ? "Delete your message?" : "Delete this message?")) return;

    try {
      await deleteDoc(doc(db, "teamChatMessages", messageId));
    } catch (err: any) {
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

  // Auto-resize textarea
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  // Get message status icon
  const getStatusIcon = (message: ChatMessage) => {
    if (message.senderId !== currentUser?.uid) return null;

    const allRead = message.readBy && message.readBy.length > 0;
    
    if (message.status === 'sending') {
      return <Clock className="h-3 w-3 text-white/60" />;
    } else if (allRead) {
      return <CheckCheck className="h-3.5 w-3.5 text-white/90" />;
    } else if (message.status === 'delivered') {
      return <CheckCheck className="h-3.5 w-3.5 text-white/60" />;
    } else {
      return <Check className="h-3.5 w-3.5 text-white/60" />;
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
        <div className="h-16 px-4 border-b flex items-center justify-between bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-md">
          <div className="flex items-center gap-3">
            <div className="relative">
              <MessageCircle className="h-6 w-6" />
              {unreadMessages > 0 && (
                <div className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold">
                  {unreadMessages}
                </div>
              )}
            </div>
            <div>
              <span className="font-semibold text-base">Team Chat</span>
              {!loading && (
                <div className="flex items-center gap-1 text-xs opacity-90">
                  <Users className="h-3 w-3" />
                  <span>{messages.length} messages</span>
                </div>
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
        <div 
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50 relative"
        >
          {loading && (
            <div className="flex flex-col items-center justify-center h-full">
              <Loader2 className="h-12 w-12 text-purple-600 animate-spin mb-3" />
              <p className="text-gray-500 text-sm font-medium">Loading messages...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full">
              <AlertCircle className="h-12 w-12 text-red-500 mb-3" />
              <p className="text-sm text-red-600 font-medium mb-1">Failed to load chat</p>
              <p className="text-xs text-gray-500 mb-4">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200"
              >
                Reload Page
              </button>
            </div>
          )}

          {!loading && !error && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <MessageCircle className="h-16 w-16 mb-3 opacity-30" />
              <p className="font-semibold text-gray-700">No messages yet</p>
              <p className="text-sm mt-1">Start the conversation! 👋</p>
            </div>
          )}

          {!loading && !error && messages.map((m, index) => {
            const mine = m.senderId === currentUser?.uid;
            const canDelete = mine || isSuperAdmin;
            const prevMessage = index > 0 ? messages[index - 1] : undefined;
            const showTimeSep = shouldShowTimeSeparator(m, prevMessage);
            const showName = !mine && (index === 0 || messages[index - 1].senderId !== m.senderId);
            
            return (
              <div key={m.id}>
                {/* Time Separator */}
                {showTimeSep && m.createdAt && (
                  <div className="flex items-center justify-center my-4">
                    <div className="bg-gray-300 text-gray-600 text-[10px] px-3 py-1 rounded-full font-medium">
                      {formatMessageTime(m.createdAt)}
                    </div>
                  </div>
                )}

                <div className={`flex ${mine ? "justify-end" : "justify-start"} gap-1 group`}>
                  <div className={`max-w-[75%] flex flex-col ${mine ? "items-end" : "items-start"}`}>
                    {/* Sender Name */}
                    {showName && !mine && (
                      <div className="text-xs font-medium text-purple-700 px-2 mb-1">
                        {m.senderName}
                        {m.senderDepartment && (
                          <span className="text-gray-500 font-normal"> • {m.senderDepartment}</span>
                        )}
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div
                      className={`rounded-2xl px-4 py-2.5 shadow-sm ${
                        mine
                          ? "bg-purple-600 text-white rounded-tr-sm"
                          : "bg-white text-gray-800 border border-gray-200 rounded-tl-sm"
                      }`}
                      style={{
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {/* Message Text */}
                      <div className="text-sm">{m.text}</div>
                      
                      {/* Time & Status */}
                      <div className={`flex items-center gap-1 justify-end mt-1 text-[10px] ${
                        mine ? 'text-white/70' : 'text-gray-500'
                      }`}>
                        <span>{m.createdAt ? format(m.createdAt, "h:mm a") : "..."}</span>
                        {mine && getStatusIcon(m)}
                      </div>
                    </div>
                  </div>

                  {/* Delete Button */}
                  {canDelete && (
                    <button
                      onClick={() => deleteMessage(m.id, mine)}
                      className="self-end p-1.5 rounded-full hover:bg-red-100 text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete message"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />

          {/* Scroll to Bottom Button */}
          {showScrollButton && (
            <button
              onClick={() => scrollToBottom()}
              className="fixed bottom-24 right-8 bg-purple-600 text-white p-3 rounded-full shadow-lg hover:bg-purple-700 transition-all animate-bounce"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t bg-white">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={handleTextChange}
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
            {text.length}/5000 • Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </>
  );
};
