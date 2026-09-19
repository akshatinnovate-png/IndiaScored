import { NavLink, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  FileText, 
  User, 
  HelpCircle, 
  IndianRupee
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "../ui/sidebar";

const navigationItems = [
  { 
    title: "Dashboard", 
    url: "/", 
    icon: LayoutDashboard 
  },
  { 
    title: "Loan Applications", 
    url: "/applications", 
    icon: FileText 
  },
  { 
    title: "Profile", 
    url: "/profile", 
    icon: User 
  },
  { 
    title: "Support", 
    url: "/support", 
    icon: HelpCircle 
  },
];

const adminNavigationItems = [
  { 
    title: "Admin Dashboard", 
    url: "/admin", 
    icon: LayoutDashboard 
  },
  { 
    title: "All Applications", 
    url: "/admin/applications", 
    icon: FileText 
  },
  { 
    title: "Score Analytics", 
    url: "/admin/analytics", 
    icon: User 
  },
  { 
    title: "Settings", 
    url: "/admin/settings", 
    icon: HelpCircle 
  },
];

interface AppSidebarProps {
  isAdmin?: boolean;
}

export function AppSidebar({ isAdmin = false }: AppSidebarProps) {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const isCollapsed = state === "collapsed";

  const navItems = isAdmin ? adminNavigationItems : navigationItems;

  const isActive = (path: string) => currentPath === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive 
      ? "bg-primary text-primary-foreground font-medium shadow-soft" 
      : "hover:bg-muted/60 text-foreground";

  return (
    <Sidebar
      className={`${isCollapsed ? "w-16" : "w-64"} transition-all duration-300 border-r border-border`}
      collapsible="icon"
    >
      <SidebarContent className="bg-card">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={`p-2 ${isAdmin ? 'bg-gradient-admin' : 'bg-gradient-boi'} rounded-lg`}>
              <IndianRupee className="h-6 w-6 text-primary-foreground" />
            </div>
            {!isCollapsed && (
              <div>
                <h2 className="font-bold text-lg text-foreground">BharatScore</h2>
                <p className="text-xs text-muted-foreground">{isAdmin ? 'Admin Portal' : 'Bank of India'}</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <SidebarGroup className="px-2 py-4">
          <SidebarGroupLabel className={isCollapsed ? "sr-only" : "px-3 text-muted-foreground"}>
            Navigation
          </SidebarGroupLabel>
          
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end 
                      className={({ isActive }) => `${getNavCls({ isActive })} flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200`}
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {!isCollapsed && <span className="font-medium">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Footer */}
        {!isCollapsed && (
          <div className="mt-auto p-4 border-t border-border">
            <div className="text-xs text-muted-foreground text-center">
              <p>{isAdmin ? 'Administrative Portal' : 'Empowering financial inclusion'}</p>
              <p>{isAdmin ? 'Bank of India' : 'across urban & rural India'}</p>
            </div>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}