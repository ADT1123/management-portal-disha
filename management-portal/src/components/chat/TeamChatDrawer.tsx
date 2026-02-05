import { useEffect, useRef, useState, useCallback } from "react";
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
  getDocs,
  startAfter,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { X, Send, MessageCircle, Trash2, Loader2, ChevronUp } from "lucide-react";
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

const MESSAGES_PER_PAGE = 50; // Load only 50 messages at a time
const TYPING_TIMEOUT = 2000;

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
  const [isVisible, setIsVisible] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isInitialLoad = useRef(true);

  const isSuperAdmin = userData?.role === "superadmin";

  // Handle drawer animation
  useEffect(() => {
    if (open) {
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
    }
  }, [open]);

  // Scroll to bottom smoothly
  const scrollToBottom = useCallback((smooth = true) => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    }, 100);
  }, []);

  // Real-time listener for LATEST messages only (optimized)
  useEffect(() => {
    if (!currentUser || !open) return;

    const ref = collection(db, "teamChatMessages");
    const q = query(ref, orderBy("createdAt", "desc"), limit(MESSAGES_PER_PAGE));

    // Clean up previous listener
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const newMessages = snapshot.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              text: data.text || "",
              senderId: data.senderId || "",
              senderName: data.senderName || "Unknown",
              senderDepartment: data.senderDepartment || "",
              createdAt: data.createdAt?.toDate?.() ?? undefined,
            } as ChatMessage;
          })
          .reverse(); // Reverse to show oldest first

        setMessages(newMessages);
        
        // Store last document for pagination
        if (snapshot.docs.length > 0) {
          setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        }
        
        // Check if more messages exist
        setHasMore(snapshot.docs.length === MESSAGES_PER_PAGE);

        // Scroll to bottom on initial load or new message
        if (isInitialLoad.current || snapshot.docChanges().some(change => change.type === 'added')) {
          scrollToBottom(isInitialLoad.current ? false : true);
          isInitialLoad.current = false;
        }
      },
      (error) => {
        console.error("Error in chat listener:", error);
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [currentUser, open, scrollToBottom]);

  // Load older messages (pagination)
  const loadMoreMessages = async () => {
    if (!lastDoc || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const ref = collection(db, "teamChatMessages");
      const q = query(
        ref,
        orderBy("createdAt", "desc"),
        startAfter(lastDoc),
        limit(MESSAGES_PER_PAGE)
      );

      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        setHasMore(false);
        setLoadingMore(false);
        return;
      }

      const olderMessages = snapshot.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            text: data.text || "",
            senderId: data.senderId || "",
            senderName: data.senderName || "Unknown",
            senderDepartment: data.senderDepartment || "",
            createdAt: data.createdAt?.toDate?.() ?? undefined,
          } as ChatMessage;
        })
        .reverse();

      // Prepend older messages
      setMessages((prev) => [...olderMessages, ...prev]);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === MESSAGES_PER_PAGE);
    } catch (error) {
      console.error("Error loading more messages:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Real-time listener for typing indicators (optimized)
  useEffect(() => {
    if (!currentUser || !open) return;

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
  }, [currentUser, open]);

  // Mark as read when opened
  useEffect(() => {
    if (open && unreadCount > 0) {
      onMarkAsRead();
    }
  }, [open, unreadCount, onMarkAsRead]);

  // Focus textarea when drawer opens
  useEffect(() => {
    if (open && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
  }, [open]);

  // Update typing status (debounced)
  const updateTypingStatus = useCallback(async () => {
    if (!currentUser || !userData) return;

    try {
      const typingDocRef = doc(db, "chatTyping", currentUser.uid);
      await updateDoc(typingDocRef, {
        userName: userData.displayName || "Someone",
        timestamp: serverTimestamp(),
      }).catch(async () => {
        // Document doesn't exist, create it
        await addDoc(collection(db, "chatTyping"), {
          userName: userData.displayName || "Someone",
          timestamp: serverTimestamp(),
        });
      });
    } catch (error) {
      console.error("Error updating typing status:", error);
    }
  }, [currentUser, userData]);

  // Clear typing status
  const clearTypingStatus = useCallback(async () => {
    if (!currentUser) return;
    try {
      await deleteDoc(doc(db, "chatTyping", currentUser.uid));
    } catch (error) {
      // Ignore errors
    }
  }, [currentUser]);

  // Handle text change with typing indicator
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Update typing status if typing
    if (newText.trim()) {
      updateTypingStatus();

      // Clear typing status after 2 seconds of no typing
      typingTimeoutRef.current = setTimeout(() => {
        clearTypingStatus();
      }, TYPING_TIMEOUT);
    } else {
      clearTypingStatus();
    }
  };

  // Send message (optimized)
  const send = async () => {
    if (!currentUser || !userData) {
      console.error("No user data");
      return;
    }

    const msg = text.trim();
    if (!msg) return;

    // Validate message length (Firestore supports up to 1MB per document)
    if (msg.length > 10000) {
      alert("Message too long! Maximum 10,000 characters allowed.");
      return;
    }

    setSending(true);
    
    // Clear textarea immediately for better UX
    const messageCopy = msg;
    setText("");
    
    try {
      await addDoc(collection(db, "teamChatMessages"), {
        text: messageCopy,
        senderId: currentUser.uid,
        senderName: userData.displayName || "Unknown",
        senderDepartment: userData.department || "",
        createdAt: serverTimestamp(),
      });

      // Clear typing status
      await clearTypingStatus();

      // Focus back to textarea
      setTimeout(() => textareaRef.current?.focus(), 50);
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message. Please try again.");
      // Restore message on error
      setText(messageCopy);
    } finally {
      setSending(false);
    }
  };

  // Delete message
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

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // Handle close with cleanup
  const handleClose = () => {
    setIsVisible(false);
    clearTypingStatus();
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
        className={`fixed top-0 right-0 h-full w-full sm:w-[420px] md:w-[440px] bg-white z-50 shadow-2xl flex flex-col overflow-hidden transition-transform duration-300 ease-out ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="h-14 sm:h-16 px-3 sm:px-4 border-b flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-primary-600 to-primary-700 shadow-md">
          <div className="flex items-center gap-2 text-white min-w-0">
            <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
            <div className="min-w-0">
              <span className="font-semibold text-sm sm:text-base block truncate">Team Chat</span>
              {messages.length > 0 && (
                <p className="text-[10px] sm:text-xs opacity-90">{messages.length} messages</p>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-white/20 active:bg-white/30 transition text-white flex-shrink-0"
            aria-label="Close chat"
          >
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>

        {/* Messages Area */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-3 space-y-2 bg-gray-50"
        >
          {/* Load More Button */}
          {hasMore && messages.length > 0 && (
            <div className="flex justify-center py-2">
              <button
                onClick={loadMoreMessages}
                disabled={loadingMore}
                className="px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2 transition-all"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    Load older messages
                  </>
                )}
              </button>
            </div>
          )}

          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 px-4">
              <MessageCircle className="h-12 w-12 sm:h-16 sm:w-16 mb-2 sm:mb-3 opacity-40 animate-pulse" />
              <p className="text-sm sm:text-base font-medium">No messages yet</p>
              <p className="text-xs sm:text-sm mt-1 text-center">Start the conversation!</p>
            </div>
          ) : (
            messages.map((m, index) => {
              const mine = m.senderId === currentUser?.uid;
              const canDelete = mine || isSuperAdmin;
              
              return (
                <div
                  key={m.id}
                  className={`flex ${mine ? "justify-end" : "justify-start"} gap-1.5 sm:gap-2`}
                >
                  <div className={`max-w-[78%] sm:max-w-[75%] min-w-0 ${mine ? "items-end" : "items-start"} flex flex-col`}>
                    {/* Sender Info */}
                    {!mine && (
                      <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5 text-[10px] sm:text-xs px-1 max-w-full">
                        <span className="font-semibold text-gray-700 truncate flex-shrink-0 max-w-[100px] sm:max-w-[150px]">
                          {m.senderName}
                        </span>
                        {m.senderDepartment && (
                          <>
                            <span className="text-gray-400 flex-shrink-0">•</span>
                            <span className="text-gray-500 truncate flex-shrink max-w-[60px] sm:max-w-[100px]">
                              {m.senderDepartment}
                            </span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div
                      className={`rounded-2xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm shadow-sm transition-all duration-200 hover:shadow-md ${
                        mine
                          ? "bg-primary-600 text-white rounded-tr-md"
                          : "bg-white text-gray-800 border border-gray-200 rounded-tl-md"
                      }`}
                      style={{
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word',
                        whiteSpace: 'pre-wrap',
                        maxWidth: '100%',
                      }}
                    >
                      {m.text}
                    </div>

                    {/* Time */}
                    <span className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5 px-1">
                      {m.createdAt ? format(m.createdAt, "h:mm a") : "Sending..."}
                    </span>
                  </div>

                  {/* Delete Button */}
                  {canDelete && (
                    <button
                      onClick={() => deleteMessage(m.id, mine)}
                      className="self-center p-1.5 sm:p-2 rounded-lg hover:bg-red-50 active:bg-red-100 text-red-500 transition-all duration-200 opacity-60 hover:opacity-100 active:scale-95 flex-shrink-0"
                      title={mine ? "Delete your message" : "Delete message (Admin)"}
                      aria-label="Delete message"
                    >
                      <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
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
          <div className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-50 border-t text-[10px] sm:text-xs text-gray-600 flex items-center gap-2 animate-fadeIn">
            <div className="flex gap-0.5 sm:gap-1 flex-shrink-0">
              <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
              <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
              <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
            </div>
            <span className="truncate">
              {typingUsers.length === 1
                ? `${typingUsers[0].userName} is typing...`
                : `${typingUsers.length} people typing...`}
            </span>
          </div>
        )}

        {/* Input */}
        <div className="p-2 sm:p-3 border-t flex-shrink-0 bg-white safe-area-bottom">
          <div className="flex items-end gap-1.5 sm:gap-2">
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1 resize-none px-3 py-2 sm:py-2.5 border border-gray-300 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-xs sm:text-sm transition-all duration-200"
              disabled={sending}
              maxLength={10000}
              style={{ minHeight: '36px', maxHeight: '120px' }}
            />
            <button
              onClick={send}
              disabled={sending || !text.trim()}
              className="p-2 sm:p-2.5 bg-primary-600 text-white rounded-lg sm:rounded-xl hover:bg-primary-700 active:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-95 shadow-md hover:shadow-lg flex-shrink-0"
              aria-label="Send message"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
              ) : (
                <Send className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1 px-1">
            {text.length}/10,000 characters
          </p>
        </div>
      </div>

      {/* CSS */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }

        .safe-area-bottom {
          padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
        }

        .overflow-y-auto {
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
        }

        textarea {
          -webkit-appearance: none;
          -moz-appearance: none;
          appearance: none;
          overflow-y: auto;
        }

        @media screen and (max-width: 640px) {
          input[type="text"],
          textarea {
            font-size: 16px !important;
          }
        }
      `}</style>
    </>
  );
};
