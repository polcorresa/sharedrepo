import { RootRoute, Route } from '@tanstack/react-router';
import { RootLayout } from '../components/layout/RootLayout';
import { LandingPage } from '../pages/LandingPage';
import { RepoGate } from '../pages/RepoGate';

const rootRoute = new RootRoute({
  component: RootLayout
});

const landingRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LandingPage
});

const repoRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '$slug',
  component: RepoGate
});

export const routeTree = rootRoute.addChildren([landingRoute, repoRoute]);
