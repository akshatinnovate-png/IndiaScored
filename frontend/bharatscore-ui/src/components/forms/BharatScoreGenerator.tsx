import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { CheckCircle, AlertCircle, TrendingUp, Calculator, Smartphone, MapPin } from "lucide-react";

interface BharatScoreFormProps {
  onScoreGenerated?: (score: number, data: any) => void;
}

interface BharatScoreFormData {
  user_type: "smartphone" | "feature_phone" | "";
  region: "urban" | "rural" | "";
  sms_count: string;
  bill_on_time_ratio: string;
  recharge_freq: string;
  sim_tenure: string;
  location_stability: string;
  income_signal: string;
  coop_score: string;
  land_verified: "1" | "0" | "";
  age_group: "18-25" | "26-35" | "36-45" | "46-55" | "56+" | "";
}

interface ScoreResult {
  bharatScore: number;
  riskCategory: "Low" | "Medium" | "High";
  eligibilityPercentage: number;
  factors: {
    technology: number;
    location: number;
    financial: number;
    stability: number;
    demographics: number;
  };
  recommendations: string[];
}

export function BharatScoreGenerator({ onScoreGenerated }: BharatScoreFormProps) {
  const [formData, setFormData] = useState<BharatScoreFormData>({
    user_type: "",
    region: "",
    sms_count: "",
    bill_on_time_ratio: "",
    recharge_freq: "",
    sim_tenure: "",
    location_stability: "",
    income_signal: "",
    coop_score: "",
    land_verified: "",
    age_group: "",
  });

  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const calculateBharatScore = () => {
    setIsCalculating(true);
    
    // Simulate API call with BharatScore algorithm
    setTimeout(() => {
      let baseScore = 300;
      let factors = {
        technology: 0,
        location: 0,
        financial: 0,
        stability: 0,
        demographics: 0
      };

      // Technology Factor (20% weight)
      if (formData.user_type === "smartphone") {
        factors.technology = 80;
        baseScore += 80;
      } else if (formData.user_type === "feature_phone") {
        factors.technology = 40;
        baseScore += 40;
      }

      // Location Factor (15% weight)
      if (formData.region === "urban") {
        factors.location = 60;
        baseScore += 60;
      } else if (formData.region === "rural") {
        factors.location = 45;
        baseScore += 45;
      }

      // Financial Behavior Factor (35% weight)
      const billRatio = parseFloat(formData.bill_on_time_ratio) || 0;
      const incomeSignal = parseFloat(formData.income_signal) || 0;
      const coopScore = parseFloat(formData.coop_score) || 0;
      
      const financialScore = (billRatio * 0.4 + incomeSignal * 0.3 + coopScore * 0.3) * 150;
      factors.financial = Math.round(financialScore);
      baseScore += financialScore;

      // Stability Factor (20% weight)
      const simTenure = parseInt(formData.sim_tenure) || 0;
      const locationStability = parseFloat(formData.location_stability) || 0;
      const landVerified = formData.land_verified === "1" ? 1 : 0;
      
      const stabilityScore = ((simTenure / 24) * 0.4 + locationStability * 0.4 + landVerified * 0.2) * 100;
      factors.stability = Math.round(stabilityScore);
      baseScore += stabilityScore;

      // Demographics Factor (10% weight)
      let ageScore = 0;
      switch (formData.age_group) {
        case "26-35":
          ageScore = 50;
          break;
        case "36-45":
          ageScore = 45;
          break;
        case "18-25":
          ageScore = 35;
          break;
        case "46-55":
          ageScore = 40;
          break;
        case "56+":
          ageScore = 30;
          break;
      }
      factors.demographics = ageScore;
      baseScore += ageScore;

      // SMS activity bonus
      const smsCount = parseInt(formData.sms_count) || 0;
      if (smsCount > 50) baseScore += 30;
      else if (smsCount > 20) baseScore += 15;

      // Recharge frequency bonus
      const rechargeFreq = parseInt(formData.recharge_freq) || 0;
      if (rechargeFreq >= 4) baseScore += 20;
      else if (rechargeFreq >= 2) baseScore += 10;

      const finalScore = Math.min(Math.max(Math.round(baseScore), 300), 850);
      
      const riskCategory: "Low" | "Medium" | "High" = 
        finalScore >= 700 ? "Low" : finalScore >= 600 ? "Medium" : "High";
      
      const eligibilityPercentage = Math.min(((finalScore - 300) / 550) * 100, 100);

      const recommendations = [];
      if (factors.financial < 80) recommendations.push("Improve bill payment consistency");
      if (factors.technology < 60) recommendations.push("Consider smartphone adoption for better digital footprint");
      if (factors.stability < 70) recommendations.push("Maintain stable location and tenure");
      if (smsCount < 20) recommendations.push("Increase banking transaction frequency");

      const result: ScoreResult = {
        bharatScore: finalScore,
        riskCategory,
        eligibilityPercentage: Math.round(eligibilityPercentage),
        factors,
        recommendations
      };

      setScoreResult(result);
      onScoreGenerated?.(finalScore, { ...formData, ...result });
      setIsCalculating(false);
    }, 2000);
  };

  const handleInputChange = (field: keyof BharatScoreFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setScoreResult(null); // Reset results on form change
  };

  const isFormValid = () => {
    return formData.user_type && formData.region && formData.age_group && 
           formData.sms_count && formData.bill_on_time_ratio;
  };

  return (
    <Card className="shadow-medium border-border/50">
      <CardHeader className="bg-gradient-boi text-primary-foreground">
        <div className="flex items-center gap-3">
          <Calculator className="h-6 w-6" />
          <div>
            <CardTitle className="text-xl font-bold">BharatScore Generator</CardTitle>
            <p className="text-primary-foreground/80 text-sm">
              Generate comprehensive credit scores using Bank of India's advanced algorithm
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Form Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              Scoring Parameters
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="user_type">Device Type</Label>
                <Select value={formData.user_type} onValueChange={(value) => handleInputChange("user_type", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select device type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smartphone">Smartphone</SelectItem>
                    <SelectItem value="feature_phone">Feature Phone</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="region">Region</Label>
                <Select value={formData.region} onValueChange={(value) => handleInputChange("region", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urban">Urban</SelectItem>
                    <SelectItem value="rural">Rural</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="age_group">Age Group</Label>
                <Select value={formData.age_group} onValueChange={(value) => handleInputChange("age_group", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select age group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="18-25">18-25 years</SelectItem>
                    <SelectItem value="26-35">26-35 years</SelectItem>
                    <SelectItem value="36-45">36-45 years</SelectItem>
                    <SelectItem value="46-55">46-55 years</SelectItem>
                    <SelectItem value="56+">56+ years</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sms_count">Monthly SMS Count</Label>
                <Input
                  id="sms_count"
                  type="number"
                  placeholder="Number of SMS per month"
                  value={formData.sms_count}
                  onChange={(e) => handleInputChange("sms_count", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bill_on_time_ratio">Bill Payment Ratio</Label>
                <Input
                  id="bill_on_time_ratio"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  placeholder="0.0 to 1.0"
                  value={formData.bill_on_time_ratio}
                  onChange={(e) => handleInputChange("bill_on_time_ratio", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recharge_freq">Monthly Recharge Frequency</Label>
                <Input
                  id="recharge_freq"
                  type="number"
                  placeholder="Times per month"
                  value={formData.recharge_freq}
                  onChange={(e) => handleInputChange("recharge_freq", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sim_tenure">SIM Tenure (months)</Label>
                <Input
                  id="sim_tenure"
                  type="number"
                  placeholder="Number of months"
                  value={formData.sim_tenure}
                  onChange={(e) => handleInputChange("sim_tenure", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location_stability">Location Stability</Label>
                <Input
                  id="location_stability"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  placeholder="0.0 to 1.0"
                  value={formData.location_stability}
                  onChange={(e) => handleInputChange("location_stability", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="income_signal">Income Signal</Label>
                <Input
                  id="income_signal"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  placeholder="0.0 to 1.0"
                  value={formData.income_signal}
                  onChange={(e) => handleInputChange("income_signal", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="coop_score">Cooperative Score</Label>
                <Input
                  id="coop_score"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  placeholder="0.0 to 1.0"
                  value={formData.coop_score}
                  onChange={(e) => handleInputChange("coop_score", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="land_verified">Land Verification</Label>
                <Select value={formData.land_verified} onValueChange={(value) => handleInputChange("land_verified", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select verification status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Verified</SelectItem>
                    <SelectItem value="0">Not Verified</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              onClick={calculateBharatScore} 
              className="w-full bg-gradient-boi hover:opacity-90"
              disabled={isCalculating || !isFormValid()}
              size="lg"
            >
              {isCalculating ? "Generating BharatScore..." : "Generate BharatScore"}
            </Button>
          </div>

          {/* Results Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-secondary" />
              Score Analysis
            </h3>
            
            {isCalculating && (
              <Card className="p-6 text-center border-border/50">
                <div className="space-y-4">
                  <div className="animate-spin mx-auto w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full"></div>
                  <p className="text-muted-foreground">Processing with BharatScore AI...</p>
                  <Progress value={66} className="w-full" />
                </div>
              </Card>
            )}

            {scoreResult && (
              <div className="space-y-4">
                {/* Main Score */}
                <Card className={`p-6 text-center border-l-4 ${scoreResult.riskCategory === 'Low' ? 'border-l-success bg-success/5' : scoreResult.riskCategory === 'Medium' ? 'border-l-warning bg-warning/5' : 'border-l-destructive bg-destructive/5'}`}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2">
                      <Badge className="bg-gradient-boi text-primary-foreground">BharatScore</Badge>
                    </div>
                    <div className="text-4xl font-bold text-foreground">{scoreResult.bharatScore}</div>
                    <Badge 
                      variant={scoreResult.riskCategory === "Low" ? "default" : 
                             scoreResult.riskCategory === "Medium" ? "secondary" : "destructive"}
                      className="flex items-center gap-1 w-fit mx-auto"
                    >
                      {scoreResult.riskCategory === "Low" ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                      {scoreResult.riskCategory} Risk
                    </Badge>
                    <Progress value={scoreResult.eligibilityPercentage} className="mt-4" />
                    <p className="text-sm text-muted-foreground">{scoreResult.eligibilityPercentage}% Creditworthiness</p>
                  </div>
                </Card>

                {/* Factor Breakdown */}
                <Card className="p-4">
                  <h4 className="font-medium text-foreground mb-3">Score Factor Analysis</h4>
                  <div className="space-y-3">
                    {Object.entries(scoreResult.factors).map(([factor, value]) => (
                      <div key={factor} className="flex items-center justify-between">
                        <span className="text-sm capitalize text-muted-foreground">
                          {factor.replace('_', ' ')}
                        </span>
                        <div className="flex items-center gap-2">
                          <Progress value={value} className="w-16 h-2" />
                          <span className="text-sm font-medium text-foreground w-8">{value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Recommendations */}
                {scoreResult.recommendations.length > 0 && (
                  <Card className="p-4">
                    <h4 className="font-medium text-foreground mb-3">Improvement Recommendations</h4>
                    <div className="space-y-2">
                      {scoreResult.recommendations.map((rec, index) => (
                        <div key={index} className="flex items-start gap-2 text-sm">
                          <TrendingUp className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{rec}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            )}

            {!scoreResult && !isCalculating && (
              <Card className="p-6 text-center border-dashed border-border">
                <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Complete the form to generate your BharatScore assessment
                </p>
              </Card>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}