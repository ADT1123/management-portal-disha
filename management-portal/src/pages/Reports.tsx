import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  Award, Clock, CheckCircle, AlertCircle, 
  Users, Target, Download, TrendingUp
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

interface UserStats {
  userId: string;
  userName: string;
  tasksCompleted: number;
  totalPoints: number;
  averageCompletionTime: number;
  totalTasksAssigned: number;
  onTimeDeliveryRate: number;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignedTo: string;
  assignedToName: string;
  createdAt: Date;
  assignedAt: Date;
  dueDate: Date;
  completedAt?: Date;
  completionTimeHours?: number;
  points?: number;
  isEarlyComplete?: boolean;
}

// ✅ Professional Color Palette
const COLORS = {
  primary: '#6366f1',      // Indigo
  success: '#10b981',      // Green
  warning: '#f59e0b',      // Amber
  danger: '#ef4444',       // Red
  info: '#3b82f6',         // Blue
  purple: '#8b5cf6',       // Purple
  pink: '#ec4899',         // Pink
  teal: '#14b8a6',         // Teal
  gray: '#6b7280',         // Gray
};

// ✅ Status Colors
const STATUS_COLORS = {
  completed: COLORS.success,
  'in-progress': COLORS.info,
  pending: COLORS.warning,
};

// ✅ Priority Colors
const PRIORITY_COLORS = {
  high: COLORS.danger,
  medium: COLORS.warning,
  low: COLORS.success,
};

