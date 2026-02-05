import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, getDocs, where, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  CheckSquare, 
  Users, 
  Calendar, 
  Clock, 
  ArrowRight,
  Award,
  Target,
  TrendingUp
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  assignedTo: string;
  assignedToName?: string;
  createdAt: Date;
  dueDate: Date;
  points?: number;
  isRecurring?: boolean;
  completionCount?: number;
}

interface Meeting {
  id: string;
  title: string;
  description: string;
  date: Date;
  location?: string;
  status?: string;
  attendees?: string[];
}

interface Stats {
  totalTasks: number;
  completedTasks: number;
  upcomingMeetings: number;
  teamMembers: number;
  completionRate: number;
  pendingTasks: number;
  inProgressTasks: number;
  totalPoints: number;
}

export const Dashboard = () => {
  const { currentUser, userData, userRole } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalTasks: 0,
    completedTasks: 0,
    upcomingMeetings: 0,
    teamMembers: 0,
    completionRate: 0,
    pendingTasks: 0,
    inProgressTasks: 0,
    totalPoints: 0,
  });
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser && userRole) {
      fetchStats();
      fetchTasks();
      fetchMeetings();
    }
  }, [currentUser, userRole]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const fetchStats = async () => {
    try {
      const tasksRef = collection(db, 'tasks');
      let tasksQuery;

      if (userRole === 'superadmin') {
        tasksQuery = query(tasksRef);
      } else {
        tasksQuery = query(tasksRef, where('assignedTo', '==', currentUser?.uid));
      }

      const tasksSnapshot = await getDocs(tasksQuery);
      const allTasks = tasksSnapshot.docs.map(doc => doc.data());
      
      const completedTasks = allTasks.filter(task => task.status === 'completed').length;
      const pendingTasks = allTasks.filter(task => task.status === 'pending').length;
      const inProgressTasks = allTasks.filter(task => task.status === 'in-progress').length;
      const totalTasks = allTasks.length;
      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      let totalPoints = 0;
      if (userRole !== 'superadmin') {
        const userStatsRef = collection(db, 'userStats');
        const userStatsQuery = query(userStatsRef, where('userId', '==', currentUser?.uid));
        const userStatsSnapshot = await getDocs(userStatsQuery);
        if (!userStatsSnapshot.empty) {
          totalPoints = userStatsSnapshot.docs[0].data().totalPoints || 0;
        }
      }

      const meetingsRef = collection(db, 'meetings');
      const meetingsQuery = query(
        meetingsRef,
        where('date', '>=', Timestamp.now())
      );
      const meetingsSnapshot = await getDocs(meetingsQuery);
      const upcomingMeetings = meetingsSnapshot.size;

      let teamMembers = 0;
      if (userRole === 'superadmin') {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        teamMembers = usersSnapshot.size;
      }

      setStats({
        totalTasks,
        completedTasks,
        upcomingMeetings,
        teamMembers,
        completionRate,
        pendingTasks,
        inProgressTasks,
        totalPoints,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      const tasksRef = collection(db, 'tasks');
      let q;

      if (userRole === 'superadmin') {
        q = query(tasksRef, orderBy('createdAt', 'desc'), limit(5));
      } else {
        q = query(
          tasksRef,
          where('assignedTo', '==', currentUser?.uid),
          orderBy('createdAt', 'desc'),
          limit(5)
        );
      }

      const snapshot = await getDocs(q);
      const tasksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        dueDate: doc.data().dueDate?.toDate() || new Date(),
      })) as Task[];

      setRecentTasks(tasksData);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const fetchMeetings = async () => {
    try {
      const meetingsRef = collection(db, 'meetings');
      const q = query(
        meetingsRef,
        where('date', '>=', Timestamp.now()),
        orderBy('date', 'asc'),
        limit(3)
      );

      const snapshot = await getDocs(q);
      const meetingsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate() || new Date(),
      })) as Meeting[];

      setUpcomingMeetings(meetingsData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching meetings:', error);
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'low': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'in-progress': return 'bg-blue-100 text-blue-700';
      case 'pending': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {getGreeting()}, {userData?.displayName?.split(' ')[0]}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500 uppercase tracking-wide">{userRole}</div>
          <div className="text-lg font-semibold text-gray-900">{format(new Date(), 'h:mm a')}</div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link to="/tasks" className="group">
          <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all">
            <div className="flex items-center justify-between mb-2">
              <CheckSquare className="h-5 w-5 text-blue-600" />
              <ArrowRight className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalTasks}</div>
            <div className="text-xs text-gray-600 font-medium">Total Tasks</div>
            <div className="text-xs text-gray-500 mt-1">
              {stats.pendingTasks}P · {stats.inProgressTasks}A · {stats.completedTasks}C
            </div>
          </div>
        </Link>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <div className="text-xs font-semibold text-green-700">{stats.completionRate}%</div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.completedTasks}</div>
          <div className="text-xs text-gray-600 font-medium">Completed</div>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
            <div 
              className="bg-green-600 h-1.5 rounded-full transition-all"
              style={{ width: `${stats.completionRate}%` }}
            />
          </div>
        </div>

        <Link to="/meetings" className="group">
          <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-purple-300 hover:shadow-sm transition-all">
            <div className="flex items-center justify-between mb-2">
              <Calendar className="h-5 w-5 text-purple-600" />
              <ArrowRight className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.upcomingMeetings}</div>
            <div className="text-xs text-gray-600 font-medium">Meetings</div>
            <div className="text-xs text-gray-500 mt-1">Upcoming scheduled</div>
          </div>
        </Link>

        {userRole === 'superadmin' ? (
          <Link to="/team" className="group">
            <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-orange-300 hover:shadow-sm transition-all">
              <div className="flex items-center justify-between mb-2">
                <Users className="h-5 w-5 text-orange-600" />
                <ArrowRight className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.teamMembers}</div>
              <div className="text-xs text-gray-600 font-medium">Team Members</div>
              <div className="text-xs text-gray-500 mt-1">Active users</div>
            </div>
          </Link>
        ) : (
          <Link to="/reports" className="group">
            <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-yellow-300 hover:shadow-sm transition-all">
              <div className="flex items-center justify-between mb-2">
                <Award className="h-5 w-5 text-yellow-600" />
                <ArrowRight className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.totalPoints}</div>
              <div className="text-xs text-gray-600 font-medium">Points Earned</div>
              <div className="text-xs text-gray-500 mt-1">Total accumulated</div>
            </div>
          </Link>
        )}
      </div>

      {/* Recent Tasks and Meetings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tasks */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Recent Tasks</h2>
            <Link to="/tasks" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              View all →
            </Link>
          </div>

          <div className="space-y-4">
            {recentTasks.length > 0 ? (
              recentTasks.map((task) => (
                <div key={task.id} className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-gray-900">{task.title}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2 line-clamp-1">{task.description}</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className={`px-2 py-1 rounded font-medium ${getStatusColor(task.status)}`}>
                      {task.status}
                    </span>
                    <span className="text-gray-500">Due: {format(task.dueDate, 'MMM d, yyyy')}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 py-8">No tasks assigned yet</p>
            )}
          </div>
        </div>

        {/* Upcoming Meetings */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Upcoming Meetings</h2>
            <Link to="/meetings" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              View all →
            </Link>
          </div>

          <div className="space-y-4">
            {upcomingMeetings.length > 0 ? (
              upcomingMeetings.map((meeting) => (
                <div key={meeting.id} className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-start space-x-3">
                    <div className="h-10 w-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Calendar className="h-5 w-5 text-primary-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 mb-1">{meeting.title}</h3>
                      <p className="text-sm text-gray-600 line-clamp-1 mb-2">{meeting.description}</p>
                      <div className="flex items-center text-xs text-gray-500">
                        <Clock className="h-3 w-3 mr-1" />
                        {format(meeting.date, 'PPP p')}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 py-8">No upcoming meetings</p>
            )}
          </div>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-gray-600" />
            <span className="font-medium text-gray-900">Summary</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-gray-600">{stats.pendingTasks} Pending</span>
            <span className="text-gray-400">•</span>
            <span className="text-blue-600">{stats.inProgressTasks} Active</span>
            <span className="text-gray-400">•</span>
            <span className="text-green-600">{stats.completedTasks} Done</span>
            <span className="text-gray-400">•</span>
            <span className="text-purple-600">{stats.upcomingMeetings} Meetings</span>
          </div>
        </div>
      </div>
    </div>
  );
};
