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
import { Plus, Search, CheckCircle, Clock, AlertCircle, Trash2, Edit2, MessageCircle, Send, X, Award, Building2, Repeat, Calendar, Users, History } from 'lucide-react';
import { format, differenceInHours, addDays, addWeeks, addMonths, isBefore, startOfWeek, startOfMonth, endOfWeek, endOfMonth } from 'date-fns';

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

// ✅ TaskCompletion interface - Stores history of each completion
interface TaskCompletion {
  id: string;
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  assignedTo: string;
  assignedToName: string;
  clientId?: string;
  clientName?: string;
  createdBy: string;
  createdByName: string;
  priority: 'low' | 'medium' | 'high';
  assignedAt: Date;
  dueDate: Date;
  completedAt: Date;
  completionTimeHours: number;
  points: number;
  isEarlyComplete: boolean;
  isRecurringCompletion: boolean;
  recurringPattern?: 'daily' | 'weekly' | 'monthly';
  occurrenceNumber: number;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  assignedTo: string | string[];
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
  isRecurring?: boolean;                    // ✅ Recurring flag
  recurringPattern?: 'daily' | 'weekly' | 'monthly';  // ✅ Pattern
  recurringEndDate?: Date;                  // ✅ Optional end date
  lastCompletedDate?: Date;                 // ✅ Last completion timestamp
  completionCount?: number;                 // ✅ How many times completed
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
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskHistory, setTaskHistory] = useState<TaskCompletion[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterDuration, setFilterDuration] = useState<string>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
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

  // ✅ Fetch all tasks (no child task filtering needed)
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
            lastCompletedDate: data.lastCompletedDate?.toDate() || null,
            recurringEndDate: data.recurringEndDate?.toDate() || null,
            statusHistory: data.statusHistory?.map((sh: any) => ({
              ...sh,
              timestamp: sh.timestamp?.toDate() || new Date()
            })) || [],
            commentsCount: commentsSnapshot.size,
            completionCount: data.completionCount || 0,
          };
        })
      );

      setTasks(tasksData as Task[]);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setError('Failed to load tasks');
    }
  };

  // ✅ Fetch completion history for a specific task
  const fetchTaskHistory = async (taskId: string) => {
    try {
      const completionsRef = collection(db, 'taskCompletions');
      const q = query(
        completionsRef,
        where('taskId', '==', taskId),
        orderBy('completedAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const historyData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        assignedAt: doc.data().assignedAt?.toDate() || new Date(),
        dueDate: doc.data().dueDate?.toDate() || new Date(),
        completedAt: doc.data().completedAt?.toDate() || new Date(),
      })) as TaskCompletion[];
      
      setTaskHistory(historyData);
    } catch (error) {
      console.error('Error fetching task history:', error);
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

  // ✅ Calculate next occurrence date based on pattern
  const getNextOccurrenceDate = (currentDate: Date, pattern: 'daily' | 'weekly' | 'monthly'): Date => {
    switch (pattern) {
      case 'daily':
        return addDays(currentDate, 1);
      case 'weekly':
        return addWeeks(currentDate, 1);
      case 'monthly':
        return addMonths(currentDate, 1);
      default:
        return addWeeks(currentDate, 1);
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

  const handleUserSelection = (userId: string) => {
    if (userId === 'all') {
      if (selectedUsers.length === users.length) {
        setSelectedUsers([]);
        setFormData({ ...formData, assignedTo: '' });
      } else {
        const allUserIds = users.map(u => u.uid);
        setSelectedUsers(allUserIds);
        setFormData({ ...formData, assignedTo: 'all' });
      }
    } else {
      if (selectedUsers.includes(userId)) {
        const updated = selectedUsers.filter(id => id !== userId);
        setSelectedUsers(updated);
        setFormData({ ...formData, assignedTo: updated.length === 1 ? updated[0] : '' });
      } else {
        const updated = [...selectedUsers, userId];
        setSelectedUsers(updated);
        setFormData({ ...formData, assignedTo: updated.length === 1 ? updated[0] : '' });
      }
    }
  };

  // ✅ Multi-client selection handler
  const handleClientSelection = (clientId: string) => {
    if (clientId === 'all') {
      if (selectedClients.length === clients.length) {
        setSelectedClients([]);
        setFormData({ ...formData, clientId: '' });
      } else {
        const allClientIds = clients.map(c => c.id);
        setSelectedClients(allClientIds);
        setFormData({ ...formData, clientId: 'all' });
      }
    } else {
      if (selectedClients.includes(clientId)) {
        const updated = selectedClients.filter(id => id !== clientId);
        setSelectedClients(updated);
        setFormData({ ...formData, clientId: updated.length === 1 ? updated[0] : '' });
      } else {
        const updated = [...selectedClients, clientId];
        setSelectedClients(updated);
        setFormData({ ...formData, clientId: updated.length === 1 ? updated[0] : '' });
      }
    }
  };
  // ✅ Create Task - ONLY creates 1 task per user-client combination (no child tasks!)
  const handleCreateTask = async () => {
    if (!currentUser || !formData.title || selectedUsers.length === 0 || !formData.dueDate) {
      setError('Please fill all required fields and select at least one user');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const now = Timestamp.now();
      
      const initialStatusHistory: StatusUpdate = {
        status: formData.status,
        timestamp: now.toDate(),
        updatedBy: currentUser.uid,
        updatedByName: userData?.displayName || ''
      };
      
      // Multi-client support
      const clientsToProcess = selectedClients.length > 0 ? selectedClients : [''];
      
      for (const userId of selectedUsers) {
        const assignedUser = users.find(u => u.uid === userId);
        
        for (const clientId of clientsToProcess) {
          const selectedClient = clientId ? clients.find(c => c.id === clientId) : null;
          
          // ✅ Create ONLY 1 task - it will auto-reset on completion
          const taskData = {
            title: formData.title,
            description: formData.description,
            status: formData.status,
            priority: formData.priority,
            assignedTo: userId,
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
            clientId: clientId || null,
            clientName: selectedClient?.name || null,
            isRecurring: formData.isRecurring,
            recurringPattern: formData.isRecurring ? formData.recurringPattern : null,
            recurringEndDate: formData.isRecurring && formData.recurringEndDate 
              ? Timestamp.fromDate(new Date(formData.recurringEndDate)) 
              : null,
            completionCount: 0,
            lastCompletedDate: null,
          };

          // ✅ Single task creation - no future tasks generated
          await addDoc(collection(db, 'tasks'), taskData);

          if (clientId) {
            const clientRef = doc(db, 'clients', clientId);
            const clientDoc = await getDoc(clientRef);
            
            if (clientDoc.exists()) {
              const currentTaskCount = clientDoc.data().taskCount || 0;
              await updateDoc(clientRef, {
                taskCount: currentTaskCount + 1,
                lastTaskAssigned: now
              });
            }
          }
        }

        const userStatsRef = doc(db, 'userStats', userId);
        const userStatsDoc = await getDoc(userStatsRef);
        
        const tasksCreated = clientsToProcess.length;
        
        if (userStatsDoc.exists()) {
          await updateDoc(userStatsRef, {
            totalTasksAssigned: increment(tasksCreated)
          });
        } else {
          await setDoc(userStatsRef, {
            userId: userId,
            totalTasksAssigned: tasksCreated,
            tasksCompleted: 0,
            totalPoints: 0,
            totalCompletionTime: 0,
            averageCompletionTime: 0,
            lastUpdated: Timestamp.now()
          });
        }

        const clientInfo = selectedClients.length > 0 
          ? ` for ${selectedClients.length} client(s)` 
          : selectedClient ? ` for ${selectedClient.name}` : '';

        await createNotification(
          userId,
          `New ${formData.isRecurring ? 'Recurring ' : ''}Task Assigned 📋`,
          `You have been assigned: ${formData.title}${clientInfo}${formData.isRecurring ? ` (${formData.recurringPattern})` : ''}`,
          'task'
        );
      }

      const totalTasks = selectedUsers.length * clientsToProcess.length;
      setSuccess(`${totalTasks} task${totalTasks > 1 ? 's' : ''} created successfully!`);
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
    if (!window.confirm('Are you sure you want to delete this task? This will also delete all comments but preserve completion history.')) return;

    try {
      await deleteDoc(doc(db, 'tasks', taskId));

      const commentsRef = collection(db, 'taskComments');
      const commentsQuery = query(commentsRef, where('taskId', '==', taskId));
      const commentsSnapshot = await getDocs(commentsQuery);
      const deleteCommentsPromises = commentsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deleteCommentsPromises);

      setSuccess('Task deleted successfully! (History preserved)');
      fetchTasks();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error deleting task:', error);
      setError('Failed to delete task');
    }
  };

  // ✅ CORE AUTO-RESET LOGIC - The heart of recurring tasks!
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

      if (newStatus === 'completed') {
        const completedAt = now;
        const completionTimeHours = differenceInHours(completedAt, task.assignedAt);
        const { points, isEarly } = calculatePoints(task.dueDate, completedAt);

        // ✅ STEP 1: Save completion to history (permanent record)
        const completionData = {
          taskId: task.id,
          taskTitle: task.title,
          taskDescription: task.description,
          assignedTo: task.assignedTo,
          assignedToName: task.assignedToName || '',
          clientId: task.clientId || null,
          clientName: task.clientName || null,
          createdBy: task.createdBy,
          createdByName: task.createdByName || '',
          priority: task.priority,
          assignedAt: Timestamp.fromDate(task.assignedAt),
          dueDate: Timestamp.fromDate(task.dueDate),
          completedAt: Timestamp.fromDate(completedAt),
          completionTimeHours,
          points,
          isEarlyComplete: isEarly,
          isRecurringCompletion: task.isRecurring || false,
          recurringPattern: task.recurringPattern || null,
          occurrenceNumber: (task.completionCount || 0) + 1,
        };

        await addDoc(collection(db, 'taskCompletions'), completionData);

        // ✅ STEP 2: Check if recurring task
        if (task.isRecurring && task.recurringPattern) {
          const nextDueDate = getNextOccurrenceDate(task.dueDate, task.recurringPattern);
          const shouldContinue = !task.recurringEndDate || isBefore(nextDueDate, task.recurringEndDate);
          
          if (shouldContinue) {
            // ✅ AUTO-RESET: Update same task to next occurrence
            await updateDoc(doc(db, 'tasks', taskId), {
              status: 'pending',                              // Reset to pending
              dueDate: Timestamp.fromDate(nextDueDate),       // Next week/month/day
              assignedAt: Timestamp.now(),                    // New assignment time
              lastCompletedDate: Timestamp.fromDate(completedAt),  // Track last completion
              completionCount: (task.completionCount || 0) + 1,    // Increment counter
              completedAt: null,                              // Clear completion
              completionTimeHours: 0,                         // Reset time
              points: 0,                                      // Reset points
              isEarlyComplete: false,                         // Reset early flag
              statusHistory: [{                               // Fresh status history
                status: 'pending',
                timestamp: now,
                updatedBy: currentUser?.uid || '',
                updatedByName: userData?.displayName || ''
              }]
            });

            // Update user stats
            if (currentUser?.uid === task.assignedTo) {
              await updateUserStats(task.assignedTo as string, points, completionTimeHours);
            }

            // Notify admin
            if (task.createdBy !== currentUser?.uid) {
              await createNotification(
                task.createdBy,
                'Recurring Task Completed ✅🔄',
                `${task.title} completed${isEarly ? ' early!' : '!'} (+${points} pts). Next: ${format(nextDueDate, 'MMM d')}`,
                'task'
              );
            }

            // Notify assignee about next occurrence
            await createNotification(
              task.assignedTo as string,
              'Recurring Task - Next Occurrence 🔄',
              `${task.title} is now due on ${format(nextDueDate, 'MMM d, yyyy')}`,
              'task'
            );

            setSuccess(`Task completed! ${isEarly ? `+${points} bonus points! 🎉` : `+${points} points`} Next due: ${format(nextDueDate, 'MMM d')}`);
          } else {
            // ✅ END SERIES: Recurring period ended
            await updateDoc(doc(db, 'tasks', taskId), {
              status: 'completed',
              completedAt: Timestamp.fromDate(completedAt),
              completionTimeHours,
              points,
              isEarlyComplete: isEarly,
              lastCompletedDate: Timestamp.fromDate(completedAt),
              completionCount: (task.completionCount || 0) + 1,
              statusHistory: updatedStatusHistory,
              isRecurring: false  // Stop recurring
            });

            if (currentUser?.uid === task.assignedTo) {
              await updateUserStats(task.assignedTo as string, points, completionTimeHours);
            }

            if (task.createdBy !== currentUser?.uid) {
              await createNotification(
                task.createdBy,
                'Recurring Task Series Completed ✅',
                `${task.title} series completed! Total: ${(task.completionCount || 0) + 1} times`,
                'task'
              );
            }

            setSuccess(`Recurring task series completed! Total completions: ${(task.completionCount || 0) + 1} 🎉`);
          }
        } else {
          // ✅ Regular (non-recurring) task completion
          await updateDoc(doc(db, 'tasks', taskId), {
            status: newStatus,
            completedAt: Timestamp.fromDate(completedAt),
            completionTimeHours,
            points,
            isEarlyComplete: isEarly,
            statusHistory: updatedStatusHistory
          });

          if (currentUser?.uid === task.assignedTo) {
            await updateUserStats(task.assignedTo as string, points, completionTimeHours);
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
        }
      } else {
        // Status change to pending or in-progress
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
          uid as string,
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

  const openHistoryModal = async (task: Task) => {
    setSelectedTask(task);
    await fetchTaskHistory(task.id);
    setShowHistoryModal(true);
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
    setSelectedUsers([]);
    setSelectedClients([]);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assignedTo: task.assignedTo as string,
      dueDate: task.dueDate.toISOString().split('T')[0],
      clientId: task.clientId || '',
      isRecurring: false,
      recurringPattern: 'weekly',
      recurringEndDate: '',
    });
    setShowModal(true);
  };

  const getFilteredTasksByDuration = () => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (filterDuration) {
      case 'week':
        startDate = startOfWeek(now, { weekStartsOn: 0 });
        endDate = endOfWeek(now, { weekStartsOn: 0 });
        break;
      case 'month':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          startDate = new Date(customStartDate);
          endDate = new Date(customEndDate);
          endDate.setHours(23, 59, 59, 999);
        } else {
          return tasks;
        }
        break;
      default:
        return tasks;
    }

    return tasks.filter(task => {
      const taskDate = task.assignedAt;
      return taskDate >= startDate && taskDate <= endDate;
    });
  };

  const filteredTasks = getFilteredTasksByDuration().filter(task => {
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

      {/* FILTERS */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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

          <select
            value={filterDuration}
            onChange={(e) => setFilterDuration(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Time</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        {filterDuration === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline h-4 w-4 mr-1" />
                Start Date
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline h-4 w-4 mr-1" />
                End Date
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* TASK CARDS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredTasks.map((task) => (
          <div key={task.id} className="card hover:shadow-lg transition-shadow">
            {/* TASK HEADER WITH BADGES */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-2 flex-wrap gap-2">
                {getStatusIcon(task.status)}
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPriorityColor(task.priority)}`}>
                  {task.priority}
                </span>
                {/* ✅ Recurring badge */}
                {task.isRecurring && (
                  <span className="flex items-center px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                    <Repeat className="h-3 w-3 mr-1" />
                    {task.recurringPattern}
                  </span>
                )}
                {/* ✅ Completion counter badge */}
                {task.isRecurring && task.completionCount! > 0 && (
                  <span className="flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    🔄 ×{task.completionCount}
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
              {/* ACTION BUTTONS */}
              <div className="flex items-center space-x-1">
                {/* ✅ History button (only for recurring or completed tasks) */}
                {(task.isRecurring || task.completionCount! > 0) && (
                  <button
                    onClick={() => openHistoryModal(task)}
                    className="relative p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                    title="View completion history"
                  >
                    <History className="h-4 w-4" />
                    {task.completionCount! > 0 && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 bg-purple-500 text-white text-xs rounded-full flex items-center justify-center">
                        {task.completionCount}
                      </span>
                    )}
                  </button>
                )}
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

            {/* TASK CONTENT */}
            <h3 className="font-semibold text-lg text-gray-900 mb-2">{task.title}</h3>
            <p className="text-sm text-gray-600 mb-4 line-clamp-2">{task.description}</p>

            {/* TASK DETAILS */}
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
              {/* ✅ Last completed date for recurring tasks */}
              {task.lastCompletedDate && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Last completed:</span>
                  <span className="font-medium text-green-600">{format(task.lastCompletedDate, 'MMM d, h:mm a')}</span>
                </div>
              )}
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

            {/* STATUS UPDATE DROPDOWN */}
            <div className="pt-4 border-t border-gray-100">
              <label className="block text-xs font-medium text-gray-700 mb-2">Update Status:</label>
              <select
                value={task.status}
                onChange={(e) => handleStatusChange(task.id, e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={task.status === 'completed' && !task.isRecurring}
              >
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        ))}
      </div>

      {/* EMPTY STATE */}
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

      {/* ==================== CREATE/EDIT MODAL ==================== */}
      {showModal && (userRole === 'superadmin' || userRole === 'admin') && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-primary-50 to-white">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingTask ? 'Edit Task' : 'Create New Task'}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {editingTask ? 'Update task details' : 'Assign a new task to your team'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingTask(null);
                  setError('');
                  resetForm();
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-start">
                  <AlertCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Task Details</h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Task Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="e.g., Weekly Sales Report"
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                      placeholder="Enter task description..."
                      disabled={loading}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Priority <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Due Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.dueDate}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>

                {!editingTask && (
                  <>
                    {/* MULTI-USER SELECTION */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center">
                        <Users className="h-4 w-4 mr-2" />
                        Assign to Users <span className="text-red-500 ml-1">*</span>
                      </h3>
                      
                      <div className="border border-gray-200 rounded-lg p-4 max-h-48 overflow-y-auto">
                        <label className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer mb-2">
                          <input
                            type="checkbox"
                            checked={selectedUsers.length === users.length}
                            onChange={() => handleUserSelection('all')}
                            className="h-4 w-4 text-primary-600 rounded focus:ring-primary-500"
                          />
                          <span className="ml-3 text-sm font-medium text-gray-900">Select All Users</span>
                        </label>
                        <div className="border-t border-gray-200 pt-2">
                          {users.map((user) => (
                            <label key={user.uid} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedUsers.includes(user.uid)}
                                onChange={() => handleUserSelection(user.uid)}
                                className="h-4 w-4 text-primary-600 rounded focus:ring-primary-500"
                              />
                              <span className="ml-3 text-sm text-gray-700">{user.displayName}</span>
                              <span className={`ml-auto text-xs px-2 py-1 rounded ${getRoleBadgeColor(user.role)}`}>
                                {user.role}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                      {selectedUsers.length > 0 && (
                        <p className="text-xs text-gray-600">
                          ✓ {selectedUsers.length} user(s) selected
                        </p>
                      )}
                    </div>

                    {/* ✅ MULTI-CLIENT SELECTION */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center">
                        <Building2 className="h-4 w-4 mr-2" />
                        Select Clients (Optional)
                      </h3>
                      
                      <div className="border border-gray-200 rounded-lg p-4 max-h-48 overflow-y-auto">
                        <label className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer mb-2">
                          <input
                            type="checkbox"
                            checked={selectedClients.length === clients.length}
                            onChange={() => handleClientSelection('all')}
                            className="h-4 w-4 text-primary-600 rounded focus:ring-primary-500"
                          />
                          <span className="ml-3 text-sm font-medium text-gray-900">Select All Clients</span>
                        </label>
                        <div className="border-t border-gray-200 pt-2">
                          {clients.map((client) => (
                            <label key={client.id} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedClients.includes(client.id)}
                                onChange={() => handleClientSelection(client.id)}
                                className="h-4 w-4 text-primary-600 rounded focus:ring-primary-500"
                              />
                              <span className="ml-3 text-sm text-gray-700">{client.name}</span>
                              {client.company && (
                                <span className="ml-auto text-xs text-gray-500">{client.company}</span>
                              )}
                            </label>
                          ))}
                        </div>
                      </div>
                      {selectedClients.length > 0 && (
                        <p className="text-xs text-gray-600">
                          ✓ {selectedClients.length} client(s) selected
                        </p>
                      )}
                      {selectedUsers.length > 0 && selectedClients.length > 0 && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-xs text-blue-700">
                            ℹ️ This will create <strong>{selectedUsers.length} × {selectedClients.length} = {selectedUsers.length * selectedClients.length} tasks</strong>
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {editingTask && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Assign to <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.assignedTo}
                        onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                      >
                        <option value="">Select user...</option>
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
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                      >
                        <option value="">No Client</option>
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {/* ✅ RECURRING TASK OPTIONS */}
                {!editingTask && (
                  <div className="space-y-4 border-t border-gray-200 pt-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="isRecurring"
                        checked={formData.isRecurring}
                        onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                        className="h-4 w-4 text-primary-600 rounded focus:ring-primary-500"
                      />
                      <label htmlFor="isRecurring" className="ml-3 text-sm font-medium text-gray-700 flex items-center">
                        <Repeat className="h-4 w-4 mr-1" />
                        Make this a recurring task
                      </label>
                    </div>

                    {formData.isRecurring && (
                      <div className="ml-7 space-y-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Recurring Pattern
                          </label>
                          <select
                            value={formData.recurringPattern}
                            onChange={(e) => setFormData({ ...formData, recurringPattern: e.target.value as any })}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            End Date (Optional)
                          </label>
                          <input
                            type="date"
                            value={formData.recurringEndDate}
                            onChange={(e) => setFormData({ ...formData, recurringEndDate: e.target.value })}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <p className="text-xs text-gray-600 mt-1">
                            Leave empty for continuous recurrence. Task will auto-reset on completion! 🔄
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3 bg-gray-50">
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingTask(null);
                  setError('');
                  resetForm();
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={editingTask ? handleUpdateTask : handleCreateTask}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? 'Processing...' : editingTask ? 'Update Task' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== HISTORY MODAL ==================== */}
      {showHistoryModal && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-purple-50 to-white">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                  <History className="h-6 w-6 mr-2 text-purple-600" />
                  Completion History
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedTask.title} - {taskHistory.length} completion(s)
                </p>
              </div>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedTask(null);
                  setTaskHistory([]);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {taskHistory.length === 0 ? (
                <div className="text-center py-12">
                  <History className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No completion history yet</p>
                  <p className="text-xs text-gray-400 mt-2">Complete the task to see history here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {taskHistory.map((completion, index) => (
                    <div key={completion.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-green-100 text-green-600 font-bold">
                            #{completion.occurrenceNumber}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              Occurrence #{completion.occurrenceNumber}
                            </p>
                            <p className="text-xs text-gray-500">
                              {format(completion.completedAt, 'MMM d, yyyy - h:mm a')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {completion.isEarlyComplete && (
                            <span className="flex items-center px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                              <Award className="h-3 w-3 mr-1" />
                              Early
                            </span>
                          )}
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            +{completion.points} pts
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600 text-xs">Assigned</p>
                          <p className="font-medium text-gray-900">
                            {format(completion.assignedAt, 'MMM d, h:mm a')}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600 text-xs">Due Date</p>
                          <p className="font-medium text-gray-900">
                            {format(completion.dueDate, 'MMM d, h:mm a')}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600 text-xs">Completed</p>
                          <p className="font-medium text-green-600">
                            {format(completion.completedAt, 'MMM d, h:mm a')}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600 text-xs">Time Taken</p>
                          <p className="font-medium text-gray-900">
                            {formatCompletionTime(completion.completionTimeHours)}
                          </p>
                        </div>
                      </div>

                      {completion.clientName && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-xs text-gray-600">
                            Client: <span className="font-medium text-gray-900">{completion.clientName}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* ✅ SUMMARY STATISTICS */}
                  {taskHistory.length > 0 && (
                    <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
                      <h3 className="font-semibold text-gray-900 mb-3">📊 Summary Statistics</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600 text-xs">Total Completions</p>
                          <p className="text-2xl font-bold text-gray-900">{taskHistory.length}</p>
                        </div>
                        <div>
                          <p className="text-gray-600 text-xs">Total Points</p>
                          <p className="text-2xl font-bold text-green-600">
                            {taskHistory.reduce((sum, c) => sum + c.points, 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600 text-xs">Avg. Time</p>
                          <p className="text-2xl font-bold text-blue-600">
                            {formatCompletionTime(
                              taskHistory.reduce((sum, c) => sum + c.completionTimeHours, 0) / taskHistory.length
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600 text-xs">Early Completions</p>
                          <p className="text-2xl font-bold text-yellow-600">
                            {taskHistory.filter(c => c.isEarlyComplete).length}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedTask(null);
                  setTaskHistory([]);
                }}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== CHAT MODAL ==================== */}
      {showChatModal && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-white">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                  <MessageCircle className="h-5 w-5 mr-2 text-blue-600" />
                  Task Discussion
                </h2>
                <p className="text-sm text-gray-600 mt-1 line-clamp-1">{selectedTask.title}</p>
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

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {comments.length === 0 ? (
                <div className="text-center py-12">
                  <MessageCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No comments yet. Start the discussion!</p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`flex ${comment.sentBy === currentUser?.uid ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        comment.sentBy === currentUser?.uid
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-xs font-semibold">{comment.sentByName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${getRoleBadgeColor(comment.sentByRole)}`}>
                          {comment.sentByRole}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words">{comment.message}</p>
                      <p
                        className={`text-xs mt-1 ${
                          comment.sentBy === currentUser?.uid ? 'text-primary-100' : 'text-gray-500'
                        }`}
                      >
                        {format(comment.timestamp, 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !sendingMessage && handleSendComment()}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={sendingMessage}
                />
                <button
                  onClick={handleSendComment}
                  disabled={!newComment.trim() || sendingMessage}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
