import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Star } from "lucide-react";
import { Link } from "react-router-dom";

interface ProductCardProps {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url?: string;
  rating?: number;
  stock: number;
  onAddToCart?: () => void;
}

export const ProductCard = ({
  id,
  name,
  description,
  price,
  image_url,
  rating = 0,
  stock,
  onAddToCart,
}: ProductCardProps) => {
  return (
    <Card className="group overflow-hidden transition-all hover:shadow-lg border-border/50">
      <Link to={`/product/${id}`}>
        <div className="aspect-square overflow-hidden bg-muted/30">
          {image_url ? (
            <img
              src={image_url}
              alt={name}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5">
              <span className="text-4xl text-muted-foreground">💊</span>
            </div>
          )}
        </div>
      </Link>
      <CardContent className="p-4">
        <Link to={`/product/${id}`}>
          <div className="space-y-2">
            {stock < 10 && stock > 0 && (
              <Badge variant="destructive" className="text-xs">
                Only {stock} left
              </Badge>
            )}
            {stock === 0 && (
              <Badge variant="secondary" className="text-xs">
                Out of Stock
              </Badge>
            )}
            <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
              {name}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-medium">{rating.toFixed(1)}</span>
            </div>
          </div>
        </Link>
      </CardContent>
      <CardFooter className="p-4 pt-0 flex items-center justify-between">
        <div className="text-2xl font-bold text-primary">₹{price.toFixed(2)}</div>
        <Button
          size="sm"
          onClick={onAddToCart}
          disabled={stock === 0}
          className="bg-gradient-to-r from-primary to-secondary hover:opacity-90"
        >
          <ShoppingCart className="h-4 w-4 mr-1" />
          Add
        </Button>
      </CardFooter>
    </Card>
  );
};
