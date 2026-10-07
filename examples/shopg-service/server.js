import express from 'express';
import { AccessGate } from '../../packages/accessgate-sdk/src/index.js';

const app = express();
app.use(express.json());

// Initialize AccessGate SDK pointing to AccessGate Auth Server
const auth = new AccessGate({
  issuerUrl: process.env.ACCESSGATE_URL || 'http://localhost:3000',
  cacheTtlMs: 30000, // 30s cache for high throughput
});

// Mock database for ShopG e-commerce store
const mockProducts = [
  { id: 'prod_1', name: 'Mechanical Keyboard', price: 99.99 },
  { id: 'prod_2', name: 'Wireless Mouse', price: 49.99 },
];

const mockOrders = [
  { id: 'ord_1', userId: 'user_123', items: ['prod_1'], total: 99.99 },
];

// -----------------------------------------------------------------------------
// 1. Public Route: Anyone can browse catalog
// -----------------------------------------------------------------------------
app.get('/api/products', (req, res) => {
  res.json({ products: mockProducts });
});

// -----------------------------------------------------------------------------
// 2. Protected Route: Any authenticated user can view their orders
// -----------------------------------------------------------------------------
app.get('/api/orders', auth.requireAuth(), (req, res) => {
  res.json({
    message: 'User orders retrieved successfully',
    user: req.user,
    orders: mockOrders,
  });
});

// -----------------------------------------------------------------------------
// 3. Permission-Protected Route: Requires 'orders:create' fine-grained permission
// -----------------------------------------------------------------------------
app.post(
  '/api/orders',
  auth.requireAuth(),
  auth.requirePermission('orders:create'),
  (req, res) => {
    const { items, total } = req.body;
    const newOrder = {
      id: `ord_${Date.now()}`,
      userId: req.user.id,
      items: items || [],
      total: total || 0,
    };
    mockOrders.push(newOrder);

    res.status(201).json({
      message: 'Order placed successfully',
      order: newOrder,
    });
  }
);

// -----------------------------------------------------------------------------
// 4. Role-Protected Route: Requires 'admin' role to create new products
// -----------------------------------------------------------------------------
app.post(
  '/api/products',
  auth.requireAuth(),
  auth.requireRole('admin'),
  (req, res) => {
    const { name, price } = req.body;
    const newProduct = {
      id: `prod_${Date.now()}`,
      name,
      price: parseFloat(price) || 0,
    };
    mockProducts.push(newProduct);

    res.status(201).json({
      message: 'Product added to catalog by Admin',
      product: newProduct,
    });
  }
);

// -----------------------------------------------------------------------------
// 5. Admin Deletion: Requires 'admin' role to delete orders
// -----------------------------------------------------------------------------
app.delete(
  '/api/orders/:id',
  auth.requireAuth(),
  auth.requireRole('admin'),
  (req, res) => {
    const index = mockOrders.findIndex((o) => o.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const removed = mockOrders.splice(index, 1)[0];
    res.json({ message: 'Order canceled by administrator', order: removed });
  }
);

// Start ShopG service only if run directly
const PORT = process.env.PORT || 4000;
const isDirectRun = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('examples/shopg-service/server.js');
if (isDirectRun) {
  app.listen(PORT, () => {
    console.log(`🛒 ShopG e-commerce service running at http://localhost:${PORT}`);
    console.log(`🔒 Protected by AccessGate at ${auth.issuerUrl}`);
  });
}

export default app;
