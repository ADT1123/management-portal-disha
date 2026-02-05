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
  setDoc,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { 
  X, 
  Send, 
  Trash2, 
  Loader2, 
  Check, 
  CheckCheck, 
  Clock,
  ChevronDown,
  User
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";

type User = {
  uid: string;
  displayName: string;
  department: string;
  role: string;
  email: string;
};

type Message = {
  id: string;
  text: string;
  senderId: string;
  recipientId: string;
  createdAt?: Date;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
};

type PersonalChatDrawerProps = {
  open: boolean;
  onClose: () => void;
  recipient: User;
};

export const PersonalChatDrawer = ({ open, onClose, recipient }: PersonalChatDrawerProps) => {
  const { currentUser, userData } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [chatId, setChatId] = useState<string>("");
  
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  // Generate chat ID
  useEffect(() => {
    if (currentUser && recipient) {
      const ids = [currentUser.uid, recipient.uid].sort();
      setChatId(`${ids[0]}_${ids[1]}`);
    }
  }, [currentUser, recipient]);

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

  // Handle scroll
  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    }
  };

  // Format time
  const formatTime = (date?: Date) => {
    if (!date) return "...";
    if (isToday(date)) return format(date, "h:mm a");
    if (isYesterday(date)) return `Yesterday ${format(date, "h:mm a")}`;
    return format(date, "MMM d, h:mm a");
  };

  // Real-time messages listener
  useEffect(() => {
    if (!open || !chatId || !currentUser) return;

    setLoading(true);

    const messagesRef = collection(db, "personalChats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "desc"), limit(100));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            text: data.text || "",
            senderId: data.senderId || "",
            recipientId: data.recipientId || "",
            createdAt: data.createdAt?.toDate?.() ?? undefined,
            status: data.status || 'sent',
          } as Message;
        })
        .reverse();

      setMessages(newMessages);
      setLoading(false);
      scrollToBottom(false);

      // Mark messages as read
      newMessages.forEach(msg => {
        if (msg.senderId === recipient.uid && msg.status !== 'read') {
          const msgRef = doc(db, "personalChats", chatId, "messages", msg.id);
          setDoc(msgRef, { status: 'read' }, { merge: true });
        }
      });
    });

    return () => unsubscribe();
  }, [open, chatId, currentUser, recipient]);

  // Focus textarea
  useEffect(() => {
    if (open && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
  }, [open]);

  // Send message
  const send = async () => {
    if (!currentUser || !chatId) return;

    const msg = text.trim();
    if (!msg) return;

    setSending(true);
    setText("");

    try {
      // Add message
      await addDoc(collection(db, "personalChats", chatId, "messages"), {
        text: msg,
        senderId: currentUser.uid,
        recipientId: recipient.uid,
        createdAt: serverTimestamp(),
        status: 'sent',
      });

      // Update chat metadata
      await setDoc(doc(db, "personalChats", chatId), {
        participants: [currentUser.uid, recipient.uid],
        lastMessage: msg,
        lastMessageTime: serverTimestamp(),
        lastMessageSender: currentUser.uid,
      }, { merge: true });

      scrollToBottom();
      setTimeout(() => textareaRef.current?.focus(), 50);
    } catch (err: any) {
      console.error("Send failed:", err);
      alert(`Failed to send: ${err.message}`);
      setText(msg);
    } finally {
      setSending(false);
    }
  };

  // Delete message
  const deleteMessage = async (messageId: string) => {
    if (!window.confirm("Delete this message?")) return;

    try {
      await deleteDoc(doc(db, "personalChats", chatId, "messages", messageId));
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  // Handle Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // Auto-resize
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  // Get status icon
  const getStatusIcon = (message: Message) => {
    if (message.senderId !== currentUser?.uid) return null;

    if (message.status === 'sending') {
      return <Clock className="h-3 w-3 text-white/60" />;
    } else if (message.status === 'read') {
      return <CheckCheck className="h-3.5 w-3.5 text-white/90" />;
    } else if (message.status === 'delivered') {
      return <CheckCheck className="h-3.5 w-3.5 text-white/60" />;
    } else {
      return <Check className="h-3.5 w-3.5 text-white/60" />;
    }
  };

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
            <div className="h-10 w-10 bg-white/20 rounded-full flex items-center justify-center font-semibold">
              {recipient.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <span className="font-semibold text-base block">{recipient.displayName}</span>
              <span className="text-xs opacity-90">{recipient.department}</span>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 rounded-lg hover:bg-white/20 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Messages */}
        <div 
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50"
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-12 w-12 text-purple-600 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <User className="h-16 w-16 mb-3 opacity-30" />
              <p className="font-semibold">No messages yet</p>
              <p className="text-sm mt-1">Start the conversation!</p>
            </div>
          ) : (
            messages.map((m) => {
              const mine = m.senderId === currentUser?.uid;
              
              return (
                <div
                  key={m.id}
                  className={`flex ${mine ? "justify-end" : "justify-start"} gap-1 group`}
                >
                  <div className={`max-w-[75%] flex flex-col ${mine ? "items-end" : "items-start"}`}>
                    <div
                      className={`rounded-2xl px-4 py-2.5 shadow-sm ${
                        mine
                          ? "bg-purple-600 text-white rounded-tr-sm"
                          : "bg-white text-gray-800 border border-gray-200 rounded-tl-sm"
                      }`}
                      style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}
                    >
                      <div className="text-sm">{m.text}</div>
                      <div className={`flex items-center gap-1 justify-end mt-1 text-[10px] ${
                        mine ? 'text-white/70' : 'text-gray-500'
                      }`}>
                        <span>{formatTime(m.createdAt)}</span>
                        {mine && getStatusIcon(m)}
                      </div>
                    </div>
                  </div>

                  {mine && (
                    <button
                      onClick={() => deleteMessage(m.id)}
                      className="self-end p-1.5 rounded-full hover:bg-red-100 text-red-500 opacity-0 group-hover:opacity-100 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
          <div ref={bottomRef} />

          {showScrollButton && (
            <button
              onClick={() => scrollToBottom()}
              className="fixed bottom-24 right-8 bg-purple-600 text-white p-3 rounded-full shadow-lg hover:bg-purple-700 transition"
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
              className="flex-1 resize-none px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              disabled={sending}
              maxLength={5000}
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
            <button
              onClick={send}
              disabled={sending || !text.trim()}
              className="p-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 transition shadow-md"
            >
              {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
