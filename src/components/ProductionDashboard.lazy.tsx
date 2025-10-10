import { lazy } from 'react';

export const ProductionDashboardLazy = lazy(() =>
  import('./ProductionDashboard').then(module => ({
    default: module.default
  }))
);

export default ProductionDashboardLazy;
