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

// ✅ Minimal Color Palette
const COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  gray: '#64748b',
};

const STATUS_COLORS = {
  completed: COLORS.success,
  'in-progress': COLORS.primary,
  pending: COLORS.warning,
};

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
    ].filter(item => item.value > 0);
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

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white px-3 py-2 border border-gray-200 rounded-lg shadow-sm">
          <p className="text-xs font-medium text-gray-700">{payload[0].value}</p>
        </div>
      );
    }
    return null;
  };

  if (userRole !== 'superadmin') {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Access Denied</h2>
        <p className="text-sm text-gray-500">Only Super Admin can access reports</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-3"></div>
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Team analytics and performance</p>
        </div>
        <button
          onClick={exportToCSV}
          disabled={userStats.length === 0}
          className="inline-flex items-center px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Download className="h-4 w-4 mr-2" />
          Export
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">User</label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Team Members</option>
              {users.map(user => (
                <option key={user.uid} value={user.uid}>
                  {user.displayName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Period</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-500">Total Tasks</p>
            <Target className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-2xl font-semibold text-gray-900">{totalTasks}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-500">Completed</p>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </div>
          <p className="text-2xl font-semibold text-gray-900">{completedTasks}</p>
          <p className="text-xs text-gray-500 mt-1">
            {totalTasks > 0 ? `${((completedTasks / totalTasks) * 100).toFixed(0)}%` : '0%'}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-500">Total Points</p>
            <Award className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-semibold text-gray-900">{totalPoints}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-500">Avg Time</p>
            <Clock className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-2xl font-semibold text-gray-900">
            {formatTime(averageCompletionTime)}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Status Distribution</h3>
          {getStatusDistribution().length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={getStatusDistribution()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
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
            <div className="h-[240px] flex items-center justify-center text-sm text-gray-400">
              No data
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-medium text-gray-900 mb-4">7-Day Trend</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={getCompletionTrend()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: '11px' }} />
              <YAxis stroke="#94a3b8" style={{ fontSize: '11px' }} />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="completed" 
                stroke={COLORS.primary}
                strokeWidth={2}
                dot={{ fill: COLORS.primary, r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-5 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900">Team Leaderboard</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-600">Rank</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-600">Name</th>
                <th className="text-center py-3 px-4 text-xs font-medium text-gray-600">Assigned</th>
                <th className="text-center py-3 px-4 text-xs font-medium text-gray-600">Completed</th>
                <th className="text-center py-3 px-4 text-xs font-medium text-gray-600">Points</th>
                <th className="text-center py-3 px-4 text-xs font-medium text-gray-600">Avg Time</th>
                <th className="text-center py-3 px-4 text-xs font-medium text-gray-600">Rate</th>
              </tr>
            </thead>
            <tbody>
              {userStats.map((stat, index) => (
                <tr key={stat.userId} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {index < 3 && <Award className={`h-4 w-4 ${
                        index === 0 ? 'text-yellow-500' : 
                        index === 1 ? 'text-gray-400' : 'text-amber-600'
                      }`} />}
                      <span className="text-sm font-medium text-gray-700">#{index + 1}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm font-medium text-gray-900">{stat.userName}</td>
                  <td className="py-3 px-4 text-center text-sm text-gray-600">{stat.totalTasksAssigned}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs font-medium">
                      {stat.tasksCompleted}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-medium">
                      {stat.totalPoints}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center text-sm text-gray-600">
                    {formatTime(stat.averageCompletionTime)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      stat.onTimeDeliveryRate >= 80 
                        ? 'bg-green-50 text-green-700'
                        : stat.onTimeDeliveryRate >= 50
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-red-50 text-red-700'
                    }`}>
                      {stat.onTimeDeliveryRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {userStats.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Individual Task Details */}
      {selectedUser !== 'all' && tasks.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-5 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-900">Task Details</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-600">Task</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-gray-600">Status</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-gray-600">Priority</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-gray-600">Assigned</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-gray-600">Completed</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-gray-600">Time</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-gray-600">Points</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => (
                  <tr key={task.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-900">{task.title}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        task.status === 'completed' 
                          ? 'bg-green-50 text-green-700'
                          : task.status === 'in-progress'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {task.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        task.priority === 'high'
                          ? 'bg-red-50 text-red-700'
                          : task.priority === 'medium'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-green-50 text-green-700'
                      }`}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-xs text-gray-600">
                      {format(task.assignedAt, 'MMM dd')}
                    </td>
                    <td className="py-3 px-4 text-center text-xs text-gray-600">
                      {task.completedAt ? format(task.completedAt, 'MMM dd') : '-'}
                    </td>
                    <td className="py-3 px-4 text-center text-xs text-gray-600">
                      {task.completionTimeHours ? formatTime(task.completionTimeHours) : '-'}
                    </td>
                    <td className="py-3 px-4 text-center text-xs text-gray-600">
                      {task.points ? (
                        <span className="font-medium">
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
