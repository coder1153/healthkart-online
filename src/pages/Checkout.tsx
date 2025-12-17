import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Navbar } from "@/components/Navbar";
import { Loader2, CheckCircle2, Truck, CreditCard, Package, MapPin } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface CourierOption {
  courier_id: string;
  courier_name: string;
  rate: number;
  estimated_days: number;
  cod_available: boolean;
  rating: number;
}

type CheckoutStep = 'address' | 'shipping' | 'payment' | 'confirmation';

const Checkout = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [userId, setUserId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('address');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    pincode: '',
    city: '',
    state: '',
  });
  
  // Shipping state
  const [couriers, setCouriers] = useState<CourierOption[]>([]);
  const [selectedCourier, setSelectedCourier] = useState<CourierOption | null>(null);
  const [isCheckingServiceability, setIsCheckingServiceability] = useState(false);
  const [serviceabilityError, setServiceabilityError] = useState<string | null>(null);
  
  // Order state
  const [orderId, setOrderId] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }
      setUserId(session.user.id);
      
      // Pre-fill email
      if (session.user.email) {
        setFormData(prev => ({ ...prev, email: session.user.email || '' }));
      }
    };
    
    checkAuth();
  }, [navigate]);

  // Fetch cart items
  const { data: cartItems, isLoading: cartLoading } = useQuery({
    queryKey: ['cart', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cart_items')
        .select('*, products(*)')
        .eq('user_id', userId);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const validCartItems = cartItems?.filter(item => item.products) || [];
  const subtotal = validCartItems.reduce((sum, item) => sum + (item.products?.price || 0) * item.quantity, 0);
  const shippingCost = selectedCourier?.rate || 0;
  const tax = subtotal * 0.18;
  const total = subtotal + tax + shippingCost;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // Step 1: Check serviceability when pincode changes
  const checkServiceability = async () => {
    if (formData.pincode.length !== 6) {
      setServiceabilityError('Please enter a valid 6-digit pincode');
      return;
    }

    setIsCheckingServiceability(true);
    setServiceabilityError(null);
    setCouriers([]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('shiprocket-check-serviceability', {
        body: {
          pickup_pincode: '110001', // Your warehouse pincode
          delivery_pincode: formData.pincode,
          weight: 0.5,
          cod: false,
        },
      });

      if (response.error) throw response.error;

      const data = response.data;
      if (data.serviceable && data.couriers?.length > 0) {
        setCouriers(data.couriers);
        setCurrentStep('shipping');
      } else {
        setServiceabilityError('Sorry, delivery is not available at this pincode');
      }
    } catch (error) {
      console.error('Serviceability check error:', error);
      setServiceabilityError('Unable to check delivery availability. Please try again.');
    } finally {
      setIsCheckingServiceability(false);
    }
  };

  // Step 2: Proceed to payment
  const proceedToPayment = () => {
    if (!selectedCourier) {
      toast({ title: "Please select a delivery option", variant: "destructive" });
      return;
    }
    setCurrentStep('payment');
  };

  // Step 3: Process payment - PhonePe integration placeholder
  const handlePayment = async () => {
    if (validCartItems.length === 0) {
      toast({ title: "Your cart is empty", variant: "destructive" });
      return;
    }

    setIsProcessing(true);

    try {
      // TODO: PhonePe payment integration will be added here
      toast({
        title: "Payment Integration Pending",
        description: "PhonePe payment integration coming soon.",
        variant: "destructive",
      });
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: "Payment Error",
        description: error instanceof Error ? error.message : "Failed to initiate payment",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (cartLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            {[
              { step: 'address', label: 'Address', icon: MapPin },
              { step: 'shipping', label: 'Shipping', icon: Truck },
              { step: 'payment', label: 'Payment', icon: CreditCard },
              { step: 'confirmation', label: 'Done', icon: CheckCircle2 },
            ].map((s, i) => (
              <div key={s.step} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                  currentStep === s.step ? 'bg-primary text-primary-foreground' :
                  ['address', 'shipping', 'payment', 'confirmation'].indexOf(currentStep) > i 
                    ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                }`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <span className="ml-2 text-sm font-medium hidden sm:block">{s.label}</span>
                {i < 3 && <div className="w-8 h-0.5 bg-muted mx-2" />}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Address Form */}
        {currentStep === 'address' && (
          <div className="bg-card rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Delivery Address
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Full Name *</Label>
                <Input id="name" name="name" value={formData.name} onChange={handleInputChange} required />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number *</Label>
                <Input id="phone" name="phone" value={formData.phone} onChange={handleInputChange} required />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} required />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="address">Address *</Label>
                <Input id="address" name="address" value={formData.address} onChange={handleInputChange} required />
              </div>
              <div>
                <Label htmlFor="pincode">Pincode *</Label>
                <Input id="pincode" name="pincode" value={formData.pincode} onChange={handleInputChange} maxLength={6} required />
              </div>
              <div>
                <Label htmlFor="city">City *</Label>
                <Input id="city" name="city" value={formData.city} onChange={handleInputChange} required />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="state">State *</Label>
                <Input id="state" name="state" value={formData.state} onChange={handleInputChange} required />
              </div>
            </div>

            {serviceabilityError && (
              <p className="text-destructive text-sm mt-4">{serviceabilityError}</p>
            )}

            <Button 
              onClick={checkServiceability} 
              className="w-full mt-6"
              disabled={!formData.name || !formData.phone || !formData.address || !formData.pincode || !formData.city || !formData.state || isCheckingServiceability}
            >
              {isCheckingServiceability ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking Delivery...</>
              ) : (
                'Check Delivery & Continue'
              )}
            </Button>
          </div>
        )}

        {/* Step 2: Shipping Options */}
        {currentStep === 'shipping' && (
          <div className="bg-card rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Select Delivery Option
            </h2>
            
            <RadioGroup value={selectedCourier?.courier_id} onValueChange={(value) => {
              const courier = couriers.find(c => c.courier_id === value);
              setSelectedCourier(courier || null);
            }}>
              <div className="space-y-3">
                {couriers.map((courier) => (
                  <div 
                    key={courier.courier_id}
                    className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedCourier?.courier_id === courier.courier_id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedCourier(courier)}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value={courier.courier_id} id={courier.courier_id} />
                      <div>
                        <p className="font-medium">{courier.courier_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Estimated delivery: {courier.estimated_days} days
                        </p>
                      </div>
                    </div>
                    <span className="font-semibold text-primary">₹{courier.rate.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </RadioGroup>

            <div className="flex gap-4 mt-6">
              <Button variant="outline" onClick={() => setCurrentStep('address')}>Back</Button>
              <Button onClick={proceedToPayment} className="flex-1" disabled={!selectedCourier}>
                Continue to Payment
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Payment */}
        {currentStep === 'payment' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Order Summary */}
            <div className="bg-card rounded-lg p-6 shadow-sm">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Order Summary
              </h2>
              <div className="space-y-3 mb-4">
                {validCartItems.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>{item.products?.name} × {item.quantity}</span>
                    <span>₹{((item.products?.price || 0) * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax (18%)</span>
                  <span>₹{tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Shipping ({selectedCourier?.courier_name})</span>
                  <span>₹{shippingCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg border-t pt-2">
                  <span>Total</span>
                  <span className="text-primary">₹{total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Delivery Info & Payment */}
            <div className="bg-card rounded-lg p-6 shadow-sm">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Payment
              </h2>
              
              <div className="mb-6 p-4 bg-muted/50 rounded-lg">
                <h3 className="font-medium mb-2">Delivery Address</h3>
                <p className="text-sm text-muted-foreground">
                  {formData.name}<br />
                  {formData.address}<br />
                  {formData.city}, {formData.state} - {formData.pincode}<br />
                  Phone: {formData.phone}
                </p>
              </div>

              <div className="space-y-4">
                <Button variant="outline" onClick={() => setCurrentStep('shipping')} className="w-full">
                  Back to Shipping
                </Button>
                <Button 
                  onClick={handlePayment} 
                  className="w-full"
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                  ) : (
                    `Pay ₹${total.toFixed(2)}`
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {currentStep === 'confirmation' && (
          <div className="bg-card rounded-lg p-8 shadow-sm text-center">
            <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Order Confirmed!</h2>
            <p className="text-muted-foreground mb-6">
              Thank you for your order. We'll send you a confirmation email shortly.
            </p>
            
            <div className="bg-muted/50 rounded-lg p-4 mb-6 text-left max-w-md mx-auto">
              <p className="text-sm"><strong>Order ID:</strong> {orderId}</p>
              {paymentId && <p className="text-sm"><strong>Payment ID:</strong> {paymentId}</p>}
              <p className="text-sm"><strong>Total Paid:</strong> ₹{total.toFixed(2)}</p>
              <p className="text-sm"><strong>Shipping:</strong> {selectedCourier?.courier_name}</p>
              <p className="text-sm"><strong>Estimated Delivery:</strong> {selectedCourier?.estimated_days} days</p>
            </div>

            <div className="flex gap-4 justify-center">
              <Button variant="outline" onClick={() => navigate('/order-history')}>
                View Orders
              </Button>
              <Button onClick={() => navigate('/products')}>
                Continue Shopping
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Checkout;
