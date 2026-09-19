import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "./ui/sidebar";

import { AppSidebar } from "./dashboard/AppSideBar";
import { BharatScore } from "./dashboard/BharatScore";
import { LoanCard } from "./dashboard/LoanCard";
import { LoanApplicationForm } from "./forms/LoanApplicationForm";
import { BharatScoreGenerator } from "./forms/BharatScoreGenerator";
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { 
  GraduationCap, 
  Briefcase, 
  User, 
  Tractor, 
  Shield, 
  Calculator,
  Award
} from "lucide-react";

const loanTypes = [
  {
    id: "personal",
    title: "Personal Loan",
    description: "Quick funds for personal needs",
    amountRange: "₹10K - ₹10L",
    interestRange: "10.5% - 24%",
    icon: <User className="h-5 w-5" />,
    color: "primary" as const,
  },
  {
    id: "education",
    title: "Education Loan",
    description: "Invest in your future",
    amountRange: "₹50K - ₹50L",
    interestRange: "8.5% - 15%",
    icon: <GraduationCap className="h-5 w-5" />,
    color: "secondary" as const,
  },
  {
    id: "business",
    title: "Business Loan",
    description: "Grow your enterprise",
    amountRange: "₹1L - ₹1Cr",
    interestRange: "12% - 20%",
    icon: <Briefcase className="h-5 w-5" />,
    color: "accent" as const,
  },
  {
    id: "agriculture",
    title: "Agriculture Loan",
    description: "Support farming activities",
    amountRange: "₹25K - ₹25L",
    interestRange: "7% - 12%",
    icon: <Tractor className="h-5 w-5" />,
    color: "success" as const,
  },
  {
    id: "emergency",
    title: "Emergency Loan",
    description: "Instant funds for urgent needs",
    amountRange: "₹5K - ₹2L",
    interestRange: "15% - 30%",
    icon: <Shield className="h-5 w-5" />,
    color: "warning" as const,
  },
];

const Index = () => {
  const [selectedLoan, setSelectedLoan] = useState<string | null>(null);

  const handleApplyLoan = (loanId: string) => {
    setSelectedLoan(loanId);
  };

  const handleBackToDashboard = () => {
    setSelectedLoan(null);
  };

  if (selectedLoan) {
    const loan = loanTypes.find(l => l.id === selectedLoan);
    return (
      <SidebarProvider>
        <div className="min-h-screen w-full flex bg-background">
          <AppSidebar />
          <main className="flex-1">
          <header className="h-16 border-b border-border bg-card flex items-center px-6">
            <SidebarTrigger className="mr-4" />
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold text-foreground">BharatScore Platform</h1>
            </div>
            <Button 
              variant="outline" 
              onClick={() => window.open('/admin', '_blank')}
              className="ml-auto"
            >
              Admin Portal
            </Button>
          </header>
            <div className="p-6">
              <LoanApplicationForm 
                loanType={loan?.title || "Loan"}
                onBack={handleBackToDashboard}
              />
            </div>
          </main>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full flex bg-background">
        <AppSidebar />
        <main className="flex-1">
          <header className="h-16 border-b border-border bg-card flex items-center px-6">
            <SidebarTrigger className="mr-4" />
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold text-foreground">BharatScore Dashboard</h1>
            </div>
            <Button 
              variant="outline" 
              onClick={() => window.open('/admin', '_blank')}
              className="ml-auto"
            >
              Admin Portal
            </Button>
          </header>
          
          <div className="p-6 space-y-6">
            <Tabs defaultValue="dashboard" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="dashboard" className="flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Dashboard
                </TabsTrigger>
                <TabsTrigger value="score-generator" className="flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  Score Generator
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="dashboard" className="space-y-6">
                {/* Welcome Section */}
                <BharatScore score={720} userName="Rahul Sharma" />
                
                {/* Loan Types Grid */}
                <div className="space-y-4">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">Available Loan Options</h2>
                    <p className="text-muted-foreground">Choose from our diverse loan products designed for urban and rural needs</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loanTypes.map((loan) => (
                      <LoanCard
                        key={loan.id}
                        title={loan.title}
                        description={loan.description}
                        amountRange={loan.amountRange}
                        interestRange={loan.interestRange}
                        icon={loan.icon}
                        color={loan.color}
                        onApply={() => handleApplyLoan(loan.id)}
                      />
                    ))}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="score-generator" className="space-y-6">
                <BharatScoreGenerator />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Index;
