import { Building2, Mail, Phone, ArrowRight, MoreVertical } from 'lucide-react';
import { type Client } from '../../contexts/ClientContext';
import { useState } from 'react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

interface ClientCardProps {
  client: Client;
  onClick: () => void;
}

export const ClientCard = ({ client, onClick }: ClientCardProps) => {
  const [showMenu, setShowMenu] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400';
      case 'inactive':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const handleStatusChange = async (newStatus: 'active' | 'inactive' | 'pending') => {
    try {
      await updateDoc(doc(db, 'clients', client.id), {
        status: newStatus,
        updatedAt: new Date(),
      });
      setShowMenu(false);
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${client.name}?`)) return;

    try {
      await deleteDoc(doc(db, 'clients', client.id));
    } catch (error) {
      console.error('Error deleting client:', error);
      alert('Failed to delete client');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 hover:shadow-lg transition-all cursor-pointer group relative">
      <div className="absolute top-4 right-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <MoreVertical className="w-4 h-4 text-gray-500" />
        </button>

        {showMenu && (
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg z-10">
            <div className="py-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusChange('active');
                }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300"
              >
                Mark as Active
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusChange('inactive');
                }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300"
              >
                Mark as Inactive
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
              >
                Delete Client
              </button>
            </div>
          </div>
        )}
      </div>

      <div onClick={onClick}>
        <div className="flex items-start justify-between mb-4 pr-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                {client.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {client.company || 'No company'}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Mail className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{client.email}</span>
          </div>
          {client.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Phone className="w-4 h-4 flex-shrink-0" />
              {client.phone}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(client.status)}`}>
              {client.status}
            </span>
            {client.industry && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {client.industry}
              </span>
            )}
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-primary-600 group-hover:translate-x-1 transition-all" />
        </div>
      </div>
    </div>
  );
};
