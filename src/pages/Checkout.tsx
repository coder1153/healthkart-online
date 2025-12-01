import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

// Load Shiprocket Checkout script
const loadShiprocketScript = () => {
  return new Promise((resolve, reject) => {
    if (document.getElementById('shiprocket-checkout-script')) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.id = 'shiprocket-checkout-script';
    script.src = 'https://checkout-ui.shiprocket.com/assets/js/channels/shopify.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Failed to load Shiprocket script'));
    document.body.appendChild(script);
  });
};

const Checkout = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
    pincode: "",
    city: "",
    state: "",
  });

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate("/auth");
        return;
      }
      setUserId(data.session.user.id);
    };
    checkUser();

    // Load Shiprocket script
    loadShiprocketScript()
      .then(() => {
        setScriptLoaded(true);
        console.log('Shiprocket script loaded successfully');
      })
      .catch((error) => {
        console.error('Error loading Shiprocket script:', error);
        toast({
          title: "Error",
          description: "Failed to load payment system",
          variant: "destructive",
        });
      });
  }, [navigate, toast]);

  const { data: cartItems } = useQuery({
    queryKey: ["cart", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("cart_items")
        .select(`
          *,
          products (*)
        `)
        .eq("user_id", userId);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const subtotal = cartItems?.reduce(
    (sum, item) => sum + (item.products ? Number(item.products.price) * item.quantity : 0),
    0
  ) || 0;
  const tax = subtotal * 0.05;
  const total = subtotal + tax;

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!scriptLoaded) {
      toast({
        title: "Error",
        description: "Payment system not ready. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    if (!userId || !cartItems || cartItems.length === 0) return;

    setIsProcessing(true);

    try {
      // Create order first
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: userId,
          total_amount: total,
          status: "pending",
          payment_status: "pending",
          delivery_name: formData.name,
          delivery_phone: formData.phone,
          delivery_address: formData.address,
          delivery_pincode: formData.pincode,
          delivery_city: formData.city,
          delivery_state: formData.state,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = cartItems.map((item) => ({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.products.name,
        product_price: item.products.price,
        quantity: item.quantity,
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) throw itemsError;

      // Prepare cart items for Shiprocket
      const shiprocketCartItems = cartItems.map((item) => ({
        variant_id: item.products.id,
        quantity: item.quantity,
      }));

      // Get redirect URL
      const redirectUrl = `${window.location.origin}/order-history?order_id=${order.id}`;

      // Generate checkout token
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke(
        'shiprocket-create-session',
        {
          body: {
            cartItems: shiprocketCartItems,
            redirectUrl,
          },
        }
      );

      if (tokenError) throw tokenError;

      if (!tokenData.token) {
        throw new Error('No checkout token received');
      }

      console.log('Checkout token generated:', tokenData);

      // Store order ID for webhook processing
      await supabase
        .from('orders')
        .update({ payment_id: tokenData.order_id })
        .eq('id', order.id);

      // Handle test mode vs production mode
      if (tokenData.test_mode) {
        toast({
          title: "Test Mode Active",
          description: "You'll be redirected to a test payment page.",
        });

        // Redirect to test payment page
        const testPaymentUrl = `${window.location.origin}/functions/v1/shiprocket-test-payment?session_id=${tokenData.token}&order_id=${tokenData.order_id}&amount=${total.toFixed(2)}`;
        window.location.href = testPaymentUrl;
      } else {
        // Production mode: Trigger Shiprocket Checkout iframe
        // @ts-ignore - HeadlessCheckout is loaded from external script
        if (window.HeadlessCheckout) {
          const fallbackUrl = `${window.location.origin}/order-history?order_id=${order.id}`;
          // @ts-ignore
          window.HeadlessCheckout.addToCart(e, tokenData.token, { fallbackUrl });
        } else {
          throw new Error('Shiprocket Checkout not loaded');
        }
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      
      let errorMessage = error.message || "Failed to initiate payment";
      
      // Check if it's a Shiprocket catalog sync error
      if (errorMessage.includes('Shiprocket')) {
        errorMessage = "Products need to be synced with Shiprocket first. Please contact support.";
      }
      
      toast({
        title: "Payment Failed",
        description: errorMessage,
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar cartItemsCount={cartItems?.length || 0} />
      <input type="hidden" value={window.location.hostname} id="sellerDomain" />

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Checkout</h1>

        <form onSubmit={handlePayment} className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">Delivery Information</h2>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address *</Label>
                  <Input
                    id="address"
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pincode">Pincode *</Label>
                    <Input
                      id="pincode"
                      required
                      value={formData.pincode}
                      onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      required
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State *</Label>
                  <Input
                    id="state"
                    required
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  />
                </div>
              </div>
            </Card>
          </div>

          <div>
            <Card className="p-6 sticky top-20">
              <h2 className="text-xl font-bold mb-4">Order Summary</h2>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax (5%)</span>
                  <span className="font-medium">₹{tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="font-medium">Free</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-primary">₹{total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-primary to-secondary"
                disabled={!cartItems || cartItems.length === 0 || isProcessing || !scriptLoaded}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Checkout with Shiprocket"
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-4">
                Secure payment via Shiprocket Checkout
              </p>
            </Card>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Checkout;
