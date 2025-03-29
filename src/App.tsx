
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/AdminDashboard";
import BlogPostsPage from "./pages/BlogPostsPage";
import SchedulerPage from "./pages/SchedulerPage";
import PodcastPage from "./pages/PodcastPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import UnauthorizedPage from "./pages/auth/UnauthorizedPage";
import UserManagementPage from "./pages/admin/UserManagementPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            
            {/* Protected Admin Routes */}
            <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/posts" element={<ProtectedRoute><BlogPostsPage /></ProtectedRoute>} />
            <Route path="/admin/scheduler" element={<ProtectedRoute><SchedulerPage /></ProtectedRoute>} />
            <Route path="/admin/podcast" element={<ProtectedRoute><PodcastPage /></ProtectedRoute>} />
            <Route path="/admin/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            
            {/* Global Admin Only Routes */}
            <Route 
              path="/admin/users" 
              element={
                <ProtectedRoute requiredRole="global_administrator">
                  <UserManagementPage />
                </ProtectedRoute>
              } 
            />
            
            {/* Catch-all Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster />
          <Sonner />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
