import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard, Calendar, AlertCircle, Check, Shield, Star } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';

interface Subscription {
  id: string;
  status: string;
  plan_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

interface PaymentMethod {
  id: string;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  is_default: boolean;
}

const SubscriptionSection = () => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [processingReturn, setProcessingReturn] = useState(false);
  const [pollingActive, setPollingActive] = useState(false);
  const { toast } = useToast();
  const { user, isOwner, isGlobalAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Check if user can access this component
  const canAccessBilling = isOwner || isGlobalAdmin;

  // Redirect or show unauthorized message if not allowed
  if (!canAccessBilling) {
    return null;
  }

  const STRIPE_PRICE_ID = 'price_1R9GKuLNqUBmFOXgS7n0kZBU';

  const fetchSubscriptionData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-subscription');
      if (error) {
        throw error;
      }
      setSubscription(data.subscription);
      setPaymentMethods(data.paymentMethods);
    } catch (error) {
      console.error('Error fetching subscription data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load subscription information',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSubscriptionData();
    }
  }, [user]);

  // Set up polling for subscription status when needed
  useEffect(() => {
    let pollInterval: number | null = null;
    
    if (pollingActive && user) {
      // Poll every 5 seconds
      pollInterval = window.setInterval(() => {
        console.log('Polling for subscription updates...');
        fetchSubscriptionData().then(() => {
          // If subscription is found, stop polling
          if (subscription && subscription.status === 'active') {
            console.log('Active subscription found, stopping polling');
            setPollingActive(false);
          }
        });
      }, 5000);
    }
    
    return () => {
      if (pollInterval) {
        window.clearInterval(pollInterval);
      }
    };
  }, [pollingActive, user, subscription]);

  // Handle URL parameters when returning from Stripe
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const checkoutStatus = searchParams.get('checkout');
    const sessionId = searchParams.get('session_id');
    
    if (checkoutStatus) {
      setProcessingReturn(true);
      
      // Clear URL parameters but keep the path
      if (window.history && window.history.replaceState) {
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
      
      if (checkoutStatus === 'success') {
        toast({
          title: 'Success',
          description: 'Your subscription has been activated!',
          variant: 'default'
        });
        fetchSubscriptionData().then(() => setProcessingReturn(false));
      } else if (checkoutStatus === 'canceled') {
        toast({
          title: 'Checkout canceled',
          description: 'You have canceled the subscription process',
          variant: 'default'
        });
        setProcessingReturn(false);
      }
    }
  }, [location]);

  const handleSubscribe = async () => {
    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          priceId: STRIPE_PRICE_ID,
          successUrl: `${window.location.origin}/admin/settings?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/admin/settings?checkout=canceled`
        }
      });
      
      if (error) {
        throw error;
      }
      
      if (!data.url) {
        throw new Error('No checkout URL returned');
      }
      
      // Store auth state before redirecting
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        localStorage.setItem('stripe_checkout_redirect', 'true');
      }
      
      // Open checkout in a new tab
      window.open(data.url, '_blank');
      
      // Start polling for subscription updates
      setPollingActive(true);
      
      // Reset loading state
      setCheckoutLoading(false);
      
      toast({
        title: 'Checkout opened in new tab',
        description: 'Complete your subscription in the new tab. This page will update automatically.',
        variant: 'default'
      });
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast({
        title: 'Error',
        description: 'Failed to initiate checkout',
        variant: 'destructive'
      });
      setCheckoutLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    toast({
      title: 'Coming Soon',
      description: 'Subscription cancellation will be available soon'
    });
  };

  const renderSubscriptionStatus = () => {
    if (!subscription) {
      return <div className="space-y-6">
          <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-lg p-6 border border-blue-500/20">
            <div className="flex items-start space-x-4">
              <div className="bg-blue-500/20 p-3 rounded-full">
                <Star className="h-6 w-6 text-blue-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-white">API and Operations Cost</h3>
                <ul className="space-y-1">
                  <li className="flex items-center text-gray-300">
                    <Check className="h-4 w-4 text-blue-400 mr-2" /> 
                    Content generation
                  </li>
                  <li className="flex items-center text-gray-300">
                    <Check className="h-4 w-4 text-blue-400 mr-2" /> 
                    Fact checking
                  </li>
                  <li className="flex items-center text-gray-300">
                    <Check className="h-4 w-4 text-blue-400 mr-2" /> 
                    Podcast generation
                  </li>
                  <li className="flex items-center text-gray-300">
                    <Check className="h-4 w-4 text-blue-400 mr-2" /> 
                    Domain ownership
                  </li>
                  <li className="flex items-center text-gray-300">
                    <Shield className="h-4 w-4 text-blue-400 mr-2" /> 
                    SSL security
                  </li>
                </ul>
                <div className="pt-2">
                  <Button onClick={handleSubscribe} disabled={checkoutLoading || pollingActive} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 w-full">
                    {checkoutLoading ? <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing
                      </> : pollingActive ? <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Waiting for checkout...
                      </> : <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Subscribe Now
                      </>}
                  </Button>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Secure payment processing through Stripe. Cancel anytime.
                </p>
              </div>
            </div>
          </div>
        </div>;
    }
    return <div className="space-y-4">
        <div className="flex justify-between items-center p-4 bg-white/5 rounded-md">
          <div>
            <h4 className="font-medium">Status</h4>
            <div className="flex items-center mt-1">
              {subscription.status === 'active' ? <>
                  <span className="h-2 w-2 bg-green-500 rounded-full mr-2"></span>
                  <span className="text-green-500">Active</span>
                </> : subscription.status === 'past_due' ? <>
                  <span className="h-2 w-2 bg-amber-500 rounded-full mr-2"></span>
                  <span className="text-amber-500">Past Due</span>
                </> : <>
                  <span className="h-2 w-2 bg-gray-500 rounded-full mr-2"></span>
                  <span className="text-gray-400">{subscription.status}</span>
                </>}
            </div>
          </div>
          
          {subscription.status === 'active' && <Button variant="outline" onClick={handleCancelSubscription} className="border-red-600/50 text-red-400 hover:bg-red-900/20 hover:text-red-300">
              Cancel
            </Button>}
        </div>

        {subscription.plan_id && <div className="p-4 bg-white/5 rounded-md">
            <h4 className="font-medium">Plan</h4>
            <p className="text-gray-300 capitalize mt-1">
              Premium
            </p>
          </div>}

        {subscription.current_period_end && <div className="p-4 bg-white/5 rounded-md">
            <h4 className="font-medium">Current Period</h4>
            <div className="flex items-center mt-1 text-gray-300">
              <Calendar className="h-4 w-4 mr-2 text-gray-400" />
              Renews on {format(new Date(subscription.current_period_end), 'MMMM d, yyyy')}
            </div>
            {subscription.cancel_at_period_end && <div className="flex items-center mt-2 text-amber-400">
                <AlertCircle className="h-4 w-4 mr-2" />
                Will not renew
              </div>}
          </div>}
      </div>;
  };

  const renderPaymentMethods = () => {
    if (paymentMethods.length === 0) {
      return <div className="p-6 text-center">
          <p className="text-gray-400 mb-2">No payment methods on file</p>
          <p className="text-sm text-gray-500">
            Payment methods will be added when you subscribe
          </p>
        </div>;
    }
    return <div className="space-y-3">
        {paymentMethods.map(method => <div key={method.id} className="p-3 bg-white/5 rounded-md flex justify-between items-center">
            <div className="flex items-center">
              {method.card_brand && <div className="w-10 h-7 bg-gray-700 rounded mr-3 flex items-center justify-center text-xs font-medium">
                  {method.card_brand.substring(0, 4)}
                </div>}
              <div>
                <div className="font-medium">
                  •••• {method.card_last4 || '****'}
                </div>
                {method.card_exp_month && method.card_exp_year && <div className="text-xs text-gray-400">
                    Expires {method.card_exp_month.toString().padStart(2, '0')}/{method.card_exp_year}
                  </div>}
              </div>
            </div>
            {method.is_default && <div className="flex items-center text-xs bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded">
                <Check className="h-3 w-3 mr-1" />
                Default
              </div>}
          </div>)}
      </div>;
  };

  const renderInvoiceHistory = () => {
    return <div className="p-6 text-center">
        <p className="text-gray-400">No invoice history available</p>
      </div>;
  };

  if (loading || processingReturn) {
    return <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <p className="ml-2 text-gray-300">
          {processingReturn ? 'Processing checkout result...' : 'Loading subscription data...'}
        </p>
      </div>;
  }

  return <Card className="bg-white/5 backdrop-blur-sm border-white/10">
      <CardHeader>
        <CardTitle className="text-slate-50">Billing & Subscription</CardTitle>
        <CardDescription>Manage your subscription and payment methods</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="subscription" className="w-full">
          <TabsList className="w-full bg-white/5">
            <TabsTrigger value="subscription" className="flex-1">Subscription</TabsTrigger>
            <TabsTrigger value="payment" className="flex-1">Payment Methods</TabsTrigger>
            <TabsTrigger value="history" className="flex-1">Billing History</TabsTrigger>
          </TabsList>
          <TabsContent value="subscription" className="mt-4">
            {renderSubscriptionStatus()}
          </TabsContent>
          <TabsContent value="payment" className="mt-4">
            {renderPaymentMethods()}
          </TabsContent>
          <TabsContent value="history" className="mt-4">
            {renderInvoiceHistory()}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>;
};

export default SubscriptionSection;
