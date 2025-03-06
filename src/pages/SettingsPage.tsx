
import React from 'react';
import Sidebar from '@/components/admin/Sidebar';
import { Separator } from '@/components/ui/separator';

const SettingsPage = () => {
  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Settings</h1>
          
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Account Preferences</h2>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium">Email Notifications</h3>
                    <p className="text-sm text-gray-400">Receive email notifications for important updates</p>
                  </div>
                  <div className="h-6 w-11 bg-white/10 rounded-full p-1 cursor-pointer">
                    <div className="h-4 w-4 bg-white rounded-full transform translate-x-5"></div>
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
                  <div className="h-6 w-11 bg-white/10 rounded-full p-1 cursor-pointer">
                    <div className="h-4 w-4 bg-white rounded-full transform translate-x-5"></div>
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
                  <div className="h-6 w-11 bg-white/10 rounded-full p-1 cursor-pointer">
                    <div className="h-4 w-4 bg-white rounded-full transform translate-x-0"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Security</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Current Password</label>
                <input
                  type="password"
                  className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-2"
                  placeholder="••••••••"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">New Password</label>
                <input
                  type="password"
                  className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-2"
                  placeholder="••••••••"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-2"
                  placeholder="••••••••"
                />
              </div>
              
              <div className="pt-2">
                <button className="px-6 py-2 bg-blue-600 rounded-md hover:bg-blue-700 transition">
                  Update Password
                </button>
              </div>
            </div>
          </div>
          
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-400 mb-4">Danger Zone</h2>
            <p className="text-gray-400 mb-4">Permanently delete your account and all of your content.</p>
            <button className="px-6 py-2 bg-red-600/30 text-red-300 border border-red-600/50 rounded-md hover:bg-red-600/40 transition">
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
