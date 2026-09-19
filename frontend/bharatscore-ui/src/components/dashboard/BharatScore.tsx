import { Card,CardHeader,CardContent,CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { TrendingUp, Shield, Award } from "lucide-react";

interface BharatScoreProps {
  score: number;
  userName: string;
}

export function BharatScore({ score, userName }: BharatScoreProps) {
  const getScoreColor = (score: number) => {
    if (score >= 750) return "success";
    if (score >= 650) return "warning";
    return "destructive";
  };

  const getScoreLevel = (score: number) => {
    if (score >= 750) return "Excellent";
    if (score >= 650) return "Good";
    if (score >= 550) return "Fair";
    return "Needs Improvement";
  };

  const scoreColor = getScoreColor(score);
  const scoreLevel = getScoreLevel(score);

  return (
    <Card className="bg-gradient-primary text-primary-foreground shadow-medium border-0">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-primary-foreground/80 text-sm">Welcome back,</p>
            <CardTitle className="text-xl font-bold text-primary-foreground">{userName}</CardTitle>
          </div>
          <Shield className="h-8 w-8 text-primary-foreground/80" />
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Award className="h-5 w-5 text-primary-foreground/80" />
              <span className="text-sm font-medium text-primary-foreground/80">Bharat Score</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-primary-foreground">{score}</span>
              <Badge 
                variant="secondary" 
                className={`bg-${scoreColor} text-${scoreColor}-foreground border-0`}
              >
                {scoreLevel}
              </Badge>
            </div>
          </div>
          
          <div className="text-right">
            <div className="flex items-center gap-1 text-primary-foreground/80 text-sm mb-1">
              <TrendingUp className="h-4 w-4" />
              <span>+24 this month</span>
            </div>
            <p className="text-xs text-primary-foreground/60">
              Keep improving your score
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}