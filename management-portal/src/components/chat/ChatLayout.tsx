import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, orderBy, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { MessageCircle, X } from "lucide-react";
import { ChatList } from "./ChatList";
import { PersonalChatDrawer } from "./PersonalChatDrawer";
import { TeamChatDrawer } from "./TeamChatDrawer";

type User = {
  uid: string;
  displayName: string;
  department: string;
  role: string;
  email: string;
  photoURL?: string;
};

type ChatType = 'team' | 'personal';

export const ChatLayout = () => {
  const { currentUser } = useAuth();
  const [showChatList, setShowChatList] = useState(false);
  const [showTeamChat, setShowTeamChat] = useState(false);
  const [showPersonalChat, setShowPersonalChat] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch all users
  useEffect(() => {
    if (!currentUser) return;

    const fetchUsers = async () => {
      const usersRef = collection(db, "users");
      const q = query(usersRef, orderBy("displayName", "asc"));
      const snapshot = await getDocs(q);
      
      const allUsers = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as User))
        .filter(u => u.uid !== currentUser.uid);
      
      setUsers(allUsers);
    };

    fetchUsers();
  }, [currentUser]);

  // Open personal chat
  const handleUserClick = (user: User) => {
    setSelectedUser(user);
    setShowChatList(false);
    setShowPersonalChat(true);
  };

  // Open team chat
  const handleTeamChatClick = () => {
    setShowChatList(false);
    setShowTeamChat(true);
  };

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={() => setShowChatList(true)}
        className="fixed bottom-6 right-6 h-14 w-14 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700 hover:scale-110 transition-all z-30 flex items-center justify-center"
      >
        <MessageCircle className="h-6 w-6" />
        {unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </button>

      {/* Chat List */}
      <ChatList
        open={showChatList}
        onClose={() => setShowChatList(false)}
        users={users}
        onUserClick={handleUserClick}
        onTeamChatClick={handleTeamChatClick}
      />

      {/* Team Chat */}
      <TeamChatDrawer
        open={showTeamChat}
        onClose={() => setShowTeamChat(false)}
        unreadCount={0}
        onMarkAsRead={() => {}}
      />

      {/* Personal Chat */}
      {selectedUser && (
        <PersonalChatDrawer
          open={showPersonalChat}
          onClose={() => {
            setShowPersonalChat(false);
            setSelectedUser(null);
          }}
          recipient={selectedUser}
        />
      )}
    </>
  );
};
