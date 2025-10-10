import { lazy } from 'react';

export const Iteration43InterfaceLazy = lazy(() =>
  import('./Iteration43Interface').then(module => ({
    default: module.default
  }))
);

export default Iteration43InterfaceLazy;
