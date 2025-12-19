import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

interface ProductReviewsProps {
  productId: string;
}

export const ProductReviews = ({ productId }: ProductReviewsProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getSession();
      setUserId(data.session?.user?.id || null);
    };
    getUser();
  }, []);

  const { data: reviews } = useQuery({
    queryKey: ["reviews", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createReview = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Please login to submit a review");
      const { error } = await supabase.from("reviews").insert({
        product_id: productId,
        user_id: userId,
        rating,
        comment,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", productId] });
      setComment("");
      setRating(5);
      toast({ title: "Review submitted successfully!" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const avgRating = reviews?.length
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : "0.0";

  // Calculate rating distribution
  const ratingDistribution = [5, 4, 3, 2, 1].map((star) => {
    const count = reviews?.filter((r) => r.rating === star).length || 0;
    const percentage = reviews?.length ? (count / reviews.length) * 100 : 0;
    return { star, count, percentage };
  });

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-bold mb-6">Customer Reviews</h2>
      
      {/* Rating Summary */}
      <Card className="p-6 mb-8 bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Average Rating */}
          <div className="flex flex-col items-center justify-center min-w-[140px]">
            <span className="text-5xl font-bold text-primary">{avgRating}</span>
            <div className="flex mt-2">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-5 w-5 ${
                    i < Math.round(Number(avgRating))
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Based on {reviews?.length || 0} reviews
            </p>
          </div>

          {/* Rating Distribution */}
          <div className="flex-1 space-y-2">
            {ratingDistribution.map(({ star, count, percentage }) => (
              <div key={star} className="flex items-center gap-3">
                <span className="text-sm font-medium w-12 flex items-center gap-1">
                  {star} <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                </span>
                <Progress value={percentage} className="h-2 flex-1" />
                <span className="text-sm text-muted-foreground w-8">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {userId && (
        <Card className="p-6 mb-8 bg-muted/30">
          <h3 className="font-semibold mb-4">Write a Review</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="hover:scale-110 transition-transform"
                  >
                    <Star
                      className={`h-6 w-6 ${
                        star <= rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Comment</label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience with this product..."
                rows={4}
              />
            </div>
            <Button
              onClick={() => createReview.mutate()}
              disabled={createReview.isPending}
              className="bg-gradient-to-r from-primary to-secondary"
            >
              Submit Review
            </Button>
          </div>
        </Card>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews?.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No reviews yet. Be the first to review this product!</p>
          </Card>
        )}
        {reviews?.map((review) => (
          <Card key={review.id} className="p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i < review.rating
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {new Date(review.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                {review.comment && (
                  <p className="text-muted-foreground leading-relaxed">{review.comment}</p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
