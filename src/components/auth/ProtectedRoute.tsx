
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'administrator' | 'owner' | 'global_administrator';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredRole = 'administrator' 
}) => {
  const { user, userRole, isLoading, signIn } = useAuth();
  const [isRecovering, setIsRecovering] = useState(false);
  const location = useLocation();

  // Check if we're returning from Stripe checkout
  useEffect(() => {
    const checkStripeReturn = async () => {
      const stripeRedirect = localStorage.getItem('stripe_checkout_redirect');
      const checkoutStatus = new URLSearchParams(location.search).get('checkout');
      
      if ((stripeRedirect === 'true' || checkoutStatus) && !user) {
        console.log('Attempting to recover session after Stripe checkout, status:', checkoutStatus);
        setIsRecovering(true);
        
        // Try to refresh the session
        const { data, error } = await supabase.auth.getSession();
        
        if (data.session) {
          console.log('Session recovered successfully');
        } else {
          console.error('Failed to recover session:', error);
        }
        
        // Clear the redirect flag
        localStorage.removeItem('stripe_checkout_redirect');
        setIsRecovering(false);
      }
    };
    
    checkStripeReturn();
  }, [user, location.pathname, location.search]);

  // While checking authentication status or recovering session, show loading
  if (isLoading || isRecovering) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-white">
          {isRecovering ? 'Recovering session...' : 'Loading...'}
        </span>
      </div>
    );
  }

  // If not authenticated, redirect to login
  if (!user) {
    return <Navigate to="/admin-login" state={{ from: location }} replace />;
  }

  // Check if user has the required role
  if (requiredRole === 'global_administrator' && userRole !== 'global_administrator') {
    return <Navigate to="/unauthorized" replace />;
  }

  if (requiredRole === 'owner' && userRole !== 'owner' && userRole !== 'global_administrator') {
    return <Navigate to="/unauthorized" replace />;
  }

  // Check for return from checkout and clean up URL if needed
  const checkoutStatus = new URLSearchParams(location.search).get('checkout');
  if (checkoutStatus && location.pathname === '/admin/settings') {
    // We're already on the correct page, just need to clean the URL
    window.history.replaceState({}, document.title, '/admin/settings');
  }

  // All administrators, owners and global admins can access default admin routes
  return <>{children}</>;
};

export default ProtectedRoute;
