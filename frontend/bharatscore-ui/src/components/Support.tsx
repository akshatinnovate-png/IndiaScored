import { SidebarProvider, SidebarTrigger } from "./ui/sidebar";
import { AppSidebar } from "./dashboard/AppSideBar";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Phone, Mail, MessageCircle, Clock, Users, FileText } from "lucide-react";

const Support = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen w-full flex bg-background">
        <AppSidebar />
        <main className="flex-1">
          <header className="h-16 border-b border-border bg-card flex items-center px-6">
            <SidebarTrigger className="mr-4" />
            <h1 className="text-xl font-semibold text-foreground">Support Center</h1>
          </header>
          
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">How can we help you?</h2>
              <p className="text-muted-foreground">Get assistance with your loans and account</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Quick Help Options */}
              <div className="lg:col-span-1 space-y-4">
                <Card className="shadow-medium border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Phone className="h-5 w-5 text-primary" />
                      Quick Contact
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">1800-123-4567</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Mon-Fri 9AM-7PM</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">support@creditconnect.in</span>
                      </div>
                      <p className="text-xs text-muted-foreground">24/7 Email Support</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Live Chat</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Available 24/7</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-medium border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-secondary" />
                      Common Issues
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button variant="ghost" className="w-full justify-start text-sm">
                      Loan Application Status
                    </Button>
                    <Button variant="ghost" className="w-full justify-start text-sm">
                      Document Upload Issues
                    </Button>
                    <Button variant="ghost" className="w-full justify-start text-sm">
                      Bharat Score Queries
                    </Button>
                    <Button variant="ghost" className="w-full justify-start text-sm">
                      Payment & EMI Help
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Contact Form */}
              <Card className="lg:col-span-2 shadow-medium border-border/50">
                <CardHeader>
                  <CardTitle>Send us a message</CardTitle>
                  <p className="text-muted-foreground">We'll get back to you within 24 hours</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" placeholder="Enter your full name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input id="email" type="email" placeholder="Enter your email" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input id="subject" placeholder="What is this regarding?" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea 
                      id="message" 
                      placeholder="Please describe your issue or question in detail..."
                      className="min-h-[120px]"
                    />
                  </div>
                  
                  <Button className="w-full bg-gradient-primary hover:opacity-90" size="lg">
                    Send Message
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Support Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="text-center p-6 shadow-soft border-border/50">
                <Clock className="h-8 w-8 text-primary mx-auto mb-2" />
                <h3 className="font-semibold text-foreground">&lt; 24 Hours</h3>
                <p className="text-sm text-muted-foreground">Average Response Time</p>
              </Card>
              <Card className="text-center p-6 shadow-soft border-border/50">
                <Users className="h-8 w-8 text-secondary mx-auto mb-2" />
                <h3 className="font-semibold text-foreground">98.5%</h3>
                <p className="text-sm text-muted-foreground">Customer Satisfaction</p>
              </Card>
              <Card className="text-center p-6 shadow-soft border-border/50">
                <MessageCircle className="h-8 w-8 text-accent mx-auto mb-2" />
                <h3 className="font-semibold text-foreground">24/7</h3>
                <p className="text-sm text-muted-foreground">Support Available</p>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Support;