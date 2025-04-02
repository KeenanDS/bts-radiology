
import React from 'react';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import UserInviteForm from './UserInviteForm';

interface UserInviteDialogProps {
  onUserInvited: () => Promise<void>;
}

const UserInviteDialog = ({ onUserInvited }: UserInviteDialogProps) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleSuccess = async () => {
    setIsOpen(false);
    await onUserInvited();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center text-zinc-950">
          <UserPlus className="mr-2 h-4 w-4" />
          Add New User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite New User</DialogTitle>
          <DialogDescription>
            Send an invitation email to add a new administrator to the platform.
          </DialogDescription>
        </DialogHeader>

        <UserInviteForm onSuccess={handleSuccess} onCancel={() => setIsOpen(false)} />
      </DialogContent>
    </Dialog>
  );
};

export default UserInviteDialog;
