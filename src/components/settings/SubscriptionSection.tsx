
import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard, Calendar, AlertCircle, Check } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
  const { toast } = useToast();
  const { user } = useAuth();

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
        variant: 'destructive',
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

  const handleSubscribe = async () => {
    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          // Using the ProductID from Polar
          planId: '4b272a22-57b0-4824-9d27-882d7f7a639c',
        },
      });

      if (error) {
        throw error;
      }

      // Redirect to Polar checkout page
      window.location.href = data.url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast({
        title: 'Error',
        description: 'Failed to initiate checkout',
        variant: 'destructive',
      });
      setCheckoutLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    // Implement when needed
    toast({
      title: 'Coming Soon',
      description: 'Subscription cancellation will be available soon',
    });
  };

  const renderSubscriptionStatus = () => {
    if (!subscription) {
      return (
        <div className="p-6 text-center">
          <p className="text-gray-400 mb-6">You don't have an active subscription</p>
          <Button 
            onClick={handleSubscribe} 
            disabled={checkoutLoading}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {checkoutLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Subscribe Now
              </>
            )}
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center p-4 bg-white/5 rounded-md">
          <div>
            <h4 className="font-medium">Status</h4>
            <div className="flex items-center mt-1">
              {subscription.status === 'active' ? (
                <>
                  <span className="h-2 w-2 bg-green-500 rounded-full mr-2"></span>
                  <span className="text-green-500">Active</span>
                </>
              ) : subscription.status === 'past_due' ? (
                <>
                  <span className="h-2 w-2 bg-amber-500 rounded-full mr-2"></span>
                  <span className="text-amber-500">Past Due</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 bg-gray-500 rounded-full mr-2"></span>
                  <span className="text-gray-400">{subscription.status}</span>
                </>
              )}
            </div>
          </div>
          
          {subscription.status === 'active' && (
            <Button 
              variant="outline" 
              onClick={handleCancelSubscription}
              className="border-red-600/50 text-red-400 hover:bg-red-900/20 hover:text-red-300"
            >
              Cancel
            </Button>
          )}
        </div>

        {subscription.plan_id && (
          <div className="p-4 bg-white/5 rounded-md">
            <h4 className="font-medium">Plan</h4>
            <p className="text-gray-300 capitalize mt-1">
              {subscription.plan_id.replace(/-/g, ' ')}
            </p>
          </div>
        )}

        {subscription.current_period_end && (
          <div className="p-4 bg-white/5 rounded-md">
            <h4 className="font-medium">Current Period</h4>
            <div className="flex items-center mt-1 text-gray-300">
              <Calendar className="h-4 w-4 mr-2 text-gray-400" />
              Renews on {format(new Date(subscription.current_period_end), 'MMMM d, yyyy')}
            </div>
            {subscription.cancel_at_period_end && (
              <div className="flex items-center mt-2 text-amber-400">
                <AlertCircle className="h-4 w-4 mr-2" />
                Will not renew
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderPaymentMethods = () => {
    if (paymentMethods.length === 0) {
      return (
        <div className="p-6 text-center">
          <p className="text-gray-400 mb-2">No payment methods on file</p>
          <p className="text-sm text-gray-500">
            Payment methods will be added when you subscribe
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {paymentMethods.map((method) => (
          <div key={method.id} className="p-3 bg-white/5 rounded-md flex justify-between items-center">
            <div className="flex items-center">
              {method.card_brand && (
                <div className="w-10 h-7 bg-gray-700 rounded mr-3 flex items-center justify-center text-xs font-medium">
                  {method.card_brand.substring(0, 4)}
                </div>
              )}
              <div>
                <div className="font-medium">
                  •••• {method.card_last4 || '****'}
                </div>
                {method.card_exp_month && method.card_exp_year && (
                  <div className="text-xs text-gray-400">
                    Expires {method.card_exp_month.toString().padStart(2, '0')}/{method.card_exp_year}
                  </div>
                )}
              </div>
            </div>
            {method.is_default && (
              <div className="flex items-center text-xs bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded">
                <Check className="h-3 w-3 mr-1" />
                Default
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderInvoiceHistory = () => {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400">No invoice history available</p>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <Card className="bg-white/5 backdrop-blur-sm border-white/10">
      <CardHeader>
        <CardTitle>Billing & Subscription</CardTitle>
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
    </Card>
  );
};

export default SubscriptionSection;
