# 🔐 Função Lambda de Autenticação

## 📋 Visão Geral

Função Lambda que realiza:
1. **Autenticação**: Valida CPF e gera tokens JWT
2. **Autorização**: Valida tokens JWT para o API Gateway

## 🏗️ Arquitetura

```
┌─────────────┐
│   Cliente   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐s
│      Lambda Auth (Duplo)        │
│                                 │
│  Modo 1: Autenticação           │
│  - Recebe CPF                   │
│  - Consulta RDS                 │
│  - Sincroniza com Cognito       │
│  - Gera JWT                     │
│                                 │
│  Modo 2: Autorização            │
│  - Recebe JWT                   │
│  - Valida no Cognito            │
│  - Retorna policy IAM           │
└─────────────────────────────────┘
```

## 📦 Dependências

```json
{
  "@aws-sdk/client-cognito-identity-provider": "^3.490.0",
  "aws-jwt-verify": "^4.0.1",
  "mysql2": "^3.6.5"
}
```

## 🚀 Desenvolvimento Local

### Setup

```bash
# Instalar dependências
npm install

# Copiar variáveis de ambiente
cp .env.example .env

# Editar .env com seus valores
nano .env
```

### Build

```bash
# Criar pacote de deployment
npm run build

# Isso gera lambda.zip contendo src/ e node_modules/
```

### Deploy

```bash
# Publicar no S3 (requer AWS CLI configurado)
npm run deploy

# Ou manualmente
aws s3 cp lambda.zip s3://soat-fast-food-lambda-packages-dev/auth/lambda.zip
```

## 🔧 Variáveis de Ambiente

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `DB_HOST` | Endpoint do RDS | `xxx.rds.amazonaws.com` |
| `DB_PORT` | Porta do banco | `3306` |
| `DB_NAME` | Nome do banco | `fastfood` |
| `DB_USER` | Usuário do banco | `admin` |
| `DB_PASSWORD` | Senha do banco | `SecurePass123!` |
| `COGNITO_USER_POOL_ID` | ID do Cognito User Pool | `us-east-1_XXXXXXXXX` |
| `COGNITO_CLIENT_ID` | ID do Cognito App Client | `xxxxxxxxxxxxx` |
| `AWS_REGION_CUSTOM` | Região AWS | `us-east-1` |

## 📝 Referência da API

### Endpoint de Autenticação

**POST /auth**

Requisição:
```json
{
  "cpf": "12345678900"
}
```

Resposta de Sucesso (200):
```json
{
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600,
  "user": {
    "id": 1,
    "cpf": "12345678900",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

Resposta de Erro (404):
```json
{
  "error": "Customer not found",
  "message": "Cliente não encontrado. Por favor, cadastre-se primeiro."
}
```

### Authorizer

**Evento de Entrada:**
```json
{
  "type": "TOKEN",
  "authorizationToken": "Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "methodArn": "arn:aws:execute-api:us-east-1:123456789012:abcdef123/prod/GET/orders"
}
```

**Saída (Allow):**
```json
{
  "principalId": "user-sub-id",
  "policyDocument": {
    "Version": "2012-10-17",
    "Statement": [{
      "Action": "execute-api:Invoke",
      "Effect": "Allow",
      "Resource": "arn:aws:execute-api:us-east-1:123456789012:abcdef123/prod/GET/orders"
    }]
  },
  "context": {
    "customerId": "1",
    "cpf": "12345678900",
    "email": "user@example.com"
  }
}
```

## 🧪 Testes

### Testar Autenticação Localmente

```javascript
// test-auth.js
const handler = require('./src/index').handler;

const event = {
  body: JSON.stringify({ cpf: '12345678900' })
};

handler(event).then(response => {
  console.log(JSON.stringify(response, null, 2));
});
```

### Testar Authorizer Localmente

```javascript
// test-authorizer.js
const handler = require('./src/index').handler;

const event = {
  type: 'TOKEN',
  authorizationToken: 'Bearer YOUR_JWT_TOKEN',
  methodArn: 'arn:aws:execute-api:us-east-1:123456789012:abcdef123/prod/GET/orders'
};

handler(event).then(response => {
  console.log(JSON.stringify(response, null, 2));
});
```

### Testar via AWS CLI

```bash
# Invocar Lambda
aws lambda invoke \
  --function-name soat-fast-food-auth-dev \
  --payload '{"body":"{\"cpf\":\"12345678900\"}"}' \
  response.json

cat response.json
```

## 📊 Monitoramento

### CloudWatch Logs

```bash
# Seguir logs
aws logs tail /aws/lambda/soat-fast-food-auth-dev --follow

# Filtrar erros
aws logs filter-log-events \
  --log-group-name /aws/lambda/soat-fast-food-auth-dev \
  --filter-pattern "ERROR"
```
