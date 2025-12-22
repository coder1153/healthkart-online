import { ShoppingCart, Heart, User, Search, Menu, ShieldCheck, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getAdminSession } from "@/lib/adminAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Navbar = ({ cartItemsCount = 0 }: { cartItemsCount?: number }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAdminSession = () => {
      const session = getAdminSession();
      setIsAdmin(!!session);
    };
    
    checkAdminSession();
    
    // Check every minute if admin session is still valid
    const interval = setInterval(checkAdminSession, 60000);
    
    // Check user auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <span className="text-white font-bold text-lg">P</span>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Peony LifeStore
            </span>
          </Link>

          {/* Search Bar - Desktop */}
          <div className="hidden md:flex flex-1 max-w-xl mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search medicines, health products..."
                className="pl-10 w-full"
              />
            </div>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center space-x-4">
            {isAdmin && (
              <Button variant="ghost" size="icon" asChild title="Admin Panel">
                <Link to="/admin">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </Link>
              </Button>
            )}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem className="text-sm text-muted-foreground cursor-default">
                    {user.email}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/order-history" className="w-full cursor-pointer">
                      Order History
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="ghost" size="icon" asChild>
                <Link to="/auth">
                  <User className="h-5 w-5" />
                </Link>
              </Button>
            )}
            <Button variant="ghost" size="icon">
              <Heart className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="relative" asChild>
              <Link to="/cart">
                <ShoppingCart className="h-5 w-5" />
                {cartItemsCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                    {cartItemsCount}
                  </span>
                )}
              </Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        {/* Mobile Search & Menu */}
        {isMenuOpen && (
          <div className="md:hidden pb-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search products..."
                className="pl-10 w-full"
              />
            </div>
            <div className="flex flex-wrap justify-around gap-2">
              {isAdmin && (
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/admin">
                    <ShieldCheck className="h-4 w-4 mr-2 text-primary" />
                    Admin
                  </Link>
                </Button>
              )}
              {user ? (
                <>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/order-history">
                      <User className="h-4 w-4 mr-2" />
                      Orders
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </Button>
                </>
              ) : (
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/auth">
                    <User className="h-4 w-4 mr-2" />
                    Login
                  </Link>
                </Button>
              )}
              <Button variant="ghost" size="sm">
                <Heart className="h-4 w-4 mr-2" />
                Wishlist
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/cart">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Cart ({cartItemsCount})
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
