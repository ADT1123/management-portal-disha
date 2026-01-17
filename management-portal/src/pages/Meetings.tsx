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
import { Plus, Calendar, Clock, MapPin, Users, Trash2, Edit2, FileText, X } from 'lucide-react';
import { format } from 'date-fns';

interface Meeting {
  id: string;
  title: string;
  description: string;
  date: Date;
  location: string;
  attendees: string[];
  createdBy: string;
  createdByName: string;
  mom?: string; // Minutes of Meeting
  createdAt: Date;
}

export const Meetings = () => {
  const { currentUser, userRole, userData } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showMomModal, setShowMomModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [momText, setMomText] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
    attendees: [] as string[],
  });

  useEffect(() => {
    if (currentUser && userRole) {
      fetchMeetings();
      fetchUsers();
    }
  }, [currentUser, userRole]);

  const fetchMeetings = async () => {
    try {
      const meetingsRef = collection(db, 'meetings');
      const q = query(meetingsRef, orderBy('date', 'desc'));
      const snapshot = await getDocs(q);

      const meetingsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate() || new Date(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
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

  const handleCreateMeeting = async () => {
    if (!currentUser || !formData.title || !formData.date || !formData.time) {
      setError('Please fill all required fields');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const meetingDateTime = new Date(`${formData.date}T${formData.time}`);

      await addDoc(collection(db, 'meetings'), {
        title: formData.title,
        description: formData.description,
        date: Timestamp.fromDate(meetingDateTime),
        location: formData.location,
        attendees: formData.attendees,
        createdBy: currentUser.uid,
        createdByName: userData?.displayName || '',
        mom: '', // Initialize empty MOM
        createdAt: Timestamp.now(),
      });

      // Notify attendees
      for (const attendeeId of formData.attendees) {
        await createNotification(
          attendeeId,
          'New Meeting Scheduled 📅',
          `Meeting: ${formData.title} on ${format(meetingDateTime, 'PPP')}`,
          'meeting'
        );
      }

      setSuccess('Meeting created successfully!');
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

      await updateDoc(doc(db, 'meetings', editingMeeting.id), {
        title: formData.title,
        description: formData.description,
        date: Timestamp.fromDate(meetingDateTime),
        location: formData.location,
        attendees: formData.attendees,
      });

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

  // Handle MOM
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
      });

      setSuccess('MOM saved successfully!');
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

  const isPastMeeting = (date: Date) => {
    return date < new Date();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Meetings</h1>
          <p className="text-gray-600 mt-1">Schedule and manage team meetings</p>
        </div>
        {canEditMeeting && (
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center">
            <Plus className="h-5 w-5 mr-2" />
            Schedule Meeting
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

      {/* Meetings List */}
      <div className="space-y-4">
        {meetings.map((meeting) => {
          const isPast = isPastMeeting(meeting.date);

          return (
            <div key={meeting.id} className={`card hover:shadow-md transition-shadow ${isPast ? 'bg-gray-50' : ''}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="text-xl font-semibold text-gray-900">{meeting.title}</h3>
                    {isPast && (
                      <span className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded-full">
                        Past
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 mb-3">{meeting.description}</p>

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
                  {/* MOM Button - All can view, Super Admin can edit */}
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

              {/* Attendees */}
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
        })}
      </div>

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
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Attendees:</span>
                  <span className="font-medium text-gray-900">
                    {selectedMeeting.attendees.length} people
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