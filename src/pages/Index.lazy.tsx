import { lazy } from 'react';

export const const IndexLazy = lazy(() =>
  import('./Index').then(module => ({
    default: module.default
  }))
);

export default const IndexLazy;
