import { useEffect, useState } from 'react';
import { 
  collection, 
  query, 
  getDocs, 
  addDoc, 
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  where,
  Timestamp,
  onSnapshot,
  setDoc,
  getDoc,
  increment
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { createNotification } from '../utils/notifications';
import { Plus, Search, CheckCircle, Clock, AlertCircle, Trash2, Edit2, MessageCircle, Send, X, Award, Building2, Repeat } from 'lucide-react';
import { format, differenceInHours, addDays, addWeeks, addMonths, startOfDay } from 'date-fns';

interface StatusUpdate {
  status: 'pending' | 'in-progress' | 'completed';
  timestamp: Date;
  updatedBy: string;
  updatedByName: string;
}

interface TaskComment {
  id: string;
  taskId: string;
  message: string;
  sentBy: string;
  sentByName: string;
  sentByRole: string;
  timestamp: Date;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  assignedTo: string;
  assignedToName?: string;
  createdBy: string;
  createdByName?: string;
  createdAt: Date;
  assignedAt: Date;
  dueDate: Date;
  completedAt?: Date;
  completionTimeHours?: number;
  points?: number;
  isEarlyComplete?: boolean;
  statusHistory?: StatusUpdate[];
  commentsCount?: number;
  clientId?: string;
  clientName?: string;
  isRecurring?: boolean;
  recurringPattern?: 'daily' | 'weekly' | 'monthly';
  recurringEndDate?: Date;
  parentTaskId?: string;
}

interface Client {
  id: string;
  name: string;
  company?: string;
}

export const Tasks = () => {
  const { currentUser, userRole, userData } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'pending' as 'pending' | 'in-progress' | 'completed',
    priority: 'medium' as 'low' | 'medium' | 'high',
    assignedTo: '',
    dueDate: '',
    clientId: '',
    isRecurring: false,
    recurringPattern: 'weekly' as 'daily' | 'weekly' | 'monthly',
    recurringEndDate: '',
  });

  useEffect(() => {
    if (currentUser && userRole) {
      fetchTasks();
      fetchUsers();
      fetchClients();
    }
  }, [currentUser, userRole]);

  useEffect(() => {
    if (!selectedTask) return;

    const commentsRef = collection(db, 'taskComments');
    const q = query(
      commentsRef,
      where('taskId', '==', selectedTask.id),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date(),
      })) as TaskComment[];
      
      setComments(commentsData);
    });

    return () => unsubscribe();
  }, [selectedTask]);

  const fetchTasks = async () => {
    try {
      const tasksRef = collection(db, 'tasks');
      let q;

      if (userRole === 'superadmin' || userRole === 'admin') {
        q = query(tasksRef, orderBy('createdAt', 'desc'));
      } else {
        q = query(
          tasksRef,
          where('assignedTo', '==', currentUser?.uid),
          orderBy('createdAt', 'desc')
        );
      }

      const snapshot = await getDocs(q);
      const tasksData = await Promise.all(
        snapshot.docs.map(async (taskDoc) => {
          const data = taskDoc.data();
          
          const commentsRef = collection(db, 'taskComments');
          const commentsQuery = query(commentsRef, where('taskId', '==', taskDoc.id));
          const commentsSnapshot = await getDocs(commentsQuery);
          
          return {
            id: taskDoc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            assignedAt: data.assignedAt?.toDate() || new Date(),
            dueDate: data.dueDate?.toDate() || new Date(),
            completedAt: data.completedAt?.toDate() || null,
            recurringEndDate: data.recurringEndDate?.toDate() || null,
            statusHistory: data.statusHistory?.map((sh: any) => ({
              ...sh,
              timestamp: sh.timestamp?.toDate() || new Date()
            })) || [],
            commentsCount: commentsSnapshot.size,
          };
        })
      );

      setTasks(tasksData as Task[]);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setError('Failed to load tasks');
    }
  };

  const fetchUsers = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const usersData = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
      }));
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchClients = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'clients'));
      const clientsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Client[];
      setClients(clientsData);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const generateRecurringTasks = async (
    baseTask: any,
    parentTaskId: string,
    startDate: Date,
    endDate: Date,
    pattern: 'daily' | 'weekly' | 'monthly'
  ) => {
    const recurringTasks = [];
    let currentDate = startDate;

    while (currentDate <= endDate) {
      let nextDate: Date;
      
      switch (pattern) {
        case 'daily':
          nextDate = addDays(currentDate, 1);
          break;
        case 'weekly':
          nextDate = addWeeks(currentDate, 1);
          break;
        case 'monthly':
          nextDate = addMonths(currentDate, 1);
          break;
        default:
          nextDate = addWeeks(currentDate, 1);
      }

      if (nextDate > endDate) break;

      recurringTasks.push({
        ...baseTask,
        dueDate: Timestamp.fromDate(nextDate),
        assignedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
        parentTaskId,
        isRecurring: false,
        status: 'pending',
      });

      currentDate = nextDate;
    }

    for (const task of recurringTasks) {
      await addDoc(collection(db, 'tasks'), task);
    }
  };

  const calculatePoints = (dueDate: Date, completedAt: Date): { points: number; isEarly: boolean } => {
    const hoursBeforeDue = differenceInHours(dueDate, completedAt);
    
    if (hoursBeforeDue > 24) {
      return { points: 150, isEarly: true };
    } else if (hoursBeforeDue > 12) {
      return { points: 100, isEarly: true };
    } else if (hoursBeforeDue > 0) {
      return { points: 75, isEarly: true };
    } else if (hoursBeforeDue === 0 || hoursBeforeDue > -1) {
      return { points: 50, isEarly: false };
    } else {
      return { points: 0, isEarly: false };
    }
  };

  const updateUserStats = async (userId: string, points: number, completionTimeHours: number) => {
    const userStatsRef = doc(db, 'userStats', userId);
    
    try {
      const userStatsDoc = await getDoc(userStatsRef);
      
      if (userStatsDoc.exists()) {
        const currentStats = userStatsDoc.data();
        const newTotalTasks = (currentStats.tasksCompleted || 0) + 1;
        const currentTotalTime = (currentStats.totalCompletionTime || 0);
        const newTotalTime = currentTotalTime + completionTimeHours;
        const newAvgTime = newTotalTime / newTotalTasks;
        
        await updateDoc(userStatsRef, {
          tasksCompleted: increment(1),
          totalPoints: increment(points),
          totalCompletionTime: increment(completionTimeHours),
          averageCompletionTime: newAvgTime,
          lastUpdated: Timestamp.now()
        });
      } else {
        await setDoc(userStatsRef, {
          userId,
          tasksCompleted: 1,
          totalPoints: points,
          totalCompletionTime: completionTimeHours,
          averageCompletionTime: completionTimeHours,
          totalTasksAssigned: 1,
          onTimeDeliveryRate: points > 0 ? 100 : 0,
          lastUpdated: Timestamp.now()
        });
      }
    } catch (error) {
      console.error('Error updating user stats:', error);
    }
  };

  const handleCreateTask = async () => {
    if (!currentUser || !formData.title || !formData.assignedTo || !formData.dueDate) {
      setError('Please fill all required fields');
      return;
    }

    if (formData.isRecurring && !formData.recurringEndDate) {
      setError('Please specify recurring end date');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const assignedUser = users.find(u => u.uid === formData.assignedTo);
      const selectedClient = clients.find(c => c.id === formData.clientId);
      const now = Timestamp.now();
      
      const initialStatusHistory: StatusUpdate = {
        status: formData.status,
        timestamp: now.toDate(),
        updatedBy: currentUser.uid,
        updatedByName: userData?.displayName || ''
      };
      
      const baseTaskData = {
        title: formData.title,
        description: formData.description,
        status: formData.status,
        priority: formData.priority,
        assignedTo: formData.assignedTo,
        assignedToName: assignedUser?.displayName || '',
        createdBy: currentUser.uid,
        createdByName: userData?.displayName || '',
        createdAt: now,
        assignedAt: now,
        dueDate: Timestamp.fromDate(new Date(formData.dueDate)),
        points: 0,
        isEarlyComplete: false,
        completionTimeHours: 0,
        statusHistory: [initialStatusHistory],
        clientId: formData.clientId || null,
        clientName: selectedClient?.name || null,
        isRecurring: formData.isRecurring,
        recurringPattern: formData.isRecurring ? formData.recurringPattern : null,
        recurringEndDate: formData.isRecurring ? Timestamp.fromDate(new Date(formData.recurringEndDate)) : null,
      };

      const docRef = await addDoc(collection(db, 'tasks'), baseTaskData);

      if (formData.isRecurring) {
        await generateRecurringTasks(
          baseTaskData,
          docRef.id,
          new Date(formData.dueDate),
          new Date(formData.recurringEndDate),
          formData.recurringPattern
        );
      }

      const userStatsRef = doc(db, 'userStats', formData.assignedTo);
      const userStatsDoc = await getDoc(userStatsRef);
      
      if (userStatsDoc.exists()) {
        await updateDoc(userStatsRef, {
          totalTasksAssigned: increment(1)
        });
      } else {
        await setDoc(userStatsRef, {
          userId: formData.assignedTo,
          totalTasksAssigned: 1,
          tasksCompleted: 0,
          totalPoints: 0,
          totalCompletionTime: 0,
          averageCompletionTime: 0,
          lastUpdated: Timestamp.now()
        });
      }

      await createNotification(
        formData.assignedTo,
        `New ${formData.isRecurring ? 'Recurring ' : ''}Task Assigned 📋`,
        `You have been assigned: ${formData.title}${selectedClient ? ` for ${selectedClient.name}` : ''}${formData.isRecurring ? ` (${formData.recurringPattern})` : ''}`,
        'task'
      );

      setSuccess(`Task${formData.isRecurring ? 's' : ''} created successfully!`);
      setShowModal(false);
      resetForm();
      fetchTasks();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error creating task:', error);
      setError('Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTask = async () => {
    if (!editingTask) return;

    setLoading(true);
    try {
      const assignedUser = users.find(u => u.uid === formData.assignedTo);
      const selectedClient = clients.find(c => c.id === formData.clientId);
      
      await updateDoc(doc(db, 'tasks', editingTask.id), {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        assignedTo: formData.assignedTo,
        assignedToName: assignedUser?.displayName || '',
        dueDate: Timestamp.fromDate(new Date(formData.dueDate)),
        clientId: formData.clientId || null,
        clientName: selectedClient?.name || null,
      });

      if (formData.assignedTo !== editingTask.assignedTo) {
        await createNotification(
          formData.assignedTo,
          'Task Reassigned 📋',
          `You have been assigned: ${formData.title}`,
          'task'
        );
      }

      setSuccess('Task updated successfully!');
      setShowModal(false);
      setEditingTask(null);
      resetForm();
      fetchTasks();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error updating task:', error);
      setError('Failed to update task');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;

    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      
      const commentsRef = collection(db, 'taskComments');
      const commentsQuery = query(commentsRef, where('taskId', '==', taskId));
      const commentsSnapshot = await getDocs(commentsQuery);
      
      const deletePromises = commentsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      setSuccess('Task deleted successfully!');
      fetchTasks();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error deleting task:', error);
      setError('Failed to delete task');
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: 'pending' | 'in-progress' | 'completed') => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      const now = new Date();
      const statusUpdate: StatusUpdate = {
        status: newStatus,
        timestamp: now,
        updatedBy: currentUser?.uid || '',
        updatedByName: userData?.displayName || ''
      };

      const updatedStatusHistory = [...(task.statusHistory || []), statusUpdate];

      if (newStatus === 'completed' && !task.completedAt) {
        const completedAt = now;
        const completionTimeHours = differenceInHours(completedAt, task.assignedAt);
        const { points, isEarly } = calculatePoints(task.dueDate, completedAt);

        await updateDoc(doc(db, 'tasks', taskId), {
          status: newStatus,
          completedAt: Timestamp.fromDate(completedAt),
          completionTimeHours,
          points,
          isEarlyComplete: isEarly,
          statusHistory: updatedStatusHistory
        });

        if (currentUser?.uid === task.assignedTo) {
          await updateUserStats(task.assignedTo, points, completionTimeHours);
        }

        if (task.createdBy !== currentUser?.uid) {
          await createNotification(
            task.createdBy,
            'Task Completed ✅',
            `${task.title} has been completed${isEarly ? ' early!' : '!'} (+${points} points)`,
            'task'
          );
        }

        setSuccess(`Task completed! ${isEarly ? `+${points} bonus points! 🎉` : `+${points} points`}`);
      } else {
        await updateDoc(doc(db, 'tasks', taskId), {
          status: newStatus,
          statusHistory: updatedStatusHistory
        });

        if (task.createdBy !== currentUser?.uid) {
          await createNotification(
            task.createdBy,
            'Task Status Updated',
            `${task.title} is now ${newStatus}`,
            'task'
          );
        }

        setSuccess('Status updated successfully!');
      }

      fetchTasks();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error updating status:', error);
      setError('Failed to update status');
    }
  };

  const handleSendComment = async () => {
    if (!selectedTask || !newComment.trim() || !currentUser) return;

    setSendingMessage(true);
    try {
      await addDoc(collection(db, 'taskComments'), {
        taskId: selectedTask.id,
        message: newComment.trim(),
        sentBy: currentUser.uid,
        sentByName: userData?.displayName || 'Unknown',
        sentByRole: userRole,
        timestamp: Timestamp.now(),
      });

      const notifyUsers = [selectedTask.createdBy, selectedTask.assignedTo].filter(
        uid => uid !== currentUser.uid
      );

      for (const uid of notifyUsers) {
        await createNotification(
          uid,
          `New comment on: ${selectedTask.title}`,
          `${userData?.displayName}: ${newComment.slice(0, 50)}...`,
          'task'
        );
      }

      setNewComment('');
      fetchTasks();
    } catch (error) {
      console.error('Error sending comment:', error);
      setError('Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const openChatModal = (task: Task) => {
    setSelectedTask(task);
    setShowChatModal(true);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      status: 'pending',
      priority: 'medium',
      assignedTo: '',
      dueDate: '',
      clientId: '',
      isRecurring: false,
      recurringPattern: 'weekly',
      recurringEndDate: '',
    });
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assignedTo: task.assignedTo,
      dueDate: task.dueDate.toISOString().split('T')[0],
      clientId: task.clientId || '',
      isRecurring: false,
      recurringPattern: 'weekly',
      recurringEndDate: '',
    });
    setShowModal(true);
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
    const matchesClient = filterClient === 'all' || 
                          (filterClient === '' ? !task.clientId : task.clientId === filterClient);
    
    return matchesSearch && matchesStatus && matchesPriority && matchesClient;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'in-progress': return <Clock className="h-5 w-5 text-blue-600" />;
      case 'pending': return <AlertCircle className="h-5 w-5 text-gray-600" />;
      default: return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  const canEditTask = (task: Task) => {
    return userRole === 'superadmin';
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'superadmin': return 'bg-red-100 text-red-700';
      case 'admin': return 'bg-yellow-100 text-yellow-700';
      case 'member': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatCompletionTime = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)} mins`;
    } else if (hours < 24) {
      return `${Math.round(hours)} hrs`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = Math.round(hours % 24);
      return `${days}d ${remainingHours}h`;
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-600 mt-1">Manage and track your team's tasks</p>
        </div>
        {(userRole === 'superadmin' || userRole === 'admin') && (
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center">
            <Plus className="h-5 w-5 mr-2" />
            Create Task
          </button>
        )}
      </div>

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>

          <select
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Clients</option>
            <option value="">No Client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tasks Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredTasks.map((task) => (
          <div key={task.id} className="card hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-2 flex-wrap gap-2">
                {getStatusIcon(task.status)}
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPriorityColor(task.priority)}`}>
                  {task.priority}
                </span>
                {task.isRecurring && (
                  <span className="flex items-center px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                    <Repeat className="h-3 w-3 mr-1" />
                    {task.recurringPattern}
                  </span>
                )}
                {task.isEarlyComplete && task.points && (
                  <span className="flex items-center px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                    <Award className="h-3 w-3 mr-1" />
                    +{task.points}
                  </span>
                )}
                {task.clientName && (
                  <span className="flex items-center px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                    <Building2 className="h-3 w-3 mr-1" />
                    {task.clientName}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => openChatModal(task)}
                  className="relative p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="View discussion"
                >
                  <MessageCircle className="h-4 w-4" />
                  {task.commentsCount! > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {task.commentsCount}
                    </span>
                  )}
                </button>
                
                {canEditTask(task) && (
                  <>
                    <button
                      onClick={() => openEditModal(task)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit task"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete task"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            <h3 className="font-semibold text-lg text-gray-900 mb-2">{task.title}</h3>
            <p className="text-sm text-gray-600 mb-4 line-clamp-2">{task.description}</p>

            <div className="space-y-2 mb-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Assigned to:</span>
                <span className="font-medium text-gray-900">{task.assignedToName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Assigned at:</span>
                <span className="font-medium text-gray-900">{format(task.assignedAt, 'MMM d, h:mm a')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Due date:</span>
                <span className="font-medium text-gray-900">{format(task.dueDate, 'MMM d, yyyy')}</span>
              </div>
              {task.completedAt && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Completed:</span>
                    <span className="font-medium text-green-600">{format(task.completedAt, 'MMM d, h:mm a')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Time taken:</span>
                    <span className="font-medium text-gray-900">{formatCompletionTime(task.completionTimeHours || 0)}</span>
                  </div>
                </>
              )}
              {task.createdByName && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Created by:</span>
                  <span className="font-medium text-gray-900">{task.createdByName}</span>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-gray-100">
              <label className="block text-xs font-medium text-gray-700 mb-2">Update Status:</label>
              <select
                value={task.status}
                onChange={(e) => handleStatusChange(task.id, e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={task.status === 'completed'}
              >
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        ))}
      </div>

      {filteredTasks.length === 0 && (
        <div className="card text-center py-12">
          <CheckCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            {tasks.length === 0 ? 'No tasks assigned to you yet' : 'No tasks match your filters'}
          </p>
          {(userRole === 'superadmin' || userRole === 'admin') && tasks.length === 0 && (
            <button onClick={() => setShowModal(true)} className="mt-4 text-primary-600 font-medium">
              Create your first task
            </button>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (userRole === 'superadmin' || userRole === 'admin') && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {editingTask ? 'Edit Task' : 'Create New Task'}
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Task Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter task title"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter task description"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assign To *
                </label>
                <select
                  value={formData.assignedTo}
                  onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={loading}
                >
                  <option value="">Select team member</option>
                  {users.map((user) => (
                    <option key={user.uid} value={user.uid}>
                      {user.displayName} ({user.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client (Optional)
                </label>
                <select
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={loading}
                >
                  <option value="">No Client</option>
                  <option value="all">All Clients</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} {client.company && `(${client.company})`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority *
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={loading}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={loading}
                  >
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Date *
                </label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={loading}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              {!editingTask && (
                <>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isRecurring"
                      checked={formData.isRecurring}
                      onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                      className="h-4 w-4 text-primary-600 rounded focus:ring-primary-500"
                      disabled={loading}
                    />
                    <label htmlFor="isRecurring" className="ml-2 text-sm font-medium text-gray-700">
                      Make this a recurring task
                    </label>
                  </div>

                  {formData.isRecurring && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Recurring Pattern *
                        </label>
                        <select
                          value={formData.recurringPattern}
                          onChange={(e) => setFormData({ ...formData, recurringPattern: e.target.value as any })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                          disabled={loading}
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Recurring End Date *
                        </label>
                        <input
                          type="date"
                          value={formData.recurringEndDate}
                          onChange={(e) => setFormData({ ...formData, recurringEndDate: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                          disabled={loading}
                          min={formData.dueDate || new Date().toISOString().split('T')[0]}
                        />
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingTask(null);
                  setError('');
                  resetForm();
                }}
                className="flex-1 btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={editingTask ? handleUpdateTask : handleCreateTask}
                className="flex-1 btn-primary disabled:opacity-50"
                disabled={loading || !formData.title || !formData.assignedTo || !formData.dueDate}
              >
                {loading ? 'Saving...' : editingTask ? 'Update Task' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Modal */}
      {showChatModal && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full h-[600px] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex-1">
                <h2 className="text-lg font-bold text-gray-900">{selectedTask.title}</h2>
                <p className="text-sm text-gray-500">Task Discussion</p>
              </div>
              <button
                onClick={() => {
                  setShowChatModal(false);
                  setSelectedTask(null);
                  setComments([]);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <MessageCircle className="h-12 w-12 mb-2" />
                  <p className="text-sm">No messages yet. Start the discussion!</p>
                </div>
              ) : (
                comments.map((comment) => {
                  const isCurrentUser = comment.sentBy === currentUser?.uid;
                  
                  return (
                    <div
                      key={comment.id}
                      className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[70%] ${isCurrentUser ? 'order-2' : 'order-1'}`}>
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-xs font-medium text-gray-900">
                            {comment.sentByName}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getRoleBadgeColor(comment.sentByRole)}`}>
                            {comment.sentByRole}
                          </span>
                        </div>
                        <div
                          className={`rounded-lg p-3 ${
                            isCurrentUser
                              ? 'bg-primary-600 text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">{comment.message}</p>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {format(comment.timestamp, 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-gray-200">
              <div className="flex items-end space-x-2">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendComment();
                    }
                  }}
                  placeholder="Type your message... (Shift+Enter for new line)"
                  rows={2}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  disabled={sendingMessage}
                />
                <button
                  onClick={handleSendComment}
                  disabled={!newComment.trim() || sendingMessage}
                  className="p-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Press Enter to send, Shift+Enter for new line
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