export const Reports = () => {
  const { currentUser, userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'all'>('month');
  
  const [users, setUsers] = useState<any[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  
  const [totalTasks, setTotalTasks] = useState(0);
  const [completedTasks, setCompletedTasks] = useState(0);
  const [pendingTasks, setPendingTasks] = useState(0);
  const [inProgressTasks, setInProgressTasks] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [averageCompletionTime, setAverageCompletionTime] = useState(0);

  useEffect(() => {
    if (currentUser && userRole === 'superadmin') {
      fetchAllData();
    }
  }, [currentUser, userRole, selectedUser, dateRange]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await fetchUsers();
      await fetchTasks();
      await fetchUserStats();
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    const snapshot = await getDocs(collection(db, 'users'));
    const usersData = snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data(),
    }));
    setUsers(usersData);
  };

  const fetchTasks = async () => {
    let q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    
    if (selectedUser !== 'all') {
      q = query(
        collection(db, 'tasks'),
        where('assignedTo', '==', selectedUser),
        orderBy('createdAt', 'desc')
      );
    }

    const snapshot = await getDocs(q);
    const tasksData = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      assignedAt: doc.data().assignedAt?.toDate() || new Date(),
      dueDate: doc.data().dueDate?.toDate() || new Date(),
      completedAt: doc.data().completedAt?.toDate() || null,
    })) as Task[];

    const filteredTasks = filterTasksByDateRange(tasksData);
    setTasks(filteredTasks);
    calculateSummaryStats(filteredTasks);
  };

  const fetchUserStats = async () => {
    const snapshot = await getDocs(collection(db, 'userStats'));
    const statsData = snapshot.docs.map(doc => {
      const data = doc.data();
      const user = users.find(u => u.uid === data.userId);
      
      return {
        userId: data.userId,
        userName: user?.displayName || 'Unknown',
        tasksCompleted: data.tasksCompleted || 0,
        totalPoints: data.totalPoints || 0,
        averageCompletionTime: data.averageCompletionTime || 0,
        totalTasksAssigned: data.totalTasksAssigned || 0,
        onTimeDeliveryRate: data.totalTasksAssigned > 0 
          ? parseFloat(((data.tasksCompleted / data.totalTasksAssigned) * 100).toFixed(1))
          : 0
      };
    });

    const sortedStats = statsData.sort((a, b) => b.totalPoints - a.totalPoints);
    setUserStats(sortedStats);
  };

  const filterTasksByDateRange = (tasksData: Task[]) => {
    const now = new Date();
    
    switch (dateRange) {
      case 'week':
        return tasksData.filter(task => differenceInDays(now, task.createdAt) <= 7);
      case 'month':
        return tasksData.filter(task => differenceInDays(now, task.createdAt) <= 30);
      default:
        return tasksData;
    }
  };

  const calculateSummaryStats = (tasksData: Task[]) => {
    setTotalTasks(tasksData.length);
    setCompletedTasks(tasksData.filter(t => t.status === 'completed').length);
    setPendingTasks(tasksData.filter(t => t.status === 'pending').length);
    setInProgressTasks(tasksData.filter(t => t.status === 'in-progress').length);
    
    const completedTasksData = tasksData.filter(t => t.status === 'completed');
    const points = completedTasksData.reduce((sum, t) => sum + (t.points || 0), 0);
    setTotalPoints(points);
    
    const avgTime = completedTasksData.length > 0
      ? completedTasksData.reduce((sum, t) => sum + (t.completionTimeHours || 0), 0) / completedTasksData.length
      : 0;
    setAverageCompletionTime(avgTime);
  };

  const getStatusDistribution = () => {
    return [
      { name: 'Completed', value: completedTasks, color: STATUS_COLORS.completed },
      { name: 'In Progress', value: inProgressTasks, color: STATUS_COLORS['in-progress'] },
      { name: 'Pending', value: pendingTasks, color: STATUS_COLORS.pending }
    ].filter(item => item.value > 0); // Only show non-zero values
  };

  const getPriorityDistribution = () => {
    const high = tasks.filter(t => t.priority === 'high').length;
    const medium = tasks.filter(t => t.priority === 'medium').length;
    const low = tasks.filter(t => t.priority === 'low').length;
    
    return [
      { name: 'High', value: high, color: PRIORITY_COLORS.high },
      { name: 'Medium', value: medium, color: PRIORITY_COLORS.medium },
      { name: 'Low', value: low, color: PRIORITY_COLORS.low }
    ].filter(item => item.value > 0);
  };

  const getCompletionTrend = () => {
    const completedTasksList = tasks.filter(t => t.completedAt);
    const last7Days = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = format(date, 'MMM dd');
      
      const count = completedTasksList.filter(t => 
        t.completedAt && format(t.completedAt, 'MMM dd') === dateStr
      ).length;
      
      last7Days.push({ date: dateStr, completed: count });
    }
    
    return last7Days;
  };

  const getTopPerformers = () => {
    return userStats.slice(0, 5);
  };

  const formatTime = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)}m`;
    } else if (hours < 24) {
      return `${hours.toFixed(1)}h`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = Math.round(hours % 24);
      return `${days}d ${remainingHours}h`;
    }
  };

  const exportToCSV = () => {
    if (userStats.length === 0) {
      alert('No data to export');
      return;
    }

    const csvData = userStats.map(stat => ({
      'User Name': stat.userName,
      'Tasks Assigned': stat.totalTasksAssigned,
      'Tasks Completed': stat.tasksCompleted,
      'Total Points': stat.totalPoints,
      'Avg Completion Time (hrs)': stat.averageCompletionTime.toFixed(2),
      'Completion Rate (%)': stat.onTimeDeliveryRate
    }));

    const headers = Object.keys(csvData[0]).join(',');
    const rows = csvData.map(row => Object.values(row).join(','));
    const csv = [headers, ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `team-performance-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // ✅ Custom tooltip for charts
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900">{payload[0].name}</p>
          <p className="text-sm text-gray-600">{`${payload[0].value} tasks`}</p>
        </div>
      );
    }
    return null;
  };

  if (userRole !== 'superadmin') {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600">Only Super Admin can access performance reports</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Performance Reports</h1>
          <p className="text-gray-600 mt-1">Comprehensive team analytics and insights</p>
        </div>
        <button
          onClick={exportToCSV}
          disabled={userStats.length === 0}
          className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          <Download className="h-5 w-5 mr-2" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Filter by User</label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
            >
              <option value="all">All Team Members</option>
              {users.map(user => (
                <option key={user.uid} value={user.uid}>
                  {user.displayName} ({user.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Date Range</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
            >
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-sm border border-blue-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 font-semibold mb-1">Total Tasks</p>
              <p className="text-4xl font-bold text-blue-900">{totalTasks}</p>
            </div>
            <div className="p-4 bg-blue-500 rounded-xl shadow-md">
              <Target className="h-8 w-8 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-sm border border-green-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 font-semibold mb-1">Completed</p>
              <p className="text-4xl font-bold text-green-900">{completedTasks}</p>
              <p className="text-xs text-green-700 font-medium mt-1">
                {totalTasks > 0 ? `${((completedTasks / totalTasks) * 100).toFixed(0)}% completion rate` : 'No tasks'}
              </p>
            </div>
            <div className="p-4 bg-green-500 rounded-xl shadow-md">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl shadow-sm border border-amber-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-amber-700 font-semibold mb-1">Total Points</p>
              <p className="text-4xl font-bold text-amber-900">{totalPoints}</p>
            </div>
            <div className="p-4 bg-amber-500 rounded-xl shadow-md">
              <Award className="h-8 w-8 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl shadow-sm border border-purple-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-700 font-semibold mb-1">Avg Time</p>
              <p className="text-4xl font-bold text-purple-900">
                {formatTime(averageCompletionTime)}
              </p>
            </div>
            <div className="p-4 bg-purple-500 rounded-xl shadow-md">
              <Clock className="h-8 w-8 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
            <div className="h-2 w-2 bg-primary-600 rounded-full mr-2"></div>
            Task Status Distribution
          </h3>
          {getStatusDistribution().length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={getStatusDistribution()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                  outerRadius={100}
                  dataKey="value"
                >
                  {getStatusDistribution().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              <p>No task data available</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
            <div className="h-2 w-2 bg-primary-600 rounded-full mr-2"></div>
            Priority Distribution
          </h3>
          {getPriorityDistribution().length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={getPriorityDistribution()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                  outerRadius={100}
                  dataKey="value"
                >
                  {getPriorityDistribution().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              <p>No priority data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
            <div className="h-2 w-2 bg-primary-600 rounded-full mr-2"></div>
            7-Day Completion Trend
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={getCompletionTrend()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: '12px' }} />
              <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }} 
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="completed" 
                stroke={COLORS.success}
                strokeWidth={3}
                name="Completed Tasks"
                dot={{ fill: COLORS.success, r: 5 }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
            <div className="h-2 w-2 bg-primary-600 rounded-full mr-2"></div>
            Top 5 Performers
          </h3>
          {getTopPerformers().length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={getTopPerformers()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="userName" stroke="#6b7280" style={{ fontSize: '12px' }} />
                <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }} 
                />
                <Legend />
                <Bar dataKey="totalPoints" fill={COLORS.warning} name="Total Points" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              <p>No performance data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900 flex items-center">
            <div className="h-2 w-2 bg-primary-600 rounded-full mr-2"></div>
            Team Leaderboard
          </h3>
          <Users className="h-5 w-5 text-gray-400" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200 bg-gray-50">
                <th className="text-left py-4 px-4 font-bold text-sm text-gray-700">Rank</th>
                <th className="text-left py-4 px-4 font-bold text-sm text-gray-700">Name</th>
                <th className="text-center py-4 px-4 font-bold text-sm text-gray-700">Assigned</th>
                <th className="text-center py-4 px-4 font-bold text-sm text-gray-700">Completed</th>
                <th className="text-center py-4 px-4 font-bold text-sm text-gray-700">Points</th>
                <th className="text-center py-4 px-4 font-bold text-sm text-gray-700">Avg Time</th>
                <th className="text-center py-4 px-4 font-bold text-sm text-gray-700">Success Rate</th>
              </tr>
            </thead>
            <tbody>
              {userStats.map((stat, index) => (
                <tr key={stat.userId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-4">
                    <div className="flex items-center space-x-2">
                      {index === 0 && <Award className="h-5 w-5 text-yellow-500" />}
                      {index === 1 && <Award className="h-5 w-5 text-gray-400" />}
                      {index === 2 && <Award className="h-5 w-5 text-orange-600" />}
                      <span className="font-bold text-gray-900">#{index + 1}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 font-semibold text-gray-900">{stat.userName}</td>
                  <td className="py-4 px-4 text-center">
                    <span className="text-gray-700 font-medium">{stat.totalTasksAssigned}</span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                      {stat.tasksCompleted}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="inline-flex items-center px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-semibold">
                      <TrendingUp className="h-3.5 w-3.5 mr-1" />
                      {stat.totalPoints}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center text-gray-700 font-medium">
                    {formatTime(stat.averageCompletionTime)}
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                      stat.onTimeDeliveryRate >= 80 
                        ? 'bg-green-100 text-green-800'
                        : stat.onTimeDeliveryRate >= 50
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {stat.onTimeDeliveryRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {userStats.length === 0 && (
            <div className="text-center py-16">
              <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No team statistics available yet</p>
              <p className="text-sm text-gray-400 mt-1">Start assigning tasks to see analytics</p>
            </div>
          )}
        </div>
      </div>

      {/* Individual User Details */}
      {selectedUser !== 'all' && tasks.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
            <div className="h-2 w-2 bg-primary-600 rounded-full mr-2"></div>
            Individual Task Details
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200 bg-gray-50">
                  <th className="text-left py-4 px-4 font-bold text-sm text-gray-700">Task</th>
                  <th className="text-center py-4 px-4 font-bold text-sm text-gray-700">Status</th>
                  <th className="text-center py-4 px-4 font-bold text-sm text-gray-700">Priority</th>
                  <th className="text-center py-4 px-4 font-bold text-sm text-gray-700">Assigned</th>
                  <th className="text-center py-4 px-4 font-bold text-sm text-gray-700">Completed</th>
                  <th className="text-center py-4 px-4 font-bold text-sm text-gray-700">Time</th>
                  <th className="text-center py-4 px-4 font-bold text-sm text-gray-700">Points</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => (
                  <tr key={task.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4 font-medium text-gray-900">{task.title}</td>
                    <td className="py-4 px-4 text-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                        task.status === 'completed' 
                          ? 'bg-green-100 text-green-800'
                          : task.status === 'in-progress'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {task.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                        task.priority === 'high'
                          ? 'bg-red-100 text-red-800'
                          : task.priority === 'medium'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center text-sm text-gray-700 font-medium">
                      {format(task.assignedAt, 'MMM dd, yyyy')}
                    </td>
                    <td className="py-4 px-4 text-center text-sm text-gray-700 font-medium">
                      {task.completedAt ? format(task.completedAt, 'MMM dd, yyyy') : '-'}
                    </td>
                    <td className="py-4 px-4 text-center text-sm text-gray-700 font-medium">
                      {task.completionTimeHours ? formatTime(task.completionTimeHours) : '-'}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {task.points ? (
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                          task.isEarlyComplete
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {task.isEarlyComplete && '⭐ '}{task.points}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
