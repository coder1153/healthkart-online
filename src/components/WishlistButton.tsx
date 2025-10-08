import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface WishlistButtonProps {
  productId: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export const WishlistButton = ({ productId, variant = "outline", size = "icon" }: WishlistButtonProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getSession();
      setUserId(data.session?.user?.id || null);
    };
    getUser();
  }, []);

  const { data: isInWishlist } = useQuery({
    queryKey: ["wishlist", productId, userId],
    queryFn: async () => {
      if (!userId) return false;
      const { data } = await supabase
        .from("wishlist")
        .select("id")
        .eq("user_id", userId)
        .eq("product_id", productId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!userId,
  });

  const toggleWishlist = useMutation({
    mutationFn: async () => {
      if (!userId) {
        navigate("/auth");
        throw new Error("Please login");
      }

      if (isInWishlist) {
        const { error } = await supabase
          .from("wishlist")
          .delete()
          .eq("user_id", userId)
          .eq("product_id", productId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("wishlist")
          .insert({ user_id: userId, product_id: productId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      toast({
        title: isInWishlist ? "Removed from wishlist" : "Added to wishlist",
      });
    },
    onError: (error: any) => {
      if (error.message !== "Please login") {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => toggleWishlist.mutate()}
      disabled={toggleWishlist.isPending}
    >
      <Heart
        className={`h-5 w-5 ${isInWishlist ? "fill-red-500 text-red-500" : ""}`}
      />
    </Button>
  );
};
