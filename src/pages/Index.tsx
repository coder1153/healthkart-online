import { Navbar } from "@/components/Navbar";
import { CategoryCard } from "@/components/CategoryCard";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Pill, Activity, Heart, Thermometer, Stethoscope, Syringe } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cartCount, setCartCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      setUserId(data.session?.user?.id || null);
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const { data: cartItems } = useQuery({
    queryKey: ["cart", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("cart_items")
        .select("*")
        .eq("user_id", userId);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  useEffect(() => {
    setCartCount(cartItems?.length || 0);
  }, [cartItems]);

  const { data: featuredProducts } = useQuery({
    queryKey: ["featured-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_featured", true)
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  const categories = [
    { name: "Medicines", icon: Pill, description: "Prescription & OTC drugs" },
    { name: "Health Devices", icon: Activity, description: "Monitors & equipment" },
    { name: "Wellness", icon: Heart, description: "Vitamins & supplements" },
    { name: "Diagnostic", icon: Thermometer, description: "Health test kits" },
    { name: "Equipment", icon: Stethoscope, description: "Medical instruments" },
    { name: "Immunity", icon: Syringe, description: "Boosters & vaccines" },
  ];

  const handleAddToCart = async (productId: string) => {
    if (!userId) {
      toast({
        title: "Login required",
        description: "Please login to add items to cart",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    try {
      const { error } = await supabase.from("cart_items").upsert(
        {
          user_id: userId,
          product_id: productId,
          quantity: 1,
        },
        { onConflict: "user_id,product_id" }
      );

      if (error) throw error;

      toast({
        title: "Added to cart",
        description: "Product has been added to your cart",
      });
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
      <Navbar cartItemsCount={cartCount} />

      {/* Hero Section */}
      <section
        className="relative py-20 md:py-32 overflow-hidden"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center text-white">
            <p className="text-lg md:text-xl mb-4 text-white/90 italic font-medium animate-fade-in">
              "Gentle. Pure. Trusted."
            </p>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
              Care that feels personal. Quality that feels right.
            </h1>
            <p className="text-lg md:text-xl mb-8 text-white/90 animate-fade-in" style={{ animationDelay: "0.2s" }}>
              Welcome to Peony Life Sciences' online store, your trusted destination for safe, quality-assured pharmaceutical and wellness products. Every item listed here is carefully sourced, scientifically backed, and manufactured with strict quality standards to ensure your complete peace of mind.
            </p>
            <div className="flex gap-4 justify-center">
              <Button
                size="lg"
                variant="secondary"
                onClick={() => navigate("/products")}
                className="shadow-lg animate-fade-in"
                style={{ animationDelay: "0.3s" }}
              >
                Shop Our Products
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Quality You Can Trust
            </h2>
            <p className="text-lg text-muted-foreground mb-4">
              From essential medicines to healthy formulations and wellness solutions, each product reflects our commitment to purity, safety, and effectiveness.
            </p>
            <p className="text-lg text-muted-foreground">
              We believe healthcare should be simple, reliable, and accessible, and our shop is designed to deliver exactly that.
            </p>
          </div>

          <div className="text-center">
            <h3 className="text-2xl md:text-3xl font-bold mb-4">
              Choose What You Need, With Confidence
            </h3>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto mb-8">
              Explore our wide range of products tailored to support better health for you and your family. Whether you're looking for daily wellness support, preventive solutions, or specialized formulations, we bring you trusted care at the best value.
            </p>
          </div>
        </div>
      </section>

      {/* Why Shop With Us Section */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Why Shop With Us?</h2>
          <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-6 max-w-6xl mx-auto">
            <div className="text-center p-6 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl">✔</span>
                </div>
              </div>
              <h3 className="font-semibold mb-2">Certified & Quality-Tested</h3>
              <p className="text-sm text-muted-foreground">Products you can trust</p>
            </div>
            <div className="text-center p-6 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl">✔</span>
                </div>
              </div>
              <h3 className="font-semibold mb-2">Easy Browsing</h3>
              <p className="text-sm text-muted-foreground">Fast checkout process</p>
            </div>
            <div className="text-center p-6 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl">✔</span>
                </div>
              </div>
              <h3 className="font-semibold mb-2">Transparent Details</h3>
              <p className="text-sm text-muted-foreground">Clear benefits & info</p>
            </div>
            <div className="text-center p-6 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl">✔</span>
                </div>
              </div>
              <h3 className="font-semibold mb-2">Trusted by Professionals</h3>
              <p className="text-sm text-muted-foreground">Clinic & expert approved</p>
            </div>
            <div className="text-center p-6 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl">✔</span>
                </div>
              </div>
              <h3 className="font-semibold mb-2">Dedicated Support</h3>
              <p className="text-sm text-muted-foreground">For your wellness needs</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Premium Care, Delivered to You</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Discover our carefully curated selection of premium healthcare products
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredProducts?.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                name={product.name}
                description={product.description || ""}
                price={Number(product.price)}
                image_url={product.image_url || undefined}
                rating={Number(product.rating)}
                stock={product.stock}
                onAddToCart={() => handleAddToCart(product.id)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative bg-gradient-to-br from-primary via-primary/95 to-primary/85 text-primary-foreground overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-64 h-64 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-80 h-80 bg-white rounded-full blur-3xl" />
        </div>
        
        <div className="relative container mx-auto px-4 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
            {/* Brand Section */}
            <div className="lg:col-span-1">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <span className="text-white font-bold text-xl">P</span>
                </div>
                <div>
                  <h3 className="font-bold text-xl text-white">Peony LifeStore</h3>
                  <p className="text-white/70 text-sm">Gentle. Pure. Trusted.</p>
                </div>
              </div>
              <p className="text-white/80 text-sm leading-relaxed">
                Leading pharmaceutical innovation with world-class quality standards, delivering life-saving medicines to patients globally.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-semibold text-lg mb-6 text-white">Quick Links</h4>
              <ul className="space-y-3">
                <li>
                  <a
                    href="https://peonylifesciences.com/about"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/80 hover:text-white transition-colors flex items-center gap-2 group"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white/50 group-hover:bg-white transition-colors" />
                    About Us
                  </a>
                </li>
                <li>
                  <a
                    href="/products"
                    className="text-white/80 hover:text-white transition-colors flex items-center gap-2 group"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white/50 group-hover:bg-white transition-colors" />
                    Products
                  </a>
                </li>
                <li>
                  <a
                    href="https://peonylifesciences.com/contact"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/80 hover:text-white transition-colors flex items-center gap-2 group"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white/50 group-hover:bg-white transition-colors" />
                    Contact
                  </a>
                </li>
                <li>
                  <a
                    href="https://terms.peonylifesciences.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/80 hover:text-white transition-colors flex items-center gap-2 group"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white/50 group-hover:bg-white transition-colors" />
                    Privacy Policy
                  </a>
                </li>
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h4 className="font-semibold text-lg mb-6 text-white">Contact Us</h4>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs uppercase tracking-wider mb-1">Email</p>
                    <a href="mailto:support@peonylifesciences.com" className="text-white/90 hover:text-white transition-colors text-sm">
                      support@peonylifesciences.com
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs uppercase tracking-wider mb-1">Phone</p>
                    <a href="tel:+917010966990" className="text-white/90 hover:text-white transition-colors text-sm">
                      +91 70109 66990
                    </a>
                  </div>
                </li>
              </ul>
            </div>

            {/* Newsletter / CTA */}
            <div>
              <h4 className="font-semibold text-lg mb-6 text-white">Stay Connected</h4>
              <p className="text-white/80 text-sm mb-4">
                Get updates on new products and special offers.
              </p>
              <Button 
                variant="secondary" 
                className="w-full bg-white text-primary hover:bg-white/90 font-semibold"
                onClick={() => navigate("/products")}
              >
                Explore Products
              </Button>
              
              {/* Social Icons */}
              <div className="flex gap-3 mt-6">
                <a 
                  href="https://peonylifesciences.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.164 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-12 pt-8 border-t border-white/20">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-white/70 text-sm">
                © {new Date().getFullYear()} Peony Life Sciences. All rights reserved.
              </p>
              <div className="flex items-center gap-6">
                <a 
                  href="https://peonylifesciences.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-white/70 hover:text-white text-sm transition-colors"
                >
                  peonylifesciences.com
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
