
import React from 'react';
import Sidebar from '@/components/admin/Sidebar';

const ProfilePage = () => {
  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Profile</h1>
          
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 mb-8">
            <div className="flex items-start gap-6">
              <div className="w-24 h-24 bg-blue-500 rounded-full overflow-hidden">
                <img 
                  src="https://i.pravatar.cc/100" 
                  alt="Profile" 
                  className="w-full h-full object-cover" 
                />
              </div>
              
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-1">Manu Arora</h2>
                <p className="text-gray-400 mb-4">manu@example.com</p>
                
                <div className="flex gap-3">
                  <button className="px-4 py-2 bg-blue-600 rounded-md hover:bg-blue-700 transition">
                    Update Photo
                  </button>
                  <button className="px-4 py-2 bg-white/10 rounded-md hover:bg-white/20 transition">
                    Remove
                  </button>
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
                  className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-2"
                  defaultValue="Manu Arora"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-2"
                  defaultValue="manu@example.com"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Bio</label>
                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-2 h-32"
                  defaultValue="Content creator and developer."
                />
              </div>
              
              <div className="pt-2">
                <button className="px-6 py-2 bg-blue-600 rounded-md hover:bg-blue-700 transition">
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
