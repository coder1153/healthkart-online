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
import { useRazorpay } from "@/hooks/useRazorpay";

const Checkout = () => {
  useRazorpay();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
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
  }, [navigate]);

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

    if (!userId || !cartItems || cartItems.length === 0) return;

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

      // Initialize Razorpay payment
      const options = {
        key: "rzp_test_YOUR_KEY_HERE", // Replace with your Razorpay key
        amount: Math.round(total * 100), // Amount in paise
        currency: "INR",
        name: "MediShop",
        description: `Order #${order.id.slice(0, 8)}`,
        order_id: order.id,
        handler: async (response: any) => {
          // Payment successful
          const { error: updateError } = await supabase
            .from("orders")
            .update({
              status: "paid",
              payment_status: "paid",
              payment_id: response.razorpay_payment_id,
            })
            .eq("id", order.id);

          if (updateError) throw updateError;

          // Clear cart
          await supabase.from("cart_items").delete().eq("user_id", userId);

          toast({
            title: "Payment successful!",
            description: "Your order has been placed.",
          });
          
          navigate("/order-history");
        },
        prefill: {
          name: formData.name,
          contact: formData.phone,
        },
        theme: {
          color: "#4F46E5",
        },
        modal: {
          ondismiss: async () => {
            // Payment cancelled - update order
            await supabase
              .from("orders")
              .update({ payment_status: "cancelled" })
              .eq("id", order.id);

            toast({
              title: "Payment cancelled",
              description: "Your order was not completed.",
              variant: "destructive",
            });
          },
        },
      };

      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar cartItemsCount={cartItems?.length || 0} />

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
                disabled={!cartItems || cartItems.length === 0}
              >
                Pay with UPI
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-4">
                Secure UPI payment via Razorpay
              </p>
            </Card>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Checkout;
