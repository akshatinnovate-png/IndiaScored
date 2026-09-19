import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { CheckCircle, AlertCircle, TrendingUp, DollarSign } from "lucide-react";

interface LoanApplicationFormProps {
  loanType: string;
  onBack: () => void;
}

interface FormData {
  monthlyIncome: string;
  employmentType: string;
  billsRatio: string;
  smsCount: string;
  bankBalance: string;
  loanAmount: string;
}

interface EligibilityResult {
  bharatScore: number;
  riskCategory: "Low" | "Medium" | "High";
  eligibilityPercentage: number;
  reasons: string[];
  approved: boolean;
}

export function LoanApplicationForm({ loanType, onBack }: LoanApplicationFormProps) {
  const [formData, setFormData] = useState<FormData>({
    monthlyIncome: "",
    employmentType: "",
    billsRatio: "",
    smsCount: "",
    bankBalance: "",
    loanAmount: "",
  });

  const [eligibilityResult, setEligibilityResult] = useState<EligibilityResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const calculateEligibility = () => {
    setIsCalculating(true);
    
    // Simulate API call
    setTimeout(() => {
      const income = parseInt(formData.monthlyIncome) || 0;
      const billsRatio = parseInt(formData.billsRatio) || 0;
      const smsCount = parseInt(formData.smsCount) || 0;
      const balance = parseInt(formData.bankBalance) || 0;
      const loanAmount = parseInt(formData.loanAmount) || 0;

      // Simple scoring algorithm
      let score = 600;
      let reasons: string[] = [];

      // Income factor
      if (income > 50000) {
        score += 100;
        reasons.push("Strong monthly income");
      } else if (income > 25000) {
        score += 50;
        reasons.push("Adequate monthly income");
      } else {
        score -= 50;
        reasons.push("Income below recommended threshold");
      }

      // Bills ratio factor
      if (billsRatio < 30) {
        score += 80;
        reasons.push("Excellent expense management");
      } else if (billsRatio < 50) {
        score += 40;
        reasons.push("Good expense control");
      } else {
        score -= 60;
        reasons.push("High expense-to-income ratio");
      }

      // SMS/Digital activity factor
      if (smsCount > 100) {
        score += 30;
        reasons.push("Active digital footprint");
      }

      // Bank balance factor
      if (balance > loanAmount * 0.2) {
        score += 50;
        reasons.push("Sufficient financial buffer");
      }

      // Employment type factor
      if (formData.employmentType === "salaried") {
        score += 40;
        reasons.push("Stable employment");
      } else if (formData.employmentType === "business") {
        score += 20;
        reasons.push("Business income source");
      }

      const finalScore = Math.min(Math.max(score, 300), 850);
      const riskCategory: "Low" | "Medium" | "High" = 
        finalScore >= 700 ? "Low" : finalScore >= 600 ? "Medium" : "High";
      
      const eligibilityPercentage = Math.min((finalScore - 300) / 550 * 100, 100);
      const approved = finalScore >= 550;

      setEligibilityResult({
        bharatScore: finalScore,
        riskCategory,
        eligibilityPercentage: Math.round(eligibilityPercentage),
        reasons: reasons.slice(0, 4),
        approved,
      });

      setIsCalculating(false);
    }, 2000);
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setEligibilityResult(null); // Reset results on form change
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="shadow-medium border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold text-foreground">
                {loanType} Application
              </CardTitle>
              <p className="text-muted-foreground mt-1">
                Complete the form to check your eligibility in real-time
              </p>
            </div>
            <Button variant="outline" onClick={onBack}>
              Back to Dashboard
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Form Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground mb-4">Application Details</h3>
              
              <div className="space-y-2">
                <Label htmlFor="loanAmount">Loan Amount (₹)</Label>
                <Input
                  id="loanAmount"
                  type="number"
                  placeholder="Enter amount needed"
                  value={formData.loanAmount}
                  onChange={(e) => handleInputChange("loanAmount", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="monthlyIncome">Monthly Income (₹)</Label>
                <Input
                  id="monthlyIncome"
                  type="number"
                  placeholder="Enter your monthly income"
                  value={formData.monthlyIncome}
                  onChange={(e) => handleInputChange("monthlyIncome", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="employmentType">Employment Type</Label>
                <Select value={formData.employmentType} onValueChange={(value) => handleInputChange("employmentType", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employment type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="salaried">Salaried</SelectItem>
                    <SelectItem value="business">Business Owner</SelectItem>
                    <SelectItem value="freelancer">Freelancer</SelectItem>
                    <SelectItem value="farmer">Farmer</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="billsRatio">Monthly Expenses Ratio (%)</Label>
                <Input
                  id="billsRatio"
                  type="number"
                  placeholder="% of income spent on bills"
                  value={formData.billsRatio}
                  onChange={(e) => handleInputChange("billsRatio", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smsCount">Monthly SMS Count</Label>
                <Input
                  id="smsCount"
                  type="number"
                  placeholder="Bank SMS notifications count"
                  value={formData.smsCount}
                  onChange={(e) => handleInputChange("smsCount", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bankBalance">Current Bank Balance (₹)</Label>
                <Input
                  id="bankBalance"
                  type="number"
                  placeholder="Enter current balance"
                  value={formData.bankBalance}
                  onChange={(e) => handleInputChange("bankBalance", e.target.value)}
                />
              </div>

              <Button 
                onClick={calculateEligibility} 
                className="w-full bg-gradient-primary hover:opacity-90"
                disabled={isCalculating || !formData.monthlyIncome || !formData.loanAmount}
                size="lg"
              >
                {isCalculating ? "Calculating..." : "Check Eligibility"}
              </Button>
            </div>

            {/* Results Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground mb-4">Real-time Assessment</h3>
              
              {isCalculating && (
                <Card className="p-6 text-center border-border/50">
                  <div className="space-y-4">
                    <div className="animate-spin mx-auto w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full"></div>
                    <p className="text-muted-foreground">Analyzing your application...</p>
                    <Progress value={66} className="w-full" />
                  </div>
                </Card>
              )}

              {eligibilityResult && (
                <div className="space-y-4">
                  {/* Bharat Score */}
                  <Card className={`p-4 border-l-4 ${eligibilityResult.approved ? 'border-l-success bg-success/5' : 'border-l-warning bg-warning/5'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-foreground">Bharat Score</span>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-success" />
                        <span className="text-2xl font-bold text-foreground">{eligibilityResult.bharatScore}</span>
                      </div>
                    </div>
                    <Progress value={eligibilityResult.eligibilityPercentage} className="mb-2" />
                    <p className="text-sm text-muted-foreground">{eligibilityResult.eligibilityPercentage}% eligibility score</p>
                  </Card>

                  {/* Risk Category */}
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">Risk Category</span>
                      <Badge 
                        variant={eligibilityResult.riskCategory === "Low" ? "default" : 
                               eligibilityResult.riskCategory === "Medium" ? "secondary" : "destructive"}
                        className="flex items-center gap-1"
                      >
                        {eligibilityResult.riskCategory === "Low" ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                        {eligibilityResult.riskCategory} Risk
                      </Badge>
                    </div>
                  </Card>

                  {/* Key Factors */}
                  <Card className="p-4">
                    <h4 className="font-medium text-foreground mb-3">Key Assessment Factors</h4>
                    <div className="space-y-2">
                      {eligibilityResult.reasons.map((reason, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                          <span className="text-muted-foreground">{reason}</span>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Final Decision */}
                  <Card className={`p-4 text-center ${eligibilityResult.approved ? 'bg-success/10' : 'bg-warning/10'}`}>
                    <div className="space-y-3">
                      <div className="flex items-center justify-center gap-2">
                        {eligibilityResult.approved ? (
                          <CheckCircle className="h-6 w-6 text-success" />
                        ) : (
                          <AlertCircle className="h-6 w-6 text-warning" />
                        )}
                        <h4 className="text-lg font-semibold text-foreground">
                          {eligibilityResult.approved ? "Loan Approved!" : "Needs Review"}
                        </h4>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {eligibilityResult.approved 
                          ? "Congratulations! You qualify for this loan with favorable terms."
                          : "Your application requires additional review. Consider improving your profile."
                        }
                      </p>
                      <Button 
                        variant={eligibilityResult.approved ? "default" : "secondary"}
                        className="mt-4"
                        disabled={!eligibilityResult.approved}
                      >
                        {eligibilityResult.approved ? "Proceed with Application" : "Improve Profile"}
                      </Button>
                    </div>
                  </Card>
                </div>
              )}

              {!eligibilityResult && !isCalculating && (
                <Card className="p-6 text-center border-dashed border-border">
                  <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Fill the form and click "Check Eligibility" to see your real-time assessment
                  </p>
                </Card>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}