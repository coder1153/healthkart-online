import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Shield, User } from "lucide-react";
import { verifyAdminSession } from "@/lib/adminAuth";

const AdminUsers = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const isValid = await verifyAdminSession();
      if (!isValid) {
        navigate("/admin/login");
        return;
      }
      setIsAdmin(true);
    };
    checkAdmin();
  }, [navigate]);

  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const toggleRole = useMutation({
    mutationFn: async ({ userId, currentRole }: { userId: string; currentRole: "admin" | "user" }) => {
      const newRole: "admin" | "user" = currentRole === "admin" ? "user" : "admin";
      
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", currentRole);

      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: newRole });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "User role updated successfully!" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Manage Users</h1>
          <Button variant="outline" onClick={() => navigate("/admin")}>
            Back to Dashboard
          </Button>
        </div>

        <div className="grid gap-4">
          {users?.map((userRole) => (
            <Card key={userRole.id} className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {userRole.role === "admin" ? (
                    <Shield className="h-6 w-6 text-primary" />
                  ) : (
                    <User className="h-6 w-6 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">User ID: {userRole.user_id.slice(0, 8)}...</p>
                    <p className="text-sm text-muted-foreground">
                      Joined: {new Date(userRole.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge
                    className={
                      userRole.role === "admin"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted"
                    }
                  >
                    {userRole.role}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      toggleRole.mutate({
                        userId: userRole.user_id,
                        currentRole: userRole.role,
                      })
                    }
                  >
                    {userRole.role === "admin" ? "Remove Admin" : "Make Admin"}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminUsers;
