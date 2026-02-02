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
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { createNotification } from '../utils/notifications';
import { Plus, Calendar, Clock, MapPin, Users, Trash2, Edit2, FileText, X, CheckCircle2, Circle, XCircle, Building2, Repeat } from 'lucide-react';
import { format, isPast, isToday, isTomorrow, isThisWeek, isThisMonth, startOfDay, endOfDay, addDays, addWeeks, addMonths } from 'date-fns';

interface Meeting {
  id: string;
  title: string;
  description: string;
  date: Date;
  location: string;
  attendees: string[];
  createdBy: string;
  createdByName: string;
  mom?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  createdAt: Date;
  clientId?: string;
  clientName?: string;
  isRecurring?: boolean;
  recurringPattern?: 'daily' | 'weekly' | 'monthly';
  recurringEndDate?: Date;
  parentMeetingId?: string;
}

interface Client {
  id: string;
  name: string;
  company?: string;
}

export const Meetings = () => {
  const { currentUser, userRole, userData } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showMomModal, setShowMomModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [momText, setMomText] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'scheduled' | 'completed' | 'cancelled'>('scheduled');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
    attendees: [] as string[],
    clientId: '',
    isRecurring: false,
    recurringPattern: 'weekly' as 'daily' | 'weekly' | 'monthly',
    recurringEndDate: '',
  });

  useEffect(() => {
    if (currentUser && userRole) {
      fetchMeetings();
      fetchUsers();
      fetchClients();
    }
  }, [currentUser, userRole]);

  const fetchMeetings = async () => {
    try {
      const meetingsRef = collection(db, 'meetings');
      const q = query(meetingsRef, orderBy('date', 'asc'));
      const snapshot = await getDocs(q);

      const meetingsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate() || new Date(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        recurringEndDate: doc.data().recurringEndDate?.toDate() || null,
        status: doc.data().status || 'scheduled',
      })) as Meeting[];

      setMeetings(meetingsData);
    } catch (error) {
      console.error('Error fetching meetings:', error);
      setError('Failed to load meetings');
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

  const generateRecurringMeetings = async (
    baseMeeting: any,
    parentMeetingId: string,
    startDate: Date,
    endDate: Date,
    pattern: 'daily' | 'weekly' | 'monthly'
  ) => {
    const recurringMeetings = [];
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

      recurringMeetings.push({
        ...baseMeeting,
        date: Timestamp.fromDate(nextDate),
        createdAt: Timestamp.now(),
        parentMeetingId,
        isRecurring: false,
        status: 'scheduled',
      });

      currentDate = nextDate;
    }

    for (const meeting of recurringMeetings) {
      await addDoc(collection(db, 'meetings'), meeting);
    }
  };

  const handleCreateMeeting = async () => {
    if (!currentUser || !formData.title || !formData.date || !formData.time) {
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
      const meetingDateTime = new Date(`${formData.date}T${formData.time}`);
      const selectedClient = clients.find(c => c.id === formData.clientId);

      const baseMeetingData = {
        title: formData.title,
        description: formData.description,
        date: Timestamp.fromDate(meetingDateTime),
        location: formData.location,
        attendees: formData.attendees,
        createdBy: currentUser.uid,
        createdByName: userData?.displayName || '',
        mom: '',
        status: 'scheduled' as 'scheduled' | 'completed' | 'cancelled',
        createdAt: Timestamp.now(),
        clientId: formData.clientId || null,
        clientName: selectedClient?.name || null,
        isRecurring: formData.isRecurring,
        recurringPattern: formData.isRecurring ? formData.recurringPattern : null,
        recurringEndDate: formData.isRecurring ? Timestamp.fromDate(new Date(formData.recurringEndDate)) : null,
      };

      const docRef = await addDoc(collection(db, 'meetings'), baseMeetingData);

      if (formData.isRecurring) {
        await generateRecurringMeetings(
          baseMeetingData,
          docRef.id,
          meetingDateTime,
          new Date(formData.recurringEndDate),
          formData.recurringPattern
        );
      }

      for (const attendeeId of formData.attendees) {
        await createNotification(
          attendeeId,
          `New ${formData.isRecurring ? 'Recurring ' : ''}Meeting Scheduled`,
          `Meeting: ${formData.title}${selectedClient ? ` with ${selectedClient.name}` : ''} on ${format(meetingDateTime, 'PPP')}${formData.isRecurring ? ` (${formData.recurringPattern})` : ''}`,
          'meeting'
        );
      }

      setSuccess(`Meeting${formData.isRecurring ? 's' : ''} created successfully!`);
      setShowModal(false);
      resetForm();
      fetchMeetings();

      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error creating meeting:', error);
      setError('Failed to create meeting');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMeeting = async () => {
    if (!editingMeeting) return;

    setLoading(true);
    try {
      const meetingDateTime = new Date(`${formData.date}T${formData.time}`);
      const selectedClient = clients.find(c => c.id === formData.clientId);

      await updateDoc(doc(db, 'meetings', editingMeeting.id), {
        title: formData.title,
        description: formData.description,
        date: Timestamp.fromDate(meetingDateTime),
        location: formData.location,
        attendees: formData.attendees,
        clientId: formData.clientId || null,
        clientName: selectedClient?.name || null,
      });

      for (const attendeeId of formData.attendees) {
        await createNotification(
          attendeeId,
          'Meeting Updated',
          `Meeting details updated: ${formData.title}`,
          'meeting'
        );
      }

      setSuccess('Meeting updated successfully!');
      setShowModal(false);
      setEditingMeeting(null);
      resetForm();
      fetchMeetings();

      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error updating meeting:', error);
      setError('Failed to update meeting');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    if (!window.confirm('Are you sure you want to delete this meeting?')) return;

    try {
      await deleteDoc(doc(db, 'meetings', meetingId));
      setSuccess('Meeting deleted successfully!');
      fetchMeetings();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error deleting meeting:', error);
      setError('Failed to delete meeting');
    }
  };

  const openStatusModal = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setSelectedStatus(meeting.status);
    setShowStatusModal(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedMeeting || !currentUser || userRole !== 'superadmin') return;

    setLoading(true);
    try {
      await updateDoc(doc(db, 'meetings', selectedMeeting.id), {
        status: selectedStatus,
        updatedAt: Timestamp.now(),
        updatedBy: currentUser.uid,
      });

      const statusText = selectedStatus === 'completed' ? 'Completed' : selectedStatus === 'cancelled' ? 'Cancelled' : 'Scheduled';
      for (const attendeeId of selectedMeeting.attendees) {
        await createNotification(
          attendeeId,
          'Meeting Status Updated',
          `${selectedMeeting.title} is now ${statusText}`,
          'meeting'
        );
      }

      setSuccess(`Meeting status updated to ${selectedStatus}!`);
      setShowStatusModal(false);
      setSelectedMeeting(null);
      fetchMeetings();

      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error updating status:', error);
      setError('Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const openMomModal = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setMomText(meeting.mom || '');
    setShowMomModal(true);
  };

  const handleSaveMom = async () => {
    if (!selectedMeeting || !currentUser) return;

    setLoading(true);
    try {
      await updateDoc(doc(db, 'meetings', selectedMeeting.id), {
        mom: momText.trim(),
        momUpdatedAt: Timestamp.now(),
        momUpdatedBy: currentUser.uid,
      });

      const momNotificationTitle = 'MOM Updated';
      const momNotificationMessage = `Minutes of Meeting added for: ${selectedMeeting.title}`;
      
      for (const attendeeId of selectedMeeting.attendees) {
        await createNotification(
          attendeeId,
          momNotificationTitle,
          momNotificationMessage,
          'meeting'
        );
      }

      setSuccess('MOM saved and attendees notified successfully!');
      setShowMomModal(false);
      setSelectedMeeting(null);
      setMomText('');
      fetchMeetings();

      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error saving MOM:', error);
      setError('Failed to save MOM');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      date: '',
      time: '',
      location: '',
      attendees: [],
      clientId: '',
      isRecurring: false,
      recurringPattern: 'weekly',
      recurringEndDate: '',
    });
  };

  const openEditModal = (meeting: Meeting) => {
    setEditingMeeting(meeting);
    setFormData({
      title: meeting.title,
      description: meeting.description,
      date: format(meeting.date, 'yyyy-MM-dd'),
      time: format(meeting.date, 'HH:mm'),
      location: meeting.location,
      attendees: meeting.attendees,
      clientId: meeting.clientId || '',
      isRecurring: false,
      recurringPattern: 'weekly',
      recurringEndDate: '',
    });
    setShowModal(true);
  };

  const toggleAttendee = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      attendees: prev.attendees.includes(userId)
        ? prev.attendees.filter(id => id !== userId)
        : [...prev.attendees, userId]
    }));
  };

  const canEditMeeting = (userRole === 'superadmin' || userRole === 'admin');
  const canEditMom = (userRole === 'superadmin');
  const canUpdateStatus = (userRole === 'superadmin');

  const categorizeMeetings = () => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const today: Meeting[] = [];
    const tomorrow: Meeting[] = [];
    const thisWeek: Meeting[] = [];
    const thisMonth: Meeting[] = [];
    const upcoming: Meeting[] = [];
    const past: Meeting[] = [];

    const filteredMeetings = filterClient === 'all' 
      ? meetings 
      : meetings.filter(m => filterClient === '' ? !m.clientId : m.clientId === filterClient);

    filteredMeetings.forEach(meeting => {
      const meetingDate = meeting.date;
      
      if (meetingDate < todayStart) {
        past.push(meeting);
      }
      else if (meetingDate >= todayStart && meetingDate <= todayEnd) {
        today.push(meeting);
      }
      else if (isTomorrow(meetingDate)) {
        tomorrow.push(meeting);
      }
      else if (isThisWeek(meetingDate) && !isToday(meetingDate) && !isTomorrow(meetingDate)) {
        thisWeek.push(meeting);
      }
      else if (isThisMonth(meetingDate) && !isThisWeek(meetingDate)) {
        thisMonth.push(meeting);
      }
      else {
        upcoming.push(meeting);
      }
    });

    return { today, tomorrow, thisWeek, thisMonth, upcoming, past };
  };

  const { today, tomorrow, thisWeek, thisMonth, upcoming, past } = categorizeMeetings();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'cancelled':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Circle className="h-5 w-5 text-blue-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-blue-100 text-blue-700';
    }
  };

  const renderMeetingCard = (meeting: Meeting) => (
    <div key={meeting.id} className={`card hover:shadow-md transition-shadow ${meeting.status === 'cancelled' ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2 flex-wrap gap-2">
            <h3 className="text-xl font-semibold text-gray-900">{meeting.title}</h3>
            <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusColor(meeting.status)}`}>
              {meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1)}
            </span>
            {meeting.isRecurring && (
              <span className="flex items-center px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                <Repeat className="h-3 w-3 mr-1" />
                {meeting.recurringPattern}
              </span>
            )}
            {meeting.clientName && (
              <span className="flex items-center px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                <Building2 className="h-3 w-3 mr-1" />
                {meeting.clientName}
              </span>
            )}
          </div>
          {meeting.description && <p className="text-gray-600 mb-3">{meeting.description}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center text-gray-700">
              <Calendar className="h-4 w-4 mr-2 text-primary-600" />
              <span>{format(meeting.date, 'PPP')}</span>
            </div>
            <div className="flex items-center text-gray-700">
              <Clock className="h-4 w-4 mr-2 text-primary-600" />
              <span>{format(meeting.date, 'p')}</span>
            </div>
            {meeting.location && (
              <div className="flex items-center text-gray-700">
                <MapPin className="h-4 w-4 mr-2 text-primary-600" />
                <span>{meeting.location}</span>
              </div>
            )}
            <div className="flex items-center text-gray-700">
              <Users className="h-4 w-4 mr-2 text-primary-600" />
              <span>{meeting.attendees.length} attendees</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
          {canUpdateStatus && (
            <button
              onClick={() => openStatusModal(meeting)}
              className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              title="Update status"
            >
              {getStatusIcon(meeting.status)}
            </button>
          )}

          <button
            onClick={() => openMomModal(meeting)}
            className={`p-2 rounded-lg transition-colors ${
              meeting.mom 
                ? 'text-green-600 hover:bg-green-50' 
                : 'text-gray-400 hover:bg-gray-100'
            }`}
            title={meeting.mom ? 'View MOM' : 'Add MOM'}
          >
            <FileText className="h-5 w-5" />
          </button>

          {canEditMeeting && (
            <>
              <button
                onClick={() => openEditModal(meeting)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Edit meeting"
              >
                <Edit2 className="h-5 w-5" />
              </button>
              <button
                onClick={() => handleDeleteMeeting(meeting.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete meeting"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {meeting.attendees.length > 0 && (
        <div className="pt-3 border-t border-gray-200">
          <p className="text-xs font-medium text-gray-700 mb-2">Attendees:</p>
          <div className="flex flex-wrap gap-2">
            {meeting.attendees.map((attendeeId) => {
              const user = users.find(u => u.uid === attendeeId);
              return user ? (
                <span
                  key={attendeeId}
                  className="inline-flex items-center px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-xs font-medium"
                >
                  {user.displayName}
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );

  const renderMeetingSection = (title: string, meetingsList: Meeting[]) => {
    if (meetingsList.length === 0) return null;

    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <span className="text-sm text-gray-500 font-medium bg-gray-100 px-3 py-1 rounded-full">
            {meetingsList.length} {meetingsList.length === 1 ? 'meeting' : 'meetings'}
          </span>
        </div>
        <div className="space-y-4">
          {meetingsList.map(meeting => renderMeetingCard(meeting))}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Meetings</h1>
          <p className="text-gray-600 mt-1">Schedule and manage team meetings</p>
        </div>
        <div className="flex items-center gap-3">
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

          {canEditMeeting && (
            <button onClick={() => setShowModal(true)} className="btn-primary flex items-center whitespace-nowrap">
              <Plus className="h-5 w-5 mr-2" />
              Schedule Meeting
            </button>
          )}
        </div>
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

      {renderMeetingSection('Today', today)}
      {renderMeetingSection('Tomorrow', tomorrow)}
      {renderMeetingSection('This Week', thisWeek)}
      {renderMeetingSection('This Month', thisMonth)}
      {renderMeetingSection('Upcoming', upcoming)}
      {renderMeetingSection('Past Meetings', past)}

      {meetings.length === 0 && (
        <div className="card text-center py-12">
          <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No meetings scheduled yet</p>
          {canEditMeeting && (
            <button onClick={() => setShowModal(true)} className="mt-4 text-primary-600 font-medium">
              Schedule your first meeting
            </button>
          )}
        </div>
      )}

      {/* Create/Edit Meeting Modal */}
      {showModal && canEditMeeting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {editingMeeting ? 'Edit Meeting' : 'Schedule Meeting'}
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meeting Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter meeting title"
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
                  placeholder="Enter meeting description"
                  disabled={loading}
                />
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
                    Date *
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={loading}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Time *
                  </label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Meeting location or link"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Attendees
                </label>
                <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
                  {users.map((user) => (
                    <label
                      key={user.uid}
                      className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.attendees.includes(user.uid)}
                        onChange={() => toggleAttendee(user.uid)}
                        className="h-4 w-4 text-primary-600 rounded focus:ring-primary-500"
                        disabled={loading}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{user.displayName}</p>
                        <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {formData.attendees.length} attendee(s) selected
                </p>
              </div>

              {!editingMeeting && (
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
                      Make this a recurring meeting
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
                          min={formData.date || new Date().toISOString().split('T')[0]}
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
                  setEditingMeeting(null);
                  setError('');
                  resetForm();
                }}
                className="flex-1 btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={editingMeeting ? handleUpdateMeeting : handleCreateMeeting}
                className="flex-1 btn-primary disabled:opacity-50"
                disabled={loading || !formData.title || !formData.date || !formData.time}
              >
                {loading ? 'Saving...' : editingMeeting ? 'Update Meeting' : 'Schedule Meeting'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {showStatusModal && selectedMeeting && canUpdateStatus && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Update Meeting Status</h2>

            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-2">Meeting:</p>
              <p className="font-semibold text-gray-900">{selectedMeeting.title}</p>
            </div>

            <div className="space-y-3 mb-6">
              <label className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="status"
                  value="scheduled"
                  checked={selectedStatus === 'scheduled'}
                  onChange={(e) => setSelectedStatus(e.target.value as any)}
                  className="h-4 w-4 text-blue-600"
                />
                <div className="ml-3 flex items-center">
                  <Circle className="h-5 w-5 text-blue-600 mr-2" />
                  <div>
                    <p className="font-medium text-gray-900">Scheduled</p>
                    <p className="text-xs text-gray-500">Meeting is planned</p>
                  </div>
                </div>
              </label>

              <label className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="status"
                  value="completed"
                  checked={selectedStatus === 'completed'}
                  onChange={(e) => setSelectedStatus(e.target.value as any)}
                  className="h-4 w-4 text-green-600"
                />
                <div className="ml-3 flex items-center">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mr-2" />
                  <div>
                    <p className="font-medium text-gray-900">Completed</p>
                    <p className="text-xs text-gray-500">Meeting finished successfully</p>
                  </div>
                </div>
              </label>

              <label className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="status"
                  value="cancelled"
                  checked={selectedStatus === 'cancelled'}
                  onChange={(e) => setSelectedStatus(e.target.value as any)}
                  className="h-4 w-4 text-red-600"
                />
                <div className="ml-3 flex items-center">
                  <XCircle className="h-5 w-5 text-red-600 mr-2" />
                  <div>
                    <p className="font-medium text-gray-900">Cancelled</p>
                    <p className="text-xs text-gray-500">Meeting was cancelled</p>
                  </div>
                </div>
              </label>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowStatusModal(false);
                  setSelectedMeeting(null);
                }}
                className="flex-1 btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateStatus}
                className="flex-1 btn-primary"
                disabled={loading}
              >
                {loading ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOM Modal */}
      {showMomModal && selectedMeeting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Minutes of Meeting</h2>
                <p className="text-sm text-gray-600 mt-1">{selectedMeeting.title}</p>
              </div>
              <button
                onClick={() => {
                  setShowMomModal(false);
                  setSelectedMeeting(null);
                  setMomText('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Date:</span>
                  <span className="font-medium text-gray-900">
                    {format(selectedMeeting.date, 'PPP p')}
                  </span>
                </div>
                {selectedMeeting.location && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Location:</span>
                    <span className="font-medium text-gray-900">{selectedMeeting.location}</span>
                  </div>
                )}
                {selectedMeeting.clientName && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Client:</span>
                    <span className="font-medium text-gray-900">{selectedMeeting.clientName}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Attendees:</span>
                  <span className="font-medium text-gray-900">
                    {selectedMeeting.attendees.length} people
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedMeeting.status)}`}>
                    {selectedMeeting.status.charAt(0).toUpperCase() + selectedMeeting.status.slice(1)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meeting Notes
                </label>
                <textarea
                  value={momText}
                  onChange={(e) => setMomText(e.target.value)}
                  rows={12}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  placeholder={canEditMom ? "Enter meeting notes, decisions, and action items..." : "No notes added yet"}
                  disabled={!canEditMom || loading}
                  readOnly={!canEditMom}
                />
                {!canEditMom && (
                  <p className="text-xs text-gray-500 mt-2">
                    Only Super Admin can edit MOM
                  </p>
                )}
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowMomModal(false);
                  setSelectedMeeting(null);
                  setMomText('');
                }}
                className="flex-1 btn-secondary"
                disabled={loading}
              >
                {canEditMom ? 'Cancel' : 'Close'}
              </button>
              {canEditMom && (
                <button
                  onClick={handleSaveMom}
                  className="flex-1 btn-primary disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save MOM'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
