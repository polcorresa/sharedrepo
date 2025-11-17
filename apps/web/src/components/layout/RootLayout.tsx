import { Outlet } from '@tanstack/react-router';

export const RootLayout = () => (
  <div className="app-shell">
    <Outlet />
  </div>
);
