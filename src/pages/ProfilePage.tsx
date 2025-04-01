
import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/admin/Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { User, Upload, Loader } from 'lucide-react';

const ProfilePage = () => {
  const { user, refreshSession } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [profileData, setProfileData] = useState({
    full_name: '',
    email: '',
    bio: '',
    avatar_url: null as string | null
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, email, bio, avatar_url')
        .eq('id', user?.id)
        .single();
      
      if (error) throw error;
      
      setProfileData({
        full_name: data.full_name || '',
        email: data.email || '',
        bio: data.bio || '',
        avatar_url: data.avatar_url
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: 'Error fetching profile',
        description: 'Could not load your profile information',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveChanges = async () => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name,
          bio: profileData.bio
        })
        .eq('id', user?.id);
      
      if (error) throw error;
      
      toast({
        title: 'Profile updated',
        description: 'Your profile information has been updated successfully'
      });
      
      await refreshSession();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error updating profile',
        description: 'Could not update your profile information',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) {
        return;
      }
      
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `${fileName}`;
      
      setUploading(true);
      
      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('profile_images')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data } = supabase.storage
        .from('profile_images')
        .getPublicUrl(filePath);
      
      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: data.publicUrl })
        .eq('id', user?.id);
      
      if (updateError) throw updateError;
      
      // Update local state
      setProfileData(prev => ({
        ...prev,
        avatar_url: data.publicUrl
      }));
      
      toast({
        title: 'Avatar updated',
        description: 'Your profile picture has been updated successfully'
      });
      
      await refreshSession();
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: 'Error uploading avatar',
        description: 'Could not upload your profile picture',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      setLoading(true);
      
      // Update profile to remove avatar URL
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user?.id);
      
      if (error) throw error;
      
      // Update local state
      setProfileData(prev => ({
        ...prev,
        avatar_url: null
      }));
      
      toast({
        title: 'Avatar removed',
        description: 'Your profile picture has been removed'
      });
      
      await refreshSession();
    } catch (error) {
      console.error('Error removing avatar:', error);
      toast({
        title: 'Error removing avatar',
        description: 'Could not remove your profile picture',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Profile</h1>
          
          {loading && !uploading ? (
            <div className="flex justify-center py-10">
              <Loader className="animate-spin text-blue-500 size-8" />
            </div>
          ) : (
            <>
              <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 mb-8">
                <div className="flex items-start gap-6">
                  <div className="w-24 h-24 relative">
                    <Avatar className="w-24 h-24">
                      {profileData.avatar_url ? (
                        <AvatarImage src={profileData.avatar_url} alt="Profile" />
                      ) : (
                        <AvatarFallback className="bg-blue-600 text-white text-xl">
                          <User size={32} />
                        </AvatarFallback>
                      )}
                      {uploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                          <Loader className="animate-spin text-white" />
                        </div>
                      )}
                    </Avatar>
                  </div>
                  
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold mb-1">{profileData.full_name || 'Your Name'}</h2>
                    <p className="text-gray-400 mb-4">{profileData.email || 'your.email@example.com'}</p>
                    
                    <div className="flex gap-3">
                      <Button 
                        className="flex items-center gap-2" 
                        disabled={uploading}
                        onClick={() => document.getElementById('avatar-upload')?.click()}
                      >
                        <Upload size={16} />
                        Update Photo
                      </Button>
                      <input
                        type="file"
                        id="avatar-upload"
                        accept="image/*"
                        onChange={uploadAvatar}
                        className="hidden"
                      />
                      <Button 
                        variant="outline" 
                        className="text-white" 
                        onClick={handleRemoveAvatar}
                        disabled={uploading || !profileData.avatar_url}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Personal Information</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Full Name</label>
                    <input
                      type="text"
                      name="full_name"
                      className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-2"
                      value={profileData.full_name}
                      onChange={handleChange}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Email</label>
                    <input
                      type="email"
                      name="email"
                      className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-2"
                      value={profileData.email}
                      disabled
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Bio</label>
                    <textarea
                      name="bio"
                      className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-2 h-32"
                      value={profileData.bio}
                      onChange={handleChange}
                    />
                  </div>
                  
                  <div className="pt-2">
                    <Button 
                      className="px-6 py-2" 
                      onClick={handleSaveChanges}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader size={16} className="mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
