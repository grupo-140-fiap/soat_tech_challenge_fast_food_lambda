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
    
    await client.send(getUserCommand);
    
    // User exists, update attributes
    const updateCommand = new AdminUpdateUserAttributesCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
      UserAttributes: [
        { Name: 'email', Value: customer.email },
        { Name: 'custom:customer_id', Value: customer.id.toString() },
        { Name: 'custom:cpf', Value: customer.cpf }
      ]
    });
    
    await client.send(updateCommand);
    console.log(`User ${username} updated in Cognito`);
    
  } catch (error) {
    if (error.name === 'UserNotFoundException') {
      // User doesn't exist, create new
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
        TemporaryPassword: generateTemporaryPassword()
      });
      
      await client.send(createCommand);
      
      // Set permanent password (same as temp, user won't use it)
      const setPasswordCommand = new AdminSetUserPasswordCommand({
        UserPoolId: USER_POOL_ID,
        Username: username,
        Password: generateTemporaryPassword(),
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
    const authCommand = new AdminInitiateAuthCommand({
      UserPoolId: USER_POOL_ID,
      ClientId: CLIENT_ID,
      AuthFlow: 'ADMIN_NO_SRP_AUTH',
      AuthParameters: {
        USERNAME: email,
        PASSWORD: generateTemporaryPassword()
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