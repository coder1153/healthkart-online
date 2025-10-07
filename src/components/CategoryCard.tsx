import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface CategoryCardProps {
  name: string;
  icon: LucideIcon;
  description: string;
  onClick?: () => void;
}

export const CategoryCard = ({ name, icon: Icon, description, onClick }: CategoryCardProps) => {
  return (
    <Card
      className="p-6 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 bg-gradient-to-br from-card to-muted/20 border-border/50"
      onClick={onClick}
      style={{ transition: "var(--transition)" }}
    >
      <div className="flex flex-col items-center text-center space-y-3">
        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center">
          <Icon className="h-7 w-7 text-primary" />
        </div>
        <h3 className="font-semibold text-lg">{name}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </Card>
  );
};
