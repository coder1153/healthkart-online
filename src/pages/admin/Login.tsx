import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";

const AdminLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [adminKey, setAdminKey] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('admin-login', {
        body: { admin_key: adminKey },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Login failed');
      }

      // Store admin token in localStorage
      localStorage.setItem('admin_token', data.admin_token);
      localStorage.setItem('admin_label', data.label);
      localStorage.setItem('admin_expires', String(Date.now() + (data.expires_in * 1000)));

      toast({
        title: "Welcome, Admin!",
        description: `Logged in as: ${data.label}`,
      });

      navigate("/admin");
    } catch (error: any) {
      console.error('Admin login error:', error);
      toast({
        title: "Login Failed",
        description: error.message || "Invalid admin key or server error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl">Admin Access</CardTitle>
          <CardDescription>Enter your admin access key to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-key" className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                Admin Key
              </Label>
              <Input
                id="admin-key"
                type="password"
                placeholder="Enter your admin key"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                required
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                If you don't have an admin key, contact the system administrator.
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Access Admin Panel
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h3 className="text-sm font-semibold mb-2">🔒 Security Notice</h3>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Admin keys are single-use authentication tokens</li>
              <li>• Sessions expire after 1 hour of inactivity</li>
              <li>• All admin actions are logged and audited</li>
              <li>• Failed login attempts are rate-limited</li>
            </ul>
          </div>

          <div className="mt-4 text-center">
            <Button variant="link" onClick={() => navigate("/")}>
              Back to Store
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;
