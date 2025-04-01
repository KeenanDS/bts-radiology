
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/admin/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import SubscriptionSection from "@/components/settings/SubscriptionSection";
import UserManagementSection from "@/components/settings/UserManagementSection";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const SettingsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, userRole, refreshSession } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [currentEmail, setCurrentEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  useEffect(() => {
    if (user?.email) {
      setCurrentEmail(user.email);
      setNewEmail(user.email);
    }
  }, [user]);
  
  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newEmail || newEmail === currentEmail) {
      toast({
        title: "No changes",
        description: "Please enter a new email address.",
        variant: "default",
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      });
      
      if (error) throw error;
      
      toast({
        title: "Email update initiated",
        description: "Please check your new email address for a confirmation link.",
        variant: "default",
      });
      
      // Update the current email to show the pending state
      setCurrentEmail(newEmail);
      
    } catch (error: any) {
      console.error("Error updating email:", error);
      toast({
        title: "Update failed",
        description: error.message || "Failed to update email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Missing information",
        description: "Please fill in all password fields.",
        variant: "destructive",
      });
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Your new password and confirmation password do not match.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      const { error } = await supabase.auth.updateUser({ 
        password: newPassword
      });
      
      if (error) throw error;
      
      toast({
        title: "Password updated",
        description: "Your password has been successfully updated.",
        variant: "default",
      });
      
      // Clear password fields after successful update
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      
      // Refresh the session to ensure auth state is current
      await refreshSession();
      
    } catch (error: any) {
      console.error("Error updating password:", error);
      toast({
        title: "Update failed",
        description: error.message || "Failed to update password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="text-gray-400 mt-2">
            Manage your account settings and preferences
          </p>
        </div>
        
        <Tabs defaultValue="account" className="w-full">
          <TabsList className="bg-gray-800 text-gray-300 border border-gray-700">
            <TabsTrigger value="account" className="data-[state=active]:bg-gray-700">
              Account
            </TabsTrigger>
            <TabsTrigger value="subscription" className="data-[state=active]:bg-gray-700">
              Subscription
            </TabsTrigger>
            {userRole === 'global_administrator' && (
              <TabsTrigger value="users" className="data-[state=active]:bg-gray-700">
                User Management
              </TabsTrigger>
            )}
          </TabsList>
          
          <TabsContent value="account" className="space-y-6 mt-6">
            <Card className="bg-[#111936] border-[#2a2f4d] shadow-lg">
              <CardHeader>
                <CardTitle className="text-white">Email Settings</CardTitle>
                <CardDescription className="text-gray-400">
                  Update your email address
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateEmail} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-white">Current Email</Label>
                    <Input
                      id="email"
                      value={currentEmail}
                      disabled
                      className="bg-gray-700 text-white border-gray-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newEmail" className="text-white">New Email</Label>
                    <Input
                      id="newEmail"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      type="email"
                      placeholder="Enter new email address"
                      className="bg-gray-700 text-white border-gray-600"
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={isLoading || !newEmail || newEmail === currentEmail}
                    className="mt-4"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : "Update Email"}
                  </Button>
                </form>
              </CardContent>
            </Card>
            
            <Card className="bg-[#111936] border-[#2a2f4d] shadow-lg">
              <CardHeader>
                <CardTitle className="text-white">Password Settings</CardTitle>
                <CardDescription className="text-gray-400">
                  Change your password
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword" className="text-white">Current Password</Label>
                    <Input
                      id="currentPassword"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      type="password"
                      placeholder="Enter your current password"
                      className="bg-gray-700 text-white border-gray-600"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword" className="text-white">New Password</Label>
                    <Input
                      id="newPassword"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      type="password"
                      placeholder="Enter new password"
                      className="bg-gray-700 text-white border-gray-600"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-white">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      type="password"
                      placeholder="Confirm new password"
                      className="bg-gray-700 text-white border-gray-600"
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
                    className="mt-4"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : "Update Password"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="subscription">
            <SubscriptionSection />
          </TabsContent>
          
          {userRole === 'global_administrator' && (
            <TabsContent value="users">
              <UserManagementSection />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </Layout>
  );
};

export default SettingsPage;
