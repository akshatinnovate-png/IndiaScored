import { SidebarProvider, SidebarTrigger } from "./ui/sidebar";
import { AppSidebar } from "./dashboard/AppSideBar";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { User, Phone, Mail, MapPin, Briefcase, TrendingUp } from "lucide-react";

const Profile = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen w-full flex bg-background">
        <AppSidebar />
        <main className="flex-1">
          <header className="h-16 border-b border-border bg-card flex items-center px-6">
            <SidebarTrigger className="mr-4" />
            <h1 className="text-xl font-semibold text-foreground">Profile</h1>
          </header>
          
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Profile Summary */}
              <Card className="lg:col-span-1 shadow-medium border-border/50">
                <CardHeader className="text-center">
                  <Avatar className="w-24 h-24 mx-auto mb-4">
                    <AvatarImage src="/api/placeholder/96/96" />
                    <AvatarFallback className="text-2xl bg-primary text-primary-foreground">RS</AvatarFallback>
                  </Avatar>
                  <CardTitle className="text-xl">Rahul Sharma</CardTitle>
                  <p className="text-muted-foreground">Premium Member</p>
                  <Badge className="bg-success text-success-foreground mt-2">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    720 Credit Score
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>+91 98765 43210</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>rahul.sharma@email.com</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>Mumbai, Maharashtra</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span>Software Engineer</span>
                  </div>
                </CardContent>
              </Card>

              {/* Profile Form */}
              <Card className="lg:col-span-2 shadow-medium border-border/50">
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <p className="text-muted-foreground">Update your personal details</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input id="firstName" defaultValue="Rahul" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input id="lastName" defaultValue="Sharma" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" defaultValue="rahul.sharma@email.com" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input id="phone" defaultValue="+91 98765 43210" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <Input id="address" defaultValue="123 Tech Park, Mumbai" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="occupation">Occupation</Label>
                      <Input id="occupation" defaultValue="Software Engineer" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="income">Monthly Income</Label>
                      <Input id="income" defaultValue="₹75,000" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pan">PAN Number</Label>
                      <Input id="pan" defaultValue="ABCDE1234F" />
                    </div>
                  </div>
                  <div className="flex gap-4 pt-4">
                    <Button className="bg-gradient-primary hover:opacity-90">
                      Update Profile
                    </Button>
                    <Button variant="outline">
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Credit Score History */}
            <Card className="shadow-medium border-border/50">
              <CardHeader>
                <CardTitle>Bharat Score History</CardTitle>
                <p className="text-muted-foreground">Track your credit score improvements</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                  <div className="p-4 rounded-lg bg-muted/30">
                    <p className="text-2xl font-bold text-foreground">720</p>
                    <p className="text-sm text-muted-foreground">Current</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/20">
                    <p className="text-2xl font-bold text-foreground">696</p>
                    <p className="text-sm text-muted-foreground">Last Month</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/20">
                    <p className="text-2xl font-bold text-foreground">675</p>
                    <p className="text-sm text-muted-foreground">3 Months Ago</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/20">
                    <p className="text-2xl font-bold text-foreground">650</p>
                    <p className="text-sm text-muted-foreground">6 Months Ago</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Profile;