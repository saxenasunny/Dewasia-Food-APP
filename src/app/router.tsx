import { Navigate, Route, Routes } from "react-router-dom";
import RequireSession, { RequireOperator } from "./guards";

import WelcomePage from "../pages/WelcomePage";
import MenuPage from "../pages/MenuPage";
import CartPage from "../pages/CartPage";
import CheckoutPage from "../pages/CheckoutPage";
import OrderConfirmationPage from "../pages/OrderConfirmationPage";
import OrderTrackingPage from "../pages/OrderTrackingPage";
import OrderHistoryPage from "../pages/OrderHistoryPage";
import SettingsPage from "../pages/SettingsPage";
import OperatorLoginPage from "../pages/OperatorLoginPage";
import OperatorDashboardPage from "../pages/operator/OperatorDashboardPage";
import MenuManagementPage from "../pages/operator/MenuManagementPage";
import ReportsPage from "../pages/operator/ReportsPage";
import OperatorSettingsPage from "../pages/operator/OperatorSettingsPage";
import NotFoundPage from "../pages/NotFoundPage";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route path="/operator/login" element={<OperatorLoginPage />} />

      <Route element={<RequireSession />}>
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/orders" element={<OrderHistoryPage />} />
        <Route path="/orders/:id" element={<OrderTrackingPage />} />
        <Route path="/orders/:id/confirmation" element={<OrderConfirmationPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="/operator" element={<RequireOperator />}>
        <Route index element={<OperatorDashboardPage />} />
        <Route path="menu" element={<MenuManagementPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<OperatorSettingsPage />} />
      </Route>

      <Route path="/dashboard" element={<Navigate to="/operator" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
