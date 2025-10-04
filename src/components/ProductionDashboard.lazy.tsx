import { lazy } from 'react';

export const const ProductionDashboardLazy = lazy(() =>
  import('./ProductionDashboard').then(module => ({
    default: module.default
  }))
);

export default const ProductionDashboardLazy;
