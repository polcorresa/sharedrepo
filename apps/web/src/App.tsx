import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ThemeProvider>
          <RouterProvider router={router} />
        </ThemeProvider>
      </ToastProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
