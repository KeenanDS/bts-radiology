
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'administrator' | 'owner' | 'global_administrator';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredRole = 'administrator' 
}) => {
  const { user, userRole, isLoading } = useAuth();
  const location = useLocation();

  // While checking authentication status, show loading
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-white">Loading...</span>
      </div>
    );
  }

  // If not authenticated, redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user has the required role
  if (requiredRole === 'global_administrator' && userRole !== 'global_administrator') {
    return <Navigate to="/unauthorized" replace />;
  }

  if (requiredRole === 'owner' && userRole !== 'owner' && userRole !== 'global_administrator') {
    return <Navigate to="/unauthorized" replace />;
  }

  // All administrators, owners and global admins can access default admin routes
  return <>{children}</>;
};

export default ProtectedRoute;
