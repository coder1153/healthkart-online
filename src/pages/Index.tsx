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
      <footer className="bg-card border-t py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-bold text-lg mb-4">
                <a
                  href="https://peonylifesciences.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors">Peony Life Sciences</a>
              </h3>
              <p className="text-sm text-muted-foreground">
                Leading pharmaceutical innovation with world-class quality standards, delivering life-saving medicines to patients globally through cutting-edge research and manufacturing excellence.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a
                  href="https://peonylifesciences.com/about"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors">About Us</a></li>

                <li> <a
                  href="https://peonylifesciences.com/contact"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >Contact</a></li>
                <li>
                  <a
                    href="https://terms.peonylifesciences.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground transition-colors"
                  >
                    Privacy Policy
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Email: support@peonylifesciences.com
                </li>
                <li>Phone: +91 70109 66990</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            © 2024 Peony Life Sciences. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
