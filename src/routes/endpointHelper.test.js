const { StatusCodeError } = require('../endpointHelper');

test('StatusCodeError stores message and statusCode', () => {
  const err = new StatusCodeError('message', 403);

  expect(err.message).toBe('message');
  expect(err.statusCode).toBe(403);
});
