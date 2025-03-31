
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Home, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const [isRecovering, setIsRecovering] = useState(false);

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
      "Search params:",
      location.search
    );

    // Check if we're returning from Stripe checkout
    const checkoutStatus = new URLSearchParams(location.search).get('checkout');
    const stripePageDetected = 
      location.pathname.includes('checkout') || 
      location.pathname.includes('stripe') ||
      checkoutStatus;
    
    if (stripePageDetected) {
      console.log("Detected potential return from Stripe:", location.pathname, location.search);
      
      // Attempt to recover the session and redirect
      setIsRecovering(true);
      
      // Try to recover the session
      const recoverSession = async () => {
        try {
          const { data, error } = await supabase.auth.getSession();
          
          if (data?.session) {
            console.log("Successfully recovered session, redirecting to admin settings");
            localStorage.removeItem('stripe_checkout_redirect');
            
            // Use timeout to ensure state is updated
            setTimeout(() => {
              // Redirect to settings page but with clean URL
              navigate('/admin/settings', { replace: true });
            }, 100);
          } else {
            console.error("Failed to recover session:", error);
            setIsRecovering(false);
          }
        } catch (err) {
          console.error("Error recovering session:", err);
          setIsRecovering(false);
        }
      };
      
      recoverSession();
    }
  }, [location, navigate]);

  if (isLoading || isRecovering) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
        <p className="text-xl">Restoring your session...</p>
        <p className="text-gray-400 mt-2">Please wait while we get things back on track</p>
      </div>
    );
  }

  const goBack = () => {
    navigate(-1);
  };

  const goHome = () => {
    navigate(user ? '/admin' : '/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center p-8 rounded-lg bg-gray-800 shadow-xl max-w-md">
        <h1 className="text-6xl font-bold mb-6 text-red-500">404</h1>
        <p className="text-2xl text-white mb-6">Oops! Page not found</p>
        <p className="mb-6 text-gray-300">
          The page you're looking for doesn't exist or may have been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            variant="outline" 
            onClick={goBack}
            className="flex items-center justify-center"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
          <Button 
            onClick={goHome}
            className="flex items-center justify-center bg-blue-600 hover:bg-blue-700"
          >
            <Home className="mr-2 h-4 w-4" />
            Go to {user ? 'Dashboard' : 'Home'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
