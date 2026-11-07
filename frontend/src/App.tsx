import { Navigate, Route, Routes } from 'react-router-dom';
import { AccountPage } from './account/AccountPage';
import { AuthProvider } from './auth/AuthContext';
import { LoginPage } from './auth/LoginPage';
import { RequireAuth } from './auth/RequireAuth';
import { CataloguePage } from './catalogue/CataloguePage';
import { AppLayout } from './layout/AppLayout';
import { LoansPage } from './loans/LoansPage';
import { MemberDetailPage } from './members/MemberDetailPage';
import { MembersPage } from './members/MembersPage';
import { SettingsPage } from './settings/SettingsPage';

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/catalogue" replace />} />
          <Route path="catalogue" element={<CataloguePage />} />
          <Route
            path="account"
            element={
              <RequireAuth roles={['member']}>
                <AccountPage />
              </RequireAuth>
            }
          />
          <Route
            path="loans"
            element={
              <RequireAuth roles={['librarian']}>
                <LoansPage />
              </RequireAuth>
            }
          />
          <Route
            path="members"
            element={
              <RequireAuth roles={['librarian']}>
                <MembersPage />
              </RequireAuth>
            }
          />
          <Route
            path="members/:memberId"
            element={
              <RequireAuth roles={['librarian']}>
                <MemberDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="settings"
            element={
              <RequireAuth roles={['librarian']}>
                <SettingsPage />
              </RequireAuth>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
