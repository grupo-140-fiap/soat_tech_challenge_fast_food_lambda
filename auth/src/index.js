const { queryCustomerByCPF } = require('./db');
const { syncUserToCognito, generateToken } = require('./cognito');
const { verifyToken, generatePolicy } = require('./jwt-validator');

/**
 * Main Lambda handler - Dual purpose function
 * 1. Authentication: POST /auth endpoint
 * 2. Authorization: API Gateway authorizer
 */
exports.handler = async (event, context) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    // Detect invocation type
    if (event.type === 'TOKEN' || event.authorizationToken) {
      // Authorizer mode
      return await handleAuthorizer(event);
    } else {
      // Authentication mode
      return await handleAuthentication(event);
    }
  } catch (error) {
    console.error('Handler error:', error);
    
    // Return appropriate error based on mode
    if (event.type === 'TOKEN' || event.authorizationToken) {
      throw new Error('Unauthorized');
    } else {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Internal Server Error',
          message: error.message
        })
      };
    }
  }
};

/**
 * Handle authentication request (POST /auth)
 * @param {Object} event - API Gateway event
 * @returns {Object} HTTP response with JWT token
 */
async function handleAuthentication(event) {
  // Parse request body
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (error) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Bad Request',
        message: 'Invalid JSON in request body'
      })
    };
  }

  const { cpf } = body;

  // Validate CPF
  if (!cpf) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Bad Request',
        message: 'CPF is required'
      })
    };
  }

  // Query customer from RDS
  const customer = await queryCustomerByCPF(cpf);

  if (!customer) {
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Customer not found',
        message: 'Cliente não encontrado. Por favor, cadastre-se primeiro.'
      })
    };
  }

  // Sync customer to Cognito
  await syncUserToCognito(customer);

  // Generate JWT token
  const tokens = await generateToken(customer.cpf, customer.email);

  // Return success response
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      token: tokens.IdToken,
      accessToken: tokens.AccessToken,
      refreshToken: tokens.RefreshToken,
      expiresIn: tokens.ExpiresIn,
      user: {
        id: customer.id,
        cpf: customer.cpf,
        email: customer.email,
        name: `${customer.firstName} ${customer.lastName}`
      }
    })
  };
}

/**
 * Handle authorization request (API Gateway Authorizer)
 * @param {Object} event - Authorizer event
 * @returns {Object} IAM policy
 */
async function handleAuthorizer(event) {
  // Extract token from Authorization header
  const token = event.authorizationToken?.replace('Bearer ', '') || '';

  if (!token) {
    throw new Error('Unauthorized');
  }

  try {
    // Verify JWT token
    const payload = await verifyToken(token);

    // Extract user information from token
    const customerId = payload['custom:customer_id'];
    const cpf = payload['custom:cpf'];
    const email = payload.email;

    // Generate Allow policy with user context
    return generatePolicy(
      payload.sub,
      'Allow',
      event.methodArn,
      {
        customerId: customerId || '',
        cpf: cpf || '',
        email: email || ''
      }
    );
  } catch (error) {
    console.error('Authorization failed:', error);
    // Generate Deny policy
    return generatePolicy('user', 'Deny', event.methodArn);
  }
}