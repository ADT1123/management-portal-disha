import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { X, Search, Users as UsersIcon, MessageCircle, User } from "lucide-react";

type User = {
  uid: string;
  displayName: string;
  department: string;
  role: string;
  email: string;
  photoURL?: string;
};

type ChatListProps = {
  open: boolean;
  onClose: () => void;
  users: User[];
  onUserClick: (user: User) => void;
  onTeamChatClick: () => void;
};

export const ChatList = ({ open, onClose, users, onUserClick, onTeamChatClick }: ChatListProps) => {
  const { currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [recentChats, setRecentChats] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
    }
  }, [open]);

  // Fetch recent chats
  useEffect(() => {
    if (!currentUser || !open) return;

    const chatsRef = collection(db, "personalChats");
    const q = query(
      chatsRef,
      where("participants", "array-contains", currentUser.uid),
      orderBy("lastMessageTime", "desc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatUserIds = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return data.participants.find((id: string) => id !== currentUser.uid);
        })
        .filter(Boolean);
      
      setRecentChats(chatUserIds);
    });

    return () => unsubscribe();
  }, [currentUser, open]);

  const filteredUsers = users.filter(user =>
    user.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort users: recent chats first
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const aRecent = recentChats.indexOf(a.uid);
    const bRecent = recentChats.indexOf(b.uid);
    
    if (aRecent !== -1 && bRecent !== -1) return aRecent - bRecent;
    if (aRecent !== -1) return -1;
    if (bRecent !== -1) return 1;
    return 0;
  });

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
        className={`fixed top-0 right-0 h-full w-full sm:w-[380px] bg-white z-50 shadow-2xl flex flex-col transition-transform duration-300 ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="h-16 px-4 border-b flex items-center justify-between bg-gradient-to-r from-purple-600 to-purple-700 text-white">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-6 w-6" />
            <span className="font-semibold text-lg">Chats</span>
          </div>
          <button onClick={handleClose} className="p-2 rounded-lg hover:bg-white/20 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b bg-gray-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Team Chat */}
        <button
          onClick={onTeamChatClick}
          className="flex items-center gap-3 p-4 hover:bg-gray-50 border-b transition-colors"
        >
          <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
            <UsersIcon className="h-6 w-6 text-purple-600" />
          </div>
          <div className="flex-1 text-left">
            <h3 className="font-semibold text-gray-900">Team Chat</h3>
            <p className="text-sm text-gray-500">Message everyone</p>
          </div>
        </button>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto">
          {sortedUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
              <User className="h-16 w-16 mb-3 opacity-30" />
              <p className="font-medium">No contacts found</p>
              <p className="text-sm mt-1">Try a different search</p>
            </div>
          ) : (
            sortedUsers.map((user) => (
              <button
                key={user.uid}
                onClick={() => onUserClick(user)}
                className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 border-b transition-colors"
              >
                {/* Avatar */}
                <div className="h-12 w-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold">
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
                
                {/* User Info */}
                <div className="flex-1 text-left min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{user.displayName}</h3>
                  <p className="text-sm text-gray-500 truncate">{user.department}</p>
                </div>

                {/* Recent Indicator */}
                {recentChats.includes(user.uid) && (
                  <div className="h-2 w-2 bg-green-500 rounded-full flex-shrink-0"></div>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
};
