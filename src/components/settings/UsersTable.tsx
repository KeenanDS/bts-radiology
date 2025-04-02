
import React from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type UserRoleOption = 'global_administrator' | 'owner' | 'administrator';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRoleOption;
  created_at: string;
}

interface UsersTableProps {
  users: UserProfile[];
  loading: boolean;
  currentUserId: string | undefined;
  isGlobalAdmin: boolean;
  onRefresh: () => Promise<void>;
}

const UsersTable = ({ 
  users, 
  loading, 
  currentUserId, 
  isGlobalAdmin,
  onRefresh 
}: UsersTableProps) => {
  const { toast } = useToast();

  const updateUserRole = async (userId: string, newRole: UserRoleOption) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'User role updated successfully'
      });
      
      onRefresh();
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        title: 'Error',
        description: 'Failed to update user role',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2">Loading user data...</span>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map(user => (
          <TableRow key={user.id}>
            <TableCell>{user.full_name || 'N/A'}</TableCell>
            <TableCell>{user.email}</TableCell>
            <TableCell>
              {currentUserId !== user.id && isGlobalAdmin ? (
                <Select
                  defaultValue={user.role}
                  onValueChange={(value: UserRoleOption) => updateUserRole(user.id, value)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="administrator">Administrator</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="global_administrator">Global Administrator</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <span className="capitalize">{user.role.replace('_', ' ')}</span>
              )}
            </TableCell>
            <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
            <TableCell>
              {currentUserId !== user.id && (
                <Button variant="outline" size="sm" onClick={onRefresh}>
                  Refresh
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default UsersTable;
