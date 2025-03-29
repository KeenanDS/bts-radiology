
import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

const UnauthorizedPage = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-md w-full p-8 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 shadow-xl text-center">
        <ShieldAlert className="h-16 w-16 text-red-500 mx-auto mb-6" />
        <h1 className="text-3xl font-bold mb-2">Access Denied</h1>
        <p className="text-gray-400 mb-6">
          You don't have permission to access this page. Please contact an administrator if you believe this is a mistake.
        </p>
        <div className="flex flex-col space-y-4">
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link to="/admin">Go to Dashboard</Link>
          </Button>
          <Button asChild variant="outline" className="border-white/10 hover:bg-white/5">
            <Link to="/">Return to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
