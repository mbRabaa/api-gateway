const request = require('supertest');
const axios = require('axios');
const app = require('./server');

jest.mock('axios');

describe('API Gateway - Tests d\'intégration complets', () => {
  beforeAll(() => {
    process.env.PAIEMENT_SERVICE_URL = 'http://paiement-service:3002';
    process.env.RESERVATION_SERVICE_URL = 'http://reservation-service:3004';
    process.env.TRAJET_SERVICE_URL = 'http://trajet-service:3004';
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('GET /health - vérifie que le gateway répond', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'OK',
      gateway: 'operational',
      version: expect.any(String),
      uptime: expect.any(Number),
      timestamp: expect.any(String)
    });
  });

  describe('Proxy vers les services', () => {
    it('POST /api/paiements - proxying vers le service', async () => {
      const mockResponse = {
        status: 201,
        data: { transactionId: 'tx_98765' },
        config: {
          url: 'http://paiement-service:3002/api/paiements'
        }
      };
      axios.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/paiements')
        .send({ amount: 99.99 })
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ transactionId: 'tx_98765' });
    });

    it('GET /api/reservations - proxying vers le service', async () => {
      const mockResponse = {
        status: 200,
        data: [{ id: 1, trajet: 'Tunis-Tozeur' }],
        config: {
          url: 'http://reservation-service:3004/api/reservations'
        }
      };
      axios.mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/api/reservations')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([{ id: 1, trajet: 'Tunis-Tozeur' }]);
    });
  });

  describe('Gestion des erreurs', () => {
    it('Devrait retourner 503 quand un service est indisponible', async () => {
      const mockError = {
        isAxiosError: true,
        response: {
          status: 503,
          data: {
            error: 'Service indisponible',
            details: 'Maintenance en cours'
          },
          config: {
            url: 'http://reservation-service:3004/api/reservations'
          }
        }
      };
      axios.mockRejectedValue(mockError);

      const response = await request(app)
        .get('/api/reservations');

      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        error: 'Service indisponible',
        requestId: expect.any(String),
        timestamp: expect.any(String)
      });
    });

    it('Devrait retourner 500 pour une erreur inattendue', async () => {
      const mockError = new Error('Erreur inconnue');
      mockError.response = {
        status: 500,
        data: {
          error: 'Internal Server Error'
        }
      };
      axios.mockRejectedValue(mockError);

      const response = await request(app)
        .get('/api/trajets');

      
    });
  });

  it('Devrait retourner 404 pour une route inexistante', async () => {
    const response = await request(app)
      .get('/api/route-inexistante');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: 'Endpoint not found',
      requestId: expect.any(String),
      availableEndpoints: expect.any(Array)
    });
  });
});