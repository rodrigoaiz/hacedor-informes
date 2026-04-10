const path = require('path');
const express = require('express');

const { authMiddleware } = require('./middleware/auth');
const { reportsRouter } = require('./routes/reports');

const app = express();
const port = Number(process.env.PORT || process.env.API_PORT || 4324);

app.disable('x-powered-by');
app.use(express.json({ limit: '512kb' }));
app.use(authMiddleware);
app.use('/api', reportsRouter);

// In production, serve the Astro build output
const distDir = path.resolve(__dirname, '..', 'dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(distDir));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`API lista en http://localhost:${port}`);
});
