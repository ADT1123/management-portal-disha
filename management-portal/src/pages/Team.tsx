import { useEffect, useState } from 'react';
import { collection, getDocs, doc, deleteDoc, setDoc, Timestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { createNotification } from '../utils/notifications';
import type { User } from '../types';
import { Plus, Mail, Briefcase, Shield, Trash2, AlertTriangle, Copy, Eye, EyeOff } from 'lucide-react';

export const Team = () => {
  const { currentUser, userRole } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    displayName: '',
    password: '',
    role: 'member' as 'superadmin' | 'admin' | 'member',
    department: '',
    phone: '',
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const usersData = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as User[];
      
      setUsers(usersData.sort((a, b) => {
        const roleOrder = { superadmin: 0, admin: 1, member: 2 };
        return roleOrder[a.role] - roleOrder[b.role];
      }));
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  // Generate random password
  const generatePassword = () => {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setFormData({ ...formData, password });
    setGeneratedPassword(password);
  };

  const handleCreateUser = async () => {
    if (!currentUser || !formData.email || !formData.displayName || !formData.password) {
      setError('Please fill all required fields');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        formData.email, 
        formData.password
      );
      const newUser = userCredential.user;

      try {
        // Create user document in Firestore
        await setDoc(doc(db, 'users', newUser.uid), {
          email: formData.email,
          displayName: formData.displayName,
          role: formData.role,
          phone: formData.phone || '',
          department: formData.department || '',
          status: 'active',
          createdAt: Timestamp.now(),
          createdBy: currentUser.uid,
        });

        // Create notification for new user
        await createNotification(
          newUser.uid,
          'Welcome to the team! 🎉',
          'Your account has been created. You can now login with your email.',
          'user'
        );

        // Show success with password details
        const passwordInfo = formData.password;
        setSuccess(`User created successfully! Password: ${passwordInfo}`);
        
        // Alert with credentials
        alert(
          `✅ User Created Successfully!\n\n` +
          `Name: ${formData.displayName}\n` +
          `Email: ${formData.email}\n` +
          `Password: ${passwordInfo}\n` +
          `Role: ${formData.role}\n\n` +
          `⚠️ Please share these credentials securely with the user.\n` +
          `They can change their password in Settings after login.`
        );

        setShowModal(false);
        resetForm();
        fetchUsers();

        setTimeout(() => setSuccess(''), 5000);
      } catch (firestoreError) {
        // If Firestore creation fails, delete the auth user
        await newUser.delete();
        throw firestoreError;
      }
    } catch (error: any) {
      console.error('Error creating user:', error);
      
      if (error.code === 'auth/email-already-in-use') {
        setError('This email is already registered');
      } else if (error.code === 'auth/invalid-email') {
        setError('Invalid email address');
      } else if (error.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters');
      } else if (error.code === 'auth/network-request-failed') {
        setError('Network error. Please check your connection.');
      } else {
        setError('Failed to create user. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete || !currentUser) return;

    // Prevent self-deletion
    if (userToDelete.uid === currentUser.uid) {
      setError('You cannot delete your own account');
      return;
    }

    setLoading(true);
    try {
      // Delete user document from Firestore
      await deleteDoc(doc(db, 'users', userToDelete.uid));
      
      // Note: To delete from Firebase Auth, you need Admin SDK on backend
      // For now, we're just deleting from Firestore
      
      setSuccess(`${userToDelete.displayName} has been removed from the team`);
      setShowDeleteModal(false);
      setUserToDelete(null);
      fetchUsers();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error deleting user:', error);
      setError('Failed to delete user');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      displayName: '',
      password: '',
      role: 'member',
      department: '',
      phone: '',
    });
    setGeneratedPassword('');
    setShowPassword(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess('Password copied to clipboard!');
    setTimeout(() => setSuccess(''), 2000);
  };

  const canDeleteUser = (user: User) => {
    if (userRole === 'superadmin') return user.uid !== currentUser?.uid;
    if (userRole === 'admin') return user.role === 'member' && user.uid !== currentUser?.uid;
    return false;
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'superadmin': return 'bg-red-100 text-red-700';
      case 'admin': return 'bg-yellow-100 text-yellow-700';
      case 'member': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getAvatarColor = (name: string) => {
    const colors = ['bg-primary-600', 'bg-blue-600', 'bg-green-600', 'bg-yellow-600', 'bg-red-600', 'bg-purple-600'];
    return colors[name.charCodeAt(0) % colors.length];
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Team Members</h1>
          <p className="text-gray-600 mt-1">Manage your team and their roles</p>
        </div>
        {(userRole === 'superadmin' || userRole === 'admin') && (
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center">
            <Plus className="h-5 w-5 mr-2" />
            Add Member
          </button>
        )}
      </div>

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}

      {error && !showModal && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((user) => (
          <div key={user.uid} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start space-x-4">
              <div className={`h-14 w-14 rounded-full ${getAvatarColor(user.displayName)} flex items-center justify-center flex-shrink-0`}>
                <span className="text-xl font-semibold text-white">
                  {user.displayName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">
                  {user.displayName}
                  {user.uid === currentUser?.uid && (
                    <span className="ml-2 text-xs text-primary-600">(You)</span>
                  )}
                </h3>
                <div className="flex items-center text-sm text-gray-500 mt-1">
                  <Mail className="h-4 w-4 mr-1 flex-shrink-0" />
                  <span className="truncate">{user.email}</span>
                </div>
                {user.department && (
                  <div className="flex items-center text-sm text-gray-500 mt-1">
                    <Briefcase className="h-4 w-4 mr-1 flex-shrink-0" />
                    <span>{user.department}</span>
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                    <Shield className="h-3 w-3 mr-1" />
                    {user.role.toUpperCase()}
                  </span>
                  {canDeleteUser(user) && (
                    <button
                      onClick={() => {
                        setUserToDelete(user);
                        setShowDeleteModal(true);
                      }}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Remove user"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {users.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-gray-500">No team members found</p>
        </div>
      )}

      {/* Add Member Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Add Team Member</h2>
            
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="John Doe"
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="john@example.com"
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 pr-20 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Enter password"
                    disabled={loading}
                    required
                    minLength={6}
                  />
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1.5 text-gray-400 hover:text-gray-600"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    {formData.password && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(formData.password)}
                        className="p-1.5 text-gray-400 hover:text-gray-600"
                        title="Copy password"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-gray-500">Minimum 6 characters</p>
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                    disabled={loading}
                  >
                    Generate Password
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={loading}
                >
                  <option value="member">Member</option>
                  {userRole === 'superadmin' && (
                    <>
                      <option value="admin">Admin</option>
                      <option value="superadmin">Super Admin</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department (Optional)
                </label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Engineering, Marketing, etc."
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone (Optional)
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="+91 1234567890"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowModal(false);
                  setError('');
                  resetForm();
                }}
                className="flex-1 btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateUser}
                className="flex-1 btn-primary disabled:opacity-50"
                disabled={loading || !formData.email || !formData.displayName || !formData.password}
              >
                {loading ? 'Creating...' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mr-4">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Remove Team Member</h3>
                <p className="text-sm text-gray-600">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-gray-700 mb-6">
              Are you sure you want to remove <strong>{userToDelete.displayName}</strong> from the team?
            </p>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setUserToDelete(null);
                }}
                className="flex-1 btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
