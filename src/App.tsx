import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Iteration43Interface from "./components/Iteration43Interface";
import TutorialSystem from "./components/TutorialSystem";
import ProductionDashboard from "./components/ProductionDashboard";
import ErrorAlertSystem from "./components/ErrorAlertSystem";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <TutorialSystem />
      {/* Production Error Monitoring */}
      <div className="fixed top-4 right-4 z-50 max-w-md">
        <ErrorAlertSystem autoHide={true} />
      </div>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/iteration43" element={<Iteration43Interface />} />
          <Route path="/production" element={<ProductionDashboard />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
