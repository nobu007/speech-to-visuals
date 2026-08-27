import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Iteration43Interface from "./components/Iteration43Interface";
import { CorruptionOverlay } from "./components/CorruptionOverlay";
import TutorialSystem from "./components/TutorialSystem";
import ProductionDashboard from "./components/ProductionDashboard";
import ErrorAlertSystem from "./components/ErrorAlertSystem";
import SimplePipelineInterface from "./components/SimplePipelineInterface";
import SimplePipeline from "./pages/SimplePipeline";
import FrameworkDashboardPage from "./components/FrameworkDashboardPage";
import { GuardMetricsDashboard } from "./components/GuardMetricsDashboard";
import { AdminAnalyticsDashboard } from "./components/AdminAnalyticsDashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      {/* Storage corruption recovery UI — MUST mount before any component
          that reads localStorage in its mount effect (TutorialSystem below).
          report-corruption keeps a single activeHandler with no replay
          buffer, so a later mount silently drops mount-time corruption
          events (pinned by tests/guards/corruption-overlay-app-mount.test.ts
          and src/__tests__/corruption-overlay-app-integration.test.tsx). */}
      <CorruptionOverlay />
      <TutorialSystem />
      {/* Production Error Monitoring */}
      <div className="fixed top-4 right-4 z-50 max-w-md">
        <ErrorAlertSystem autoHide={true} />
      </div>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/simple" element={<SimplePipelineInterface />} />
          <Route path="/pipeline" element={<SimplePipeline />} />
          <Route path="/iteration43" element={<Iteration43Interface />} />
          <Route path="/production" element={<ProductionDashboard />} />
          <Route path="/framework" element={<FrameworkDashboardPage />} />
          <Route path="/security" element={<GuardMetricsDashboard />} />
          <Route path="/admin" element={<AdminAnalyticsDashboard />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
