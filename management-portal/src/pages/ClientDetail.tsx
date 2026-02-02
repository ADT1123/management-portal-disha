import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc,
  updateDoc,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  ArrowLeft, 
  Building2, 
  Mail, 
  Phone, 
  CheckSquare, 
  Calendar, 
  FileText, 
  Plus,
  Trash2,
  Globe,
  MapPin,
  Edit2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  industry?: string;
  status: string;
  website?: string;
  address?: string;
  notes?: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  deadline?: any;
  assignedTo?: string;
  assignedToName?: string;
}

interface Meeting {
  id: string;
  title: string;
  description: string;
  date: any;
  time?: string;
  location?: string;
  participants?: string[];
}

interface Note {
  id: string;
  note: string;
  createdBy: string;
  createdByName: string;
  createdAt: any;
}

export const ClientDetail = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'meetings' | 'notes'>('overview');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch client details
  useEffect(() => {
    if (!clientId) return;

    const fetchClient = async () => {
      try {
        const clientDoc = await getDoc(doc(db, 'clients', clientId));
        if (clientDoc.exists()) {
          setClient({ id: clientDoc.id, ...clientDoc.data() } as Client);
        } else {
          navigate('/clients');
        }
      } catch (error) {
        console.error('Error fetching client:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchClient();
  }, [clientId, navigate]);

  // Fetch client-specific tasks
  useEffect(() => {
    if (!clientId) return;

    const tasksRef = collection(db, 'tasks');
    const q = query(tasksRef, where('clientId', '==', clientId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskData = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as Task[];
      setTasks(taskData);
    });

    return () => unsubscribe();
  }, [clientId]);

  // Fetch client-specific meetings
  useEffect(() => {
    if (!clientId) return;

    const meetingsRef = collection(db, 'meetings');
    const q = query(meetingsRef, where('clientId', '==', clientId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const meetingData = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as Meeting[];
      setMeetings(meetingData);
    });

    return () => unsubscribe();
  }, [clientId]);

  // Fetch client notes
  useEffect(() => {
    if (!clientId) return;

    const notesRef = collection(db, 'clientNotes');
    const q = query(notesRef, where('clientId', '==', clientId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const noteData = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as Note[];
      setNotes(noteData.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds));
    });

    return () => unsubscribe();
  }, [clientId]);

  const handleAddNote = async () => {
    if (!newNote.trim() || !clientId) return;

    try {
      await addDoc(collection(db, 'clientNotes'), {
        clientId,
        note: newNote,
        createdBy: currentUser?.uid,
        createdByName: currentUser?.email?.split('@')[0] || 'Unknown',
        createdAt: Timestamp.now(),
      });
      setNewNote('');
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Delete this note?')) return;

    try {
      await deleteDoc(doc(db, 'clientNotes', noteId));
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Delete this task?')) return;

    try {
      await deleteDoc(doc(db, 'tasks', taskId));
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    if (!confirm('Delete this meeting?')) return;

    try {
      await deleteDoc(doc(db, 'meetings', meetingId));
    } catch (error) {
      console.error('Error deleting meeting:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400';
      case 'in_progress':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 dark:text-red-400';
      case 'medium':
        return 'text-orange-600 dark:text-orange-400';
      case 'low':
        return 'text-green-600 dark:text-green-400';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-primary-600"></div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Client not found</h3>
        <button
          onClick={() => navigate('/clients')}
          className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          Back to Clients
        </button>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Building2 },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, count: tasks.length },
    { id: 'meetings', label: 'Meetings', icon: Calendar, count: meetings.length },
    { id: 'notes', label: 'Notes', icon: FileText, count: notes.length },
  ];

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate('/clients')}
        className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Clients
      </button>

      {/* Client Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{client.name}</h1>
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                  client.status === 'active' 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' 
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {client.status}
                </span>
              </div>
              {client.company && (
                <p className="text-gray-500 dark:text-gray-400 mb-3">{client.company}</p>
              )}
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Mail className="w-4 h-4" />
                  {client.email}
                </div>
                {client.phone && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Phone className="w-4 h-4" />
                    {client.phone}
                  </div>
                )}
                {client.website && (
                  <a 
                    href={client.website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    <Globe className="w-4 h-4" />
                    Website
                  </a>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate(`/clients/${clientId}/edit`)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
        </div>

        {(client.address || client.industry) && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-800 flex flex-wrap gap-4 text-sm">
            {client.industry && (
              <div className="text-gray-600 dark:text-gray-400">
                <span className="font-medium">Industry:</span> {client.industry}
              </div>
            )}
            {client.address && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <MapPin className="w-4 h-4" />
                {client.address}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-slate-800">
        <nav className="flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{tab.label}</span>
                {tab.count !== undefined && (
                  <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-slate-800 rounded-full">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-4">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Tasks</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{tasks.length}</div>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-4">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Meetings</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{meetings.length}</div>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-4">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Notes</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{notes.length}</div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Tasks</h3>
                {tasks.slice(0, 3).length > 0 ? (
                  <div className="space-y-3">
                    {tasks.slice(0, 3).map((task) => (
                      <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{task.title}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{task.assignedToName || 'Unassigned'}</div>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(task.status)}`}>
                          {task.status?.replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No tasks yet</p>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {client.notes && (
                <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Client Notes</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">{client.notes}</p>
                </div>
              )}

              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => navigate(`/tasks?clientId=${clientId}`)}
                    className="w-full flex items-center gap-2 px-4 py-2 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create Task
                  </button>
                  <button
                    onClick={() => navigate(`/meetings?clientId=${clientId}`)}
                    className="w-full flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Schedule Meeting
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tasks Tab */}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <div key={task.id} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-lg">{task.title}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{task.description}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(task.status)}`}>
                        {task.status?.replace('_', ' ')}
                      </span>
                      <span className={`text-xs font-medium ${getPriorityColor(task.priority)}`}>
                        {task.priority} priority
                      </span>
                    </div>
                    {task.assignedToName && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Assigned to: {task.assignedToName}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <CheckSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">No tasks for this client yet</p>
                <button
                  onClick={() => navigate(`/tasks?clientId=${clientId}`)}
                  className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Create First Task
                </button>
              </div>
            )}
          </div>
        )}

        {/* Meetings Tab */}
        {activeTab === 'meetings' && (
          <div className="space-y-4">
            {meetings.length > 0 ? (
              meetings.map((meeting) => (
                <div key={meeting.id} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-lg">{meeting.title}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{meeting.description}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteMeeting(meeting.id)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {meeting.date?.toDate?.().toLocaleDateString()}
                    </div>
                    {meeting.time && <span>{meeting.time}</span>}
                    {meeting.location && <span>📍 {meeting.location}</span>}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">No meetings scheduled for this client</p>
                <button
                  onClick={() => navigate(`/meetings?clientId=${clientId}`)}
                  className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Schedule Meeting
                </button>
              </div>
            )}
          </div>
        )}

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-4">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note about this client..."
                className="w-full px-4 py-3 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-primary-500"
                rows={3}
              />
              <button
                onClick={handleAddNote}
                disabled={!newNote.trim()}
                className="mt-3 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Add Note
              </button>
            </div>

            {notes.map((note) => (
              <div key={note.id} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-6">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-gray-900 dark:text-white flex-1">{note.note}</p>
                  {note.createdBy === currentUser?.uid && (
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{note.createdByName}</span>
                  <span>{note.createdAt?.toDate?.().toLocaleString()}</span>
                </div>
              </div>
            ))}

            {notes.length === 0 && (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">No notes yet for this client</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
