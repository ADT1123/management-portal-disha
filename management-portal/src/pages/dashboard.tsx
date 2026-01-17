import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, getDocs, where, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { CheckSquare, Users, Calendar, TrendingUp } from 'lucide-react';
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
}

interface Meeting {
  id: string;
  title: string;
  description: string;
  date: Date;
  location?: string;
}

interface Stats {
  totalTasks: number;
  completedTasks: number;
  upcomingMeetings: number;
  teamMembers: number;
  completionRate: number;
}

export const Dashboard = () => {
  const { currentUser, userData, userRole } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalTasks: 0,
    completedTasks: 0,
    upcomingMeetings: 0,
    teamMembers: 0,
    completionRate: 0,
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

  const fetchStats = async () => {
    try {
      const tasksRef = collection(db, 'tasks');
      let tasksQuery;

      // Super Admin sees ALL tasks
      if (userRole === 'superadmin') {
        tasksQuery = query(tasksRef);
      } else {
        // Members/Admins see only THEIR tasks
        tasksQuery = query(tasksRef, where('assignedTo', '==', currentUser?.uid));
      }

      const tasksSnapshot = await getDocs(tasksQuery);
      const allTasks = tasksSnapshot.docs.map(doc => doc.data());
      
      const completedTasks = allTasks.filter(task => task.status === 'completed').length;
      const totalTasks = allTasks.length;
      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      // Fetch upcoming meetings (all users see all meetings)
      const meetingsRef = collection(db, 'meetings');
      const meetingsQuery = query(
        meetingsRef,
        where('date', '>=', Timestamp.now())
      );
      const meetingsSnapshot = await getDocs(meetingsQuery);
      const upcomingMeetings = meetingsSnapshot.size;

      // Fetch team members (only for super admin)
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
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      const tasksRef = collection(db, 'tasks');
      let q;

      // Super Admin sees ALL tasks
      if (userRole === 'superadmin') {
        q = query(tasksRef, orderBy('createdAt', 'desc'), limit(5));
      } else {
        // Members/Admins see only THEIR assigned tasks
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
      case 'high':
        return 'bg-red-100 text-red-700';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700';
      case 'low':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'in-progress':
        return 'bg-blue-100 text-blue-700';
      case 'pending':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
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
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {userData?.displayName}! 👋
        </h1>
        <p className="text-gray-600">Here's what's happening with your projects today</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <div className="card bg-gradient-to-br from-primary-50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Tasks</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalTasks}</p>
            </div>
            <div className="h-12 w-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <CheckSquare className="h-6 w-6 text-primary-600" />
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-green-50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Completed</p>
              <p className="text-3xl font-bold text-gray-900">{stats.completedTasks}</p>
              <p className="text-xs text-green-600 mt-2">{stats.completionRate}% completion rate</p>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-blue-50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Upcoming Meetings</p>
              <p className="text-3xl font-bold text-gray-900">{stats.upcomingMeetings}</p>
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        {userRole === 'superadmin' && (
          <div className="card bg-gradient-to-br from-purple-50 to-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Team Members</p>
                <p className="text-3xl font-bold text-gray-900">{stats.teamMembers}</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
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
                    <span className="text-gray-500">{format(task.createdAt, 'MMM d, yyyy')}</span>
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
                        <Calendar className="h-3 w-3 mr-1" />
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
    </div>
  );
};
