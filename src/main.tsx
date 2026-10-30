import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { QueryClient } from '@tanstack/react-query';
import { routeTree } from './routeTree.gen';

// Ensure this path matches your actual CSS filename (e.g. './styles.css' or './index.css')
import './styles.css'; 

const queryClient = new QueryClient();

const router = createRouter({
  routeTree,
  context: { queryClient },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);