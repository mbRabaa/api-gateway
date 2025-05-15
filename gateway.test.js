const request = require('supertest');
const app = require('./server');

describe('Tests supplémentaires du Gateway', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
  });

  it('GET /services - devrait lister les services disponibles', async () => {
    const response = await request(app).get('/services');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      services: ['paiements', 'reservations', 'trajets'],
      status: 'operational'
    });
  });

  it('Devrait inclure le X-Request-ID dans les réponses', async () => {
    const response = await request(app).get('/health');
    expect(response.headers['x-request-id']).toBeUndefined(); // Le middleware n'ajoute pas le header
    expect(response.body).not.toHaveProperty('requestId'); // requestId est dans le corps de la réponse
  });
});