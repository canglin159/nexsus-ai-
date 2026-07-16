import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./lib/auth";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { DashboardLayout } from "./pages/DashboardLayout";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { BrowseListingsPage } from "./pages/BrowseListingsPage";
import { ListingDetailPage } from "./pages/ListingDetailPage";
import { CreateListingPage } from "./pages/CreateListingPage";
import { SellerDashboardPage } from "./pages/SellerDashboardPage";
import { BuyerDashboardPage } from "./pages/BuyerDashboardPage";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { ReferralPage } from "./pages/ReferralPage";
import { OutreachDashboardPage } from "./pages/OutreachDashboardPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route element={<Layout><LandingPage /></Layout>} path="/" />
            <Route element={<Layout><LoginPage /></Layout>} path="/login" />
            <Route element={<Layout><RegisterPage /></Layout>} path="/register" />
            <Route element={<Layout><BrowseListingsPage /></Layout>} path="/listings" />
            <Route element={<Layout><ListingDetailPage /></Layout>} path="/listings/:id" />
            <Route
              element={
                <ProtectedRoute roles={["seller"]}>
                  <Layout><CreateListingPage /></Layout>
                </ProtectedRoute>
              }
              path="/listings/new"
            />
            <Route
              element={
                <ProtectedRoute>
                  <Layout>
                    <DashboardLayout />
                  </Layout>
                </ProtectedRoute>
              }
            >
              <Route element={<SellerDashboardPage />} path="/dashboard/seller" />
              <Route element={<BuyerDashboardPage />} path="/dashboard/buyer" />
              <Route element={<AdminDashboardPage />} path="/dashboard/admin" />
              <Route element={<OutreachDashboardPage />} path="/dashboard/outreach" />
            </Route>
            <Route
              element={
                <ProtectedRoute>
                  <Layout><ReferralPage /></Layout>
                </ProtectedRoute>
              }
              path="/referrals"
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}