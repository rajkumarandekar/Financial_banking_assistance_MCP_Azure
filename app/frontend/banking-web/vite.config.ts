import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const backendTarget = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    port: 5170,
    host: "0.0.0.0",
    proxy: {
      // Proxy API requests to local backend server on port 8080
      '/api/accounts/': {
        target: 'http://localhost:8070',
        changeOrigin: true
      },
      '/api/cards/': {
        target: 'http://localhost:8070',
        changeOrigin: true
      },
      '/api/transactions/': {
        target: 'http://localhost:8071',
        changeOrigin: true
      },
      // The payment/customer/loan/credit/document/communication services
      // only expose GraphQL (no REST), so proxy a dedicated path per
      // service straight to its /graphql endpoint.
      '/api/graphql/payment': {
        target: 'http://localhost:8072',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/graphql\/payment/, '/graphql'),
      },
      '/api/graphql/investment': {
        target: 'http://localhost:8078',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/graphql\/investment/, '/graphql'),
      },
      '/api/graphql/customer': {
        target: 'http://localhost:8073',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/graphql\/customer/, '/graphql'),
      },
      '/api/graphql/loan': {
        target: 'http://localhost:8074',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/graphql\/loan/, '/graphql'),
      },
      '/api/graphql/credit': {
        target: 'http://localhost:8075',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/graphql\/credit/, '/graphql'),
      },
      '/api/graphql/document': {
        target: 'http://localhost:8076',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/graphql\/document/, '/graphql'),
      },
      '/api/graphql/communication': {
        target: 'http://localhost:8077',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/graphql\/communication/, '/graphql'),
      },
       "/chatkit": {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
      "/upload": {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
      "/preview": {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
