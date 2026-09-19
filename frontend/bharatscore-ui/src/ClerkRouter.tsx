import React from "react";
import { ClerkProvider } from "@clerk/clerk-react";

interface ClerkWithRouterProps {
  children: React.ReactNode;
  publishableKey: string;
}

export function ClerkWithRouter({ children, publishableKey }: ClerkWithRouterProps) {
  return (
    <ClerkProvider publishableKey={publishableKey}>
      {children}
    </ClerkProvider>
  );
}