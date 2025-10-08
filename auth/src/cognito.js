const {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  AdminInitiateAuthCommand,
  AdminGetUserCommand
} = require('@aws-sdk/client-cognito-identity-provider');

const client = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION_CUSTOM || process.env.AWS_REGION || 'us-east-1'
});

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID;
const DEFAULT_PASSWORD_ENV = process.env.COGNITO_DEFAULT_PASSWORD || '';

function buildDefaultPassword(cpf, email) {
  if (DEFAULT_PASSWORD_ENV) return DEFAULT_PASSWORD_ENV;
  // Deterministic password meeting Cognito complexity (upper/lower/number/symbol)
  const last4 = (cpf || '').slice(-4) || '0000';
  return `Aa#${last4}!${(email || 'user').length}`;
}

/**
 * Sync customer data to Cognito User Pool
 * Creates or updates user with customer information
 * @param {Object} customer - Customer data from RDS
 */
async function syncUserToCognito(customer) {
  const username = customer.email;
  
  try {
    // Try to get existing user
    const getUserCommand = new AdminGetUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username
    });
    const getResp = await client.send(getUserCommand);

    // Build current attributes map
    const current = new Map((getResp.UserAttributes || []).map(a => [a.Name, a.Value]));

    // Prepare updates: do NOT update immutable custom:cpf
    const updates = [];
    if (current.get('email') !== customer.email) {
      updates.push({ Name: 'email', Value: customer.email });
    }
    if (current.get('custom:customer_id') !== String(customer.id)) {
      updates.push({ Name: 'custom:customer_id', Value: String(customer.id) });
    }

    if (updates.length > 0) {
      const updateCommand = new AdminUpdateUserAttributesCommand({
        UserPoolId: USER_POOL_ID,
        Username: username,
        UserAttributes: updates
      });
      await client.send(updateCommand);
      console.log(`User ${username} updated in Cognito`);
    } else {
      console.log(`User ${username} already up to date in Cognito`);
    }

    // Ensure a known permanent password to allow ADMIN_NO_SRP_AUTH
    const pwd = buildDefaultPassword(customer.cpf, customer.email);
    const setPasswordCommand = new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
      Password: pwd,
      Permanent: true
    });
    await client.send(setPasswordCommand);
    console.log(`Password ensured for ${username}`);
    
  } catch (error) {
    if (error.name === 'UserNotFoundException') {
      // User doesn't exist, create new
      const tempPwd = buildDefaultPassword(customer.cpf, customer.email);
      const createCommand = new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: username,
        UserAttributes: [
          { Name: 'email', Value: customer.email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'custom:customer_id', Value: customer.id.toString() },
          { Name: 'custom:cpf', Value: customer.cpf }
        ],
        MessageAction: 'SUPPRESS', // Don't send welcome email
        TemporaryPassword: tempPwd
      });
      
      await client.send(createCommand);
      
      // Set permanent password (same as temp, user won't use it)
      const setPasswordCommand = new AdminSetUserPasswordCommand({
        UserPoolId: USER_POOL_ID,
        Username: username,
        Password: tempPwd,
        Permanent: true
      });
      
      await client.send(setPasswordCommand);
      console.log(`User ${username} created in Cognito`);
      
    } else {
      console.error('Error syncing user to Cognito:', error);
      throw error;
    }
  }
}

/**
 * Generate JWT token for user
 * @param {string} cpf - Customer CPF
 * @param {string} email - Customer email
 * @returns {Promise<Object>} Token response with IdToken and RefreshToken
 */
async function generateToken(cpf, email) {
  try {
    const password = buildDefaultPassword(cpf, email);
    const authCommand = new AdminInitiateAuthCommand({
      UserPoolId: USER_POOL_ID,
      ClientId: CLIENT_ID,
      AuthFlow: 'ADMIN_NO_SRP_AUTH',
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password
      }
    });
    
    const response = await client.send(authCommand);
    
    return {
      IdToken: response.AuthenticationResult.IdToken,
      AccessToken: response.AuthenticationResult.AccessToken,
      RefreshToken: response.AuthenticationResult.RefreshToken,
      ExpiresIn: response.AuthenticationResult.ExpiresIn
    };
  } catch (error) {
    console.error('Error generating token:', error);
    throw error;
  }
}

/**
 * Generate a temporary password (not used by users, just for Cognito requirement)
 * @returns {string} Temporary password
 */
function generateTemporaryPassword() {
  // Generate a random password that meets Cognito requirements
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

module.exports = {
  syncUserToCognito,
  generateToken
};
