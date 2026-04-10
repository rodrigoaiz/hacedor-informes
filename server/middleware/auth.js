const basicAuth = require('basic-auth');

function authMiddleware(req, res, next) {
  const expectedUser = process.env.BASIC_AUTH_USER;
  const expectedPass = process.env.BASIC_AUTH_PASS;

  if (!expectedUser || !expectedPass) {
    return next();
  }

  const credentials = basicAuth(req);

  if (!credentials || credentials.name !== expectedUser || credentials.pass !== expectedPass) {
    res.set('WWW-Authenticate', 'Basic realm="Hace Reportes"');
    return res.status(401).json({ error: 'No autorizado.' });
  }

  return next();
}

module.exports = {
  authMiddleware,
};
