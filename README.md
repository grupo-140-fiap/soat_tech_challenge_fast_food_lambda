 # 🔐 SOAT Fast Food - Funções Lambda
 
 ## 📋 Visão Geral
 
 Este repositório contém funções serverless (Lambda) para o sistema de autenticação do SOAT Fast Food.
 
 ## 🏗️ Arquitetura
 
 ```
 ┌─────────────┐
 │   Cliente   │
 └──────┬──────┘
        │
        ▼
 ┌─────────────────┐
 │  API Gateway    │
 └────────┬────────┘
          │
          ▼
 ┌──────────────────────┐
 │  Lambda Auth         │
 │  (Duplo Propósito)   │
 │                      │
 │  1. Autenticação     │
 │  2. Autorização      │
 └─────┬────────────┬───┘
       │            │
       ▼            ▼
 ┌──────────┐  ┌─────────────┐
 │   RDS    │  │   Cognito   │
 │  MySQL   │  │  User Pool  │
 └──────────┘  └─────────────┘
 ```
 
 ## 📦 Funções
 
 ### Auth Lambda (`auth/`)
 
 Função Lambda de duplo propósito que realiza:
 
 1. **Autenticação** (POST /auth)
    - Recebe CPF
    - Consulta cliente no RDS
    - Sincroniza usuário no Cognito
    - Gera token JWT
 
 2. **Autorização** (API Gateway Authorizer)
    - Valida tokens JWT
    - Retorna policy IAM
    - Repasa contexto do usuário ao backend
 
 **Stack:**
 - Runtime: Node.js 20.x
 - Dependências: AWS SDK, mysql2, aws-jwt-verify
 
 [📖 Documentação Completa](auth/README.md)
 
 ## 🚀 Início Rápido
 
 ### Pré-requisitos
 
 - Node.js 20.x
 - AWS CLI configurado
 - Acesso à conta AWS
 
 ### Setup
 
 ```bash
 # Clonar repositório
 git clone
 cd soat_tech_challenge_fast_food_lambda
 
 # Instalar dependências
 cd auth
 npm install
 
 # Configurar ambiente
 cp .env.example .env
 # Edite o .env com seus valores
 ```
 
 ### Desenvolvimento Local
 
 ```bash
 # Build do pacote
 npm run build
 
 # Deploy para S3
 npm run deploy
 ```
 
 ### Deploy Automatizado
 
 Push na branch `main` dispara o deploy automático via GitHub Actions.
 
 ```bash
 git add .
 git commit -m "Update Lambda function"
 git push origin main
 ```
 
 ## 🔧 Configuração
 
 ### Variáveis de Ambiente
 
 Cada função Lambda requer variáveis específicas. Consulte o README da função para detalhes.
 
 ### Recursos AWS Necessários
 
 - **RDS MySQL**: Banco de clientes
 - **Cognito User Pool**: Autenticação de usuários
 - **S3 Bucket**: Armazenamento de pacotes da Lambda
 - **VPC**: Subnets privadas para acesso ao RDS
 - **IAM Roles**: Permissões de execução da Lambda
 
 ## 📊 Pipeline de CI/CD
 
 ### Workflows do GitHub Actions
 
 - **deploy-auth.yml**: Publica a Lambda de auth ao fazer push na main
 
 ### Etapas do Pipeline
 
 1. ✅ Checkout do código
 2. ✅ Setup do Node.js 20
 3. ✅ Instalação de dependências
 4. ✅ Criação do pacote de deployment
 5. ✅ Upload para S3
 6. ✅ Atualização da função Lambda
 7. ✅ Execução de testes
 
 ### Segredos Necessários
 
 Configure nos settings do repositório GitHub:
 
 - `AWS_ACCESS_KEY_ID`: Access key da AWS
 - `AWS_SECRET_ACCESS_KEY`: Secret key da AWS
 
 ## 🧪 Testes
 
 ### Testes Unitários
 
 ```bash
 cd auth
 npm test
 ```
 
 ### Testes de Integração
 
 ```bash
 # Testar via AWS CLI
 aws lambda invoke \
   --function-name soat-fast-food-auth-dev \
   --payload '{"body":"{\"cpf\":\"12345678900\"}"}' \
   response.json
 
 cat response.json
 ```
 
 ### Testes de API
 
 ```bash
 # Testar endpoint de autenticação
 curl -X POST https://sua-url-do-api-gateway/auth \
   -H "Content-Type: application/json" \
   -d '{"cpf":"12345678900"}'
 
 # Testar endpoint protegido com token
 curl -X GET https://sua-url-do-api-gateway/orders \
   -H "Authorization: Bearer SEU_JWT_TOKEN"
 ```
 
 ## 📈 Monitoramento
 
 ### CloudWatch Logs
 
 ```bash
 # Ver logs
 aws logs tail /aws/lambda/soat-fast-food-auth-dev --follow
 
 # Filtrar erros
 aws logs filter-log-events \
   --log-group-name /aws/lambda/soat-fast-food-auth-dev \
   --filter-pattern "ERROR"
 ```
