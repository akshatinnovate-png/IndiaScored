import { AuthProvider } from "@/app/ClerkProvider";
import { AppProviders } from "@/app/providers";
import { AppRoutes } from "@/app/routes";

/**
 * IndiaScored — alternative-data credit risk platform.
 * Author: Akshat Sarkar
 */
export default function App() {
  return (
    <AuthProvider>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </AuthProvider>
  );
}
