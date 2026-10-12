// Import the necessary modules from 'react-router-dom' for setting up routes
import { createBrowserRouter } from 'react-router-dom'
// Import dynamically loaded components (HomePage, MainLayout, NotFoundPage) using loadable
import {
  HomePage,
  MainLayout,
  NotFoundPage,
  SuratHomePage,
  SuratPage,
} from './loadables'
import SuratPenawaran from '@/pages/surat/suratPenawaran'
import SuratPermintaanBarang from '@/pages/surat/suratPermintaanBarang'
import SuratPesanan from '@/pages/surat/suratPesanan'
import SuratPerjanjianJualBeli from '@/pages/surat/suratPerjanjianJualBeli'

// Create a router configuration using 'createBrowserRouter' to define application routes
export const router = createBrowserRouter([
  {
    // Define the root path '/' for the application
    // The MainLayout component is the main wrapper for the layout of the app
    path: '/',
    element: <MainLayout />,

    // Define the child routes inside the MainLayout, in this case, the homepage
    children: [
      {
        // Define the child route for the home page
        // It loads the HomePage component when the root path is accessed
        path: '',
        element: <HomePage />,
      },
      {
        path: 'surat',
        element: <SuratPage />,
        children: [
          {
            path: '',
            element: <SuratHomePage />,
          },
          {
            path: 'surat-penawaran',
            element: <SuratPenawaran />,
          },
          {
            path: 'surat-permintaan-barang',
            element: <SuratPermintaanBarang />,
          },
          {
            path: 'surat-pesanan',
            element: <SuratPesanan />,
          },
          {
            path: 'surat-perjanjian-jual-beli',
            element: <SuratPerjanjianJualBeli />,
          },
          {
            // Define a wildcard '*' route that will match any path that doesn't exist
            // This route is used to display the NotFoundPage for undefined routes
            path: '*',
            element: <NotFoundPage />,
          },
        ],
      },
      {
        // Define a wildcard '*' route that will match any path that doesn't exist
        // This route is used to display the NotFoundPage for undefined routes
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
  {
    // Define a wildcard '*' route that will match any path that doesn't exist
    // This route is used to display the NotFoundPage for undefined routes
    path: '*',
    element: <NotFoundPage />,
  },
])
