import { SidebarProvider, SidebarTrigger } from "./ui/sidebar";
import { AppSidebar } from "./dashboard/AppSideBar";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { FileText, Clock, CheckCircle, XCircle } from "lucide-react";

const mockApplications = [
  {
    id: "APP001",
    loanType: "Personal Loan",
    amount: "₹2,50,000",
    status: "approved",
    appliedDate: "2024-01-15",
    bharatScore: 720,
  },
  {
    id: "APP002", 
    loanType: "Education Loan",
    amount: "₹8,00,000",
    status: "pending",
    appliedDate: "2024-01-20",
    bharatScore: 685,
  },
  {
    id: "APP003",
    loanType: "Business Loan", 
    amount: "₹15,00,000",
    status: "rejected",
    appliedDate: "2024-01-10",
    bharatScore: 545,
  },
];

const Applications = () => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "pending":
        return <Clock className="h-4 w-4 text-warning" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-success text-success-foreground">Approved</Badge>;
      case "pending":
        return <Badge className="bg-warning text-warning-foreground">Under Review</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full flex bg-background">
        <AppSidebar />
        <main className="flex-1">
          <header className="h-16 border-b border-border bg-card flex items-center px-6">
            <SidebarTrigger className="mr-4" />
            <h1 className="text-xl font-semibold text-foreground">Loan Applications</h1>
          </header>
          
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Your Applications</h2>
              <p className="text-muted-foreground">Track the status of your loan applications</p>
            </div>

            <div className="grid gap-4">
              {mockApplications.map((app) => (
                <Card key={app.id} className="hover:shadow-medium transition-shadow border-border/50">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(app.status)}
                        <div>
                          <CardTitle className="text-lg">{app.loanType}</CardTitle>
                          <p className="text-sm text-muted-foreground">Application ID: {app.id}</p>
                        </div>
                      </div>
                      {getStatusBadge(app.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Loan Amount</p>
                        <p className="text-lg font-semibold text-foreground">{app.amount}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Applied Date</p>
                        <p className="text-lg font-semibold text-foreground">{app.appliedDate}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Bharat Score</p>
                        <p className="text-lg font-semibold text-foreground">{app.bharatScore}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Applications;