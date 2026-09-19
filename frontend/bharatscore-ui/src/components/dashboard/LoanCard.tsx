import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

interface LoanCardProps {
  title: string;
  description: string;
  amountRange: string;
  interestRange: string;
  icon: React.ReactNode;
  color: "primary" | "secondary" | "accent" | "success" | "warning";
  onApply: () => void;
}

export function LoanCard({ 
  title, 
  description, 
  amountRange, 
  interestRange, 
  icon, 
  color,
  onApply 
}: LoanCardProps) {
  return (
    <Card className="group hover:shadow-medium transition-all duration-300 border-border/50 hover:border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3 mb-2">
          <div className={`p-2 rounded-lg bg-${color} text-${color}-foreground`}>
            {icon}
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold text-foreground">{title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-muted-foreground">Amount Range</span>
            <Badge variant="secondary" className="bg-muted text-foreground">
              {amountRange}
            </Badge>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-muted-foreground">Interest Rate</span>
            <Badge variant="outline" className="border-border text-foreground">
              {interestRange}
            </Badge>
          </div>
          
          <Button 
            onClick={onApply}
            variant="default"
            className="w-full mt-4 bg-gradient-primary hover:opacity-90 transition-opacity"
            size="lg"
          >
            Apply Now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}