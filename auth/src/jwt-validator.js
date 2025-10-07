const { CognitoJwtVerifier } = require('aws-jwt-verify');

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID;

// Create verifier instance
const verifier = CognitoJwtVerifier.create({
  userPoolId: USER_POOL_ID,
  tokenUse: 'id',
  clientId: CLIENT_ID
});

/**
 * Verify JWT token from Cognito
 * @param {string} token - JWT token to verify
 * @returns {Promise<Object>} Decoded token payload
 * @throws {Error} If token is invalid
 */
async function verifyToken(token) {
  try {
    const payload = await verifier.verify(token);
    return payload;
  } catch (error) {
    console.error('Token verification failed:', error);
    throw new Error('Unauthorized');
  }
}

/**
 * Generate IAM policy for API Gateway
 * @param {string} principalId - User identifier
 * @param {string} effect - 'Allow' or 'Deny'
 * @param {string} resource - API Gateway resource ARN
 * @param {Object} context - Additional context to pass to backend
 * @returns {Object} IAM policy document
 */
function generatePolicy(principalId, effect, resource, context = {}) {
  const authResponse = {
    principalId: principalId
  };

  if (effect && resource) {
    authResponse.policyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource
        }
      ]
    };
  }

  // Add context to pass user info to backend
  if (Object.keys(context).length > 0) {
    authResponse.context = context;
  }

  return authResponse;
}

module.exports = {
  verifyToken,
  generatePolicy
};