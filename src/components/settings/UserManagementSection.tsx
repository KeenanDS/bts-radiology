
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { UserCog } from 'lucide-react';
import UsersTable from './UsersTable';
import UserInviteDialog from './UserInviteDialog';

type UserRoleOption = 'global_administrator' | 'owner' | 'administrator';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRoleOption;
  created_at: string;
}

const UserManagementSection = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user: currentUser, isGlobalAdmin } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center">
            <UserCog className="mr-2 h-6 w-6" />
            User Management
          </h2>
          <p className="text-sm text-gray-400">
            Manage user roles and permissions for the admin dashboard.
          </p>
        </div>

        {isGlobalAdmin && (
          <UserInviteDialog onUserInvited={fetchUsers} />
        )}
      </div>
      
      <UsersTable 
        users={users} 
        loading={loading} 
        currentUserId={currentUser?.id} 
        isGlobalAdmin={isGlobalAdmin}
        onRefresh={fetchUsers}
      />
    </div>
  );
};

export default UserManagementSection;
