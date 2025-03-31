
import React, { useState } from 'react';
import Sidebar from '@/components/admin/Sidebar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import SubscriptionSection from '@/components/settings/SubscriptionSection';

const SettingsPage = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [autoSaveDrafts, setAutoSaveDrafts] = useState(false);
  const { toast } = useToast();
  const { user, isOwner, isGlobalAdmin } = useAuth();

  // Check if user is owner or global admin
  const canAccessBilling = isOwner || isGlobalAdmin;

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmNewPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Password has been updated",
      });
      
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error) {
      console.error('Error updating password:', error);
      toast({
        title: "Error",
        description: "Failed to update password",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSwitch = (setting: string) => {
    switch (setting) {
      case 'emailNotifications':
        setEmailNotifications(!emailNotifications);
        break;
      case 'darkMode':
        setDarkMode(!darkMode);
        break;
      case 'autoSaveDrafts':
        setAutoSaveDrafts(!autoSaveDrafts);
        break;
      default:
        break;
    }
    
    toast({
      title: "Setting updated",
      description: "Your preference has been saved",
    });
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Settings</h1>
          
          <Tabs defaultValue="account" className="w-full">
            <TabsList className="w-full mb-8 bg-white/5">
              <TabsTrigger value="account" className="flex-1">Account</TabsTrigger>
              {canAccessBilling && <TabsTrigger value="billing" className="flex-1">Billing</TabsTrigger>}
              <TabsTrigger value="preferences" className="flex-1">Preferences</TabsTrigger>
            </TabsList>
            
            <TabsContent value="account">
              <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 mb-8">
                <h2 className="text-xl font-semibold mb-4">Account Information</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Email Address</label>
                    <input
                      type="email"
                      className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-2"
                      value={user?.email || ''}
                      disabled
                    />
                  </div>
                </div>
              </div>
              
              <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 mb-8">
                <h2 className="text-xl font-semibold mb-4">Security</h2>
                <form onSubmit={handlePasswordUpdate} className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Current Password</label>
                    <input
                      type="password"
                      className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-2"
                      placeholder="••••••••"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">New Password</label>
                    <input
                      type="password"
                      className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-2"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-2"
                      placeholder="••••••••"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                    />
                  </div>
                  
                  <div className="pt-2">
                    <button 
                      type="submit"
                      disabled={isSubmitting || !currentPassword || !newPassword || !confirmNewPassword}
                      className="px-6 py-2 bg-blue-600 rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              </div>
              
              <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6">
                <h2 className="text-xl font-semibold text-red-400 mb-4">Danger Zone</h2>
                <p className="text-gray-400 mb-4">Permanently delete your account and all of your content.</p>
                <button className="px-6 py-2 bg-red-600/30 text-red-300 border border-red-600/50 rounded-md hover:bg-red-600/40 transition">
                  Delete Account
                </button>
              </div>
            </TabsContent>
            
            {canAccessBilling && (
              <TabsContent value="billing">
                <SubscriptionSection />
              </TabsContent>
            )}
            
            <TabsContent value="preferences">
              <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 mb-8">
                <h2 className="text-xl font-semibold mb-4">Account Preferences</h2>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-medium">Email Notifications</h3>
                        <p className="text-sm text-gray-400">Receive email notifications for important updates</p>
                      </div>
                      <div 
                        onClick={() => toggleSwitch('emailNotifications')} 
                        className={`h-6 w-11 ${emailNotifications ? 'bg-blue-600' : 'bg-white/10'} rounded-full p-1 cursor-pointer transition-colors`}
                      >
                        <div className={`h-4 w-4 bg-white rounded-full transform transition-transform ${emailNotifications ? 'translate-x-5' : 'translate-x-0'}`}></div>
                      </div>
                    </div>
                  </div>
                  
                  <Separator className="bg-white/10" />
                  
                  <div>
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-medium">Dark Mode</h3>
                        <p className="text-sm text-gray-400">Toggle between light and dark themes</p>
                      </div>
                      <div 
                        onClick={() => toggleSwitch('darkMode')} 
                        className={`h-6 w-11 ${darkMode ? 'bg-blue-600' : 'bg-white/10'} rounded-full p-1 cursor-pointer transition-colors`}
                      >
                        <div className={`h-4 w-4 bg-white rounded-full transform transition-transform ${darkMode ? 'translate-x-5' : 'translate-x-0'}`}></div>
                      </div>
                    </div>
                  </div>
                  
                  <Separator className="bg-white/10" />
                  
                  <div>
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-medium">Auto-save Drafts</h3>
                        <p className="text-sm text-gray-400">Automatically save post drafts while writing</p>
                      </div>
                      <div 
                        onClick={() => toggleSwitch('autoSaveDrafts')} 
                        className={`h-6 w-11 ${autoSaveDrafts ? 'bg-blue-600' : 'bg-white/10'} rounded-full p-1 cursor-pointer transition-colors`}
                      >
                        <div className={`h-4 w-4 bg-white rounded-full transform transition-transform ${autoSaveDrafts ? 'translate-x-5' : 'translate-x-0'}`}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
