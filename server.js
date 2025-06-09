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
app.use(morgan('dev'));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
}));
app.use(express.json({ limit: '10kb' }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Too many requests from this IP, please try again later'
}));

// Configuration des services
const SERVICES = {
  paiements: process.env.PAIEMENT_SERVICE_URL || 'http://localhost:3002/api',
  reservations: process.env.RESERVATION_SERVICE_URL || 'http://localhost:3004',
  trajets: process.env.TRAJET_SERVICE_URL || 'http://localhost:3004'
};

// Middleware de traçage
app.use((req, res, next) => {
  req.requestId = uuidv4();
  console.log(`[${new Date().toISOString()}] [${req.requestId}] ${req.method} ${req.originalUrl} from ${req.ip}`);
  next();
});

// Route pour la racine
app.get('/', (req, res) => {
  res.status(200).json({
    message: "Bienvenue sur l'API Gateway",
    version: process.env.npm_package_version || '1.0.0',
    documentation: process.env.API_DOCS_URL || '/api-docs',
    requestId: req.requestId,
    availableServices: Object.keys(SERVICES),
    healthCheck: '/health',
    servicesList: '/services'
  });
});

// Proxy intelligent
const createServiceProxy = (serviceName) => async (req, res) => {
  try {
    const baseUrl = SERVICES[serviceName];
    let targetPath = req.originalUrl.replace(`/api/${serviceName}`, '') || `/${serviceName}`;
    
    targetPath = targetPath.replace(/\/+/g, '/');
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
      timeout: 15000
    };

    const response = await axios(config);
    res.status(response.status).json(response.data);
  } catch (error) {
    const errorCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.message || 
                        error.message || 
                        'Internal Server Error';

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

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    requestId: req.requestId,
    availableEndpoints: [
      '/',
      '/api/trajets',
      '/api/reservations',
      '/api/paiements',
      '/health',
      '/services'
    ]
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

// Démarrage conditionnel du serveur
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`\n🚀 API Gateway démarré sur http://localhost:${port}`);
    console.log('🔌 Microservices connectés:');
    
    const servicesTable = Object.entries(SERVICES).map(([name, url]) => ({ 
      Service: name, 
      URL: url,
      Status: 'Connected'
    }));
    console.table(servicesTable);
    
    console.log('\n📊 Endpoints utilitaires:');
    console.log('- /\t\t\tPage d\'accueil');
    console.log('- /health\t\tHealth check');
    console.log('- /services\t\tListe des services');
    console.log('\n🛠️ Mode:', process.env.NODE_ENV || 'development');
  });
}

module.exports = app;