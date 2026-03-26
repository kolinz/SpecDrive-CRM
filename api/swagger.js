const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Demo CRM API',
      version: '0.1.0',
      description: 'Demo CRM REST API ドキュメント',
    },
    servers: [
      { url: '/api',  description: 'API サーバー（Nginx経由 port 8080）' },
      { url: 'http://localhost:3000/api', description: 'API サーバー（直接接続 port 3000）' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./routes/*.js'],
};

module.exports = swaggerJsdoc(options);
