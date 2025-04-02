
import React from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DialogFooter } from '@/components/ui/dialog';

const newUserSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  role: z.enum(['administrator', 'owner', 'global_administrator'])
});

type NewUserFormValues = z.infer<typeof newUserSchema>;

interface UserInviteFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const UserInviteForm = ({ onSuccess, onCancel }: UserInviteFormProps) => {
  const [creatingUser, setCreatingUser] = React.useState(false);
  const { toast } = useToast();

  const form = useForm<NewUserFormValues>({
    resolver: zodResolver(newUserSchema),
    defaultValues: {
      email: '',
      fullName: '',
      role: 'administrator'
    }
  });

  const inviteNewUser = async (values: NewUserFormValues) => {
    setCreatingUser(true);
    try {
      // Invite user via email
      const { data, error } = await supabase.auth.admin.inviteUserByEmail(values.email, {
        data: {
          full_name: values.fullName,
          role: values.role
        }
      });

      if (error) throw error;

      toast({
        title: 'Invitation sent',
        description: `An invitation has been sent to ${values.email}`
      });

      form.reset();
      onSuccess();
    } catch (error: any) {
      console.error('Error inviting user:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send invitation',
        variant: 'destructive'
      });
    } finally {
      setCreatingUser(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(inviteNewUser)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input {...field} placeholder="user@example.com" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input {...field} placeholder="John Doe" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="administrator">Administrator</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="global_administrator">Global Administrator</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button type="submit" disabled={creatingUser}>
            {creatingUser ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending Invitation...
              </>
            ) : 'Send Invitation'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
};

export default UserInviteForm;
