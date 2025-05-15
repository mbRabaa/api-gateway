require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 8000;

// Middlewares
app.use(helmet());
app.use(morgan('dev'));  // Format de logs plus lisible
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
}));
app.use(express.json({ limit: '10kb' }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: 'Too many requests from this IP, please try again later'
}));

// Configuration des services
const SERVICES = {
  paiements: process.env.PAIEMENT_SERVICE_URL || 'http://localhost:3002',
  reservations: process.env.RESERVATION_SERVICE_URL || 'http://localhost:3004',
  feedbacks: process.env.FEEDBACK_SERVICE_URL || 'http://localhost:3003',
  trajets: process.env.RESERVATION_SERVICE_URL || 'http://localhost:3004' // Pointant vers reservations
};

// Middleware de traçage amélioré
app.use((req, res, next) => {
  req.requestId = uuidv4();
  console.log(`[${new Date().toISOString()}] [${req.requestId}] ${req.method} ${req.originalUrl} from ${req.ip}`);
  next();
});

// Proxy intelligent avec gestion correcte des trajets
const createServiceProxy = (serviceName) => async (req, res) => {
  try {
    const baseUrl = SERVICES[serviceName];
    let targetPath;

    // Gestion spéciale pour /api/trajets
    if (serviceName === 'trajets') {
      targetPath = req.originalUrl.replace('/api/trajets', '') || '/trajets';
    } else {
      targetPath = req.originalUrl.replace(`/api/${serviceName}`, '') || `/${serviceName}`;
    }

    // Nettoyage du path
    targetPath = targetPath.replace(/\/+/g, '/');  // Supprime les doubles slashes
    if (targetPath.endsWith('/')) targetPath = targetPath.slice(0, -1);

    const url = `${baseUrl}${targetPath}`;
    console.log(`[GATEWAY] Routing ${req.method} ${req.originalUrl} → ${url}`);

    const config = {
      method: req.method,
      url,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': req.requestId,
        ...(req.headers.authorization && { Authorization: req.headers.authorization })
      },
      data: req.body,
      timeout: 15000 // 15s timeout
    };

    const response = await axios(config);
    res.status(response.status).json(response.data);
  } catch (error) {
    const errorCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.message || error.message;
    
    console.error(`[GATEWAY ERROR] ${serviceName}:`, {
      status: errorCode,
      message: errorMessage,
      url: error.config?.url,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });

    res.status(errorCode).json({
      error: errorMessage,
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && {
        details: error.response?.data?.details,
        stack: error.stack
      })
    });
  }
};

// Routes API
app.all('/api/paiements*', createServiceProxy('paiements'));
app.all('/api/reservations*', createServiceProxy('reservations'));
app.all('/api/feedbacks*', createServiceProxy('feedbacks'));
app.all('/api/trajets*', createServiceProxy('trajets'));

// Endpoints utilitaires
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    gateway: 'operational',
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/services', (req, res) => {
  res.json({
    services: Object.keys(SERVICES),
    status: 'operational'
  });
});

// Gestion des erreurs 404 améliorée
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    requestId: req.requestId,
    availableEndpoints: [
      '/api/trajets',
      '/api/reservations',
      '/api/paiements',
      '/api/feedbacks',
      '/health',
      '/services'
    ],
    documentation: process.env.API_DOCS_URL || 'https://example.com/api-docs'
  });
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    error: 'Internal server error',
    requestId: req.requestId,
    timestamp: new Date().toISOString()
  });
});

// Démarrage du serveur
app.listen(port, () => {
  console.log(`\n🚀 API Gateway démarré sur http://localhost:${port}`);
  console.log('🔌 Microservices connectés:');
  console.table(
    Object.entries(SERVICES).map(([name, url]) => ({ 
      Service: name, 
      URL: url,
      Status: 'Connected'
    })
  ));
  console.log('\n📊 Endpoints utilitaires:');
  console.log('- /health\t\tHealth check');
  console.log('- /services\t\tListe des services');
  console.log('\n🛠️ Mode:', process.env.NODE_ENV || 'development');
});