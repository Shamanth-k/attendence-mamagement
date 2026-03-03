import { Navigate, Route, Routes } from "react-router-dom";
import { EmployeeProvider } from "./context/EmployeeContext";
import { AuthProvider } from "./context/AuthContext";
import { PublicOnly, RequireAuth, RequireRole } from "./common/guards";
import LoginPage from "./pages/common/LoginPage";
import ForceChangePasswordPage from "./pages/common/ForceChangePasswordPage";
import ResetPasswordPage from "./pages/common/ResetPasswordPage";
import AdminLayout from "./layouts/AdminLayout";
import EmployeeLayout from "./layouts/EmployeeLayout";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminMastersPage from "./pages/admin/AdminMastersPage";
import AdminEmployeesPage from "./pages/admin/AdminEmployeesPage";
import AdminCalendarPage from "./pages/admin/AdminCalendarPage";
import AdminAttendancePage from "./pages/admin/AdminAttendancePage";
import ProfilePage from "./pages/ProfilePage";
import EmployeeDashboardPage from "./pages/employee/EmployeeDashboardPage";
import EmployeeAttendancePage from "./pages/employee/EmployeeAttendancePage";
import EmployeeReportPage from "./pages/employee/EmployeeReportPage";
import EmployeeLeavePage from "./pages/employee/EmployeeLeavePage";
import EmployeeProfilePage from "./pages/employee/EmployeeProfilePage";

function App() {
  return (
    <AuthProvider>
      <EmployeeProvider>
        <Routes>
          <Route element={<PublicOnly />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route element={<RequireAuth />}>
            <Route path="/force-change-password" element={<ForceChangePasswordPage />} />

            <Route element={<RequireRole role="ADMIN" />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboardPage />} />
                <Route path="masters" element={<AdminMastersPage />} />
                <Route path="employees" element={<AdminEmployeesPage />} />
                <Route path="calendar" element={<AdminCalendarPage />} />
                <Route path="attendance" element={<AdminAttendancePage />} />
                <Route path="profile" element={<ProfilePage />} />
              </Route>
            </Route>

            <Route element={<RequireRole role="EMPLOYEE" />}>
              <Route path="/employee" element={<EmployeeLayout />}>
                <Route index element={<Navigate to="/employee/dashboard" replace />} />
                <Route path="dashboard" element={<EmployeeDashboardPage />} />
                <Route path="attendance" element={<EmployeeAttendancePage />} />
                <Route path="report" element={<EmployeeReportPage />} />
                <Route path="leave" element={<EmployeeLeavePage />} />
                <Route path="profile" element={<EmployeeProfilePage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </EmployeeProvider>
    </AuthProvider>
  );
}

export default App;
