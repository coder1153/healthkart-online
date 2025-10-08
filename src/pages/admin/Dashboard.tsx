import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, ShoppingCart, Users, TrendingUp } from "lucide-react";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate("/auth");
        return;
      }
      setUserId(data.session.user.id);

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.session.user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleData) {
        navigate("/");
        return;
      }
      setIsAdmin(true);
    };
    checkAdmin();
  }, [navigate]);

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [products, orders, users] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("orders").select("*"),
        supabase.from("user_roles").select("*", { count: "exact", head: true }),
      ]);

      const revenue = orders.data?.reduce(
        (sum, order) => sum + Number(order.total_amount),
        0
      ) || 0;

      return {
        totalProducts: products.count || 0,
        totalOrders: orders.data?.length || 0,
        totalUsers: users.count || 0,
        totalRevenue: revenue,
      };
    },
    enabled: isAdmin,
  });

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <div className="flex gap-4">
            <a
              href="/admin/products"
              className="text-primary hover:underline text-sm"
            >
              Manage Products
            </a>
            <a
              href="/admin/orders"
              className="text-primary hover:underline text-sm"
            >
              Manage Orders
            </a>
            <a
              href="/admin/users"
              className="text-primary hover:underline text-sm"
            >
              Manage Users
            </a>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground">Total Products</span>
              <Package className="h-5 w-5 text-primary" />
            </div>
            <p className="text-3xl font-bold">{stats?.totalProducts || 0}</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground">Total Orders</span>
              <ShoppingCart className="h-5 w-5 text-primary" />
            </div>
            <p className="text-3xl font-bold">{stats?.totalOrders || 0}</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground">Total Users</span>
              <Users className="h-5 w-5 text-primary" />
            </div>
            <p className="text-3xl font-bold">{stats?.totalUsers || 0}</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground">Total Revenue</span>
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <p className="text-3xl font-bold">
              ₹{stats?.totalRevenue.toFixed(2) || "0.00"}
            </p>
          </Card>
        </div>

        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <a
              href="/admin/products"
              className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <Package className="h-6 w-6 mb-2 text-primary" />
              <h3 className="font-semibold mb-1">Manage Products</h3>
              <p className="text-sm text-muted-foreground">
                Add, edit, or remove products
              </p>
            </a>
            <a
              href="/admin/orders"
              className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <ShoppingCart className="h-6 w-6 mb-2 text-primary" />
              <h3 className="font-semibold mb-1">Manage Orders</h3>
              <p className="text-sm text-muted-foreground">
                View and update order status
              </p>
            </a>
            <a
              href="/admin/users"
              className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <Users className="h-6 w-6 mb-2 text-primary" />
              <h3 className="font-semibold mb-1">Manage Users</h3>
              <p className="text-sm text-muted-foreground">
                View and manage user roles
              </p>
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
