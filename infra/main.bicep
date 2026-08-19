targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the the environment which is used to generate a short unique hash used in all resources.')
param environmentName string

@minLength(1)
@description('Primary location for all resources')
param location string

param resourceGroupName string = ''

param applicationInsightsName string = ''
param logAnalyticsName string = ''

param storageAccountName string = ''
param storageResourceGroupName string = ''
param storageResourceGroupLocation string = location
param storageContainerName string = 'content'
param storageSkuName string // Set in main.parameters.json

param cosmosDbAccountName string = ''

@description('The Azure AI Foundry resource group name. If ommited will be the same as the main resource group')
param foundryResourceGroupName string = ''
@description('The Azure AI Foundry resource name. If ommited will be generated')
param foundryResourceName string = ''
@description('The Azure AI Foundry Project name. If ommited will be generated')
param aiProjectName string = ''


// Look for the desired model in availability table. Default model is gpt-4o-mini:
// https://learn.microsoft.com/azure/ai-services/openai/concepts/models#standard-deployment-model-availability
@description('Location for the Foundry resource group')
@allowed([
  'australiaeast'
  'brazilsouth'
  'canadaeast'
  'eastus'
  'eastus2'
  'francecentral'
  'germanywestcentral'
  'japaneast'
  'koreacentral'
  'northcentralus'
  'norwayeast'
  'polandcentral'
  'southafricanorth'
  'southcentralus'
  'southindia'
  'spaincentral'
  'swedencentral'
  'switzerlandnorth'
  'uksouth'
  'westeurope'
  'westu'
  'westus3'
])
@metadata({
  azd: {
    type: 'location'
  }
})
param foundryResourceGroupLocation string = 'eastus'
param customFoundryResourceGroupLocation string = ''

@description('Array of models to deploy')
param models array = [
  {
    deploymentName: 'gpt-4.1'
    name: 'gpt-4.1'
    format: 'OpenAI'
    version: '2025-04-14'
    skuName: 'GlobalStandard'
    capacity: 120
  }

]


param documentIntelligenceServiceName string = ''
param documentIntelligenceResourceGroupName string = ''
//Document Intelligence new rest api available in eastus, westus2, westeurope. https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/sdk-overview-v4-0?view=doc-intel-4.0.0&tabs=csharp
@allowed(['eastus', 'westus2', 'westeurope'])
param documentIntelligenceResourceGroupLocation string = 'eastus'
param documentIntelligenceSkuName string = 'S0'

param containerAppsEnvironmentName string = ''
param containerRegistryName string = ''

param backendContainerAppName string = ''
param webContainerAppName string = ''
param accountContainerAppName string = ''
param transactionContainerAppName string = ''
param paymentContainerAppName string = ''
param customerContainerAppName string = ''
param loanContainerAppName string = ''
param creditContainerAppName string = ''
param documentContainerAppName string = ''
param communicationContainerAppName string = ''

param agentsType string = 'foundry_v2' // options: azure_chat, foundry_v2
param backendAppExists bool = false
param webAppExists bool = false
param accountAppExists bool = false
param paymentAppExists bool = false
param transactionAppExists bool = false
param customerAppExists bool = false
param loanAppExists bool = false
param creditAppExists bool = false
param documentAppExists bool = false
param communicationAppExists bool = false

@description('Existing Postgres Flexible Server hostname (e.g. banking-assistant-pg.postgres.database.azure.com) - provisioned separately from this deployment, see infra/README-postgres.md')
param postgresHost string
param postgresAdminLogin string = 'bankadmin'
@secure()
param postgresAdminPassword string
param postgresDatabase string = 'bankingassistant'

@description('Entra ID (Azure AD) settings for backend end-user authentication. Leave authEnabled=false until the app registration exists (see docs/entra-app-registration-setup.md).')
param authEnabled bool = false
param azureTenantId string = ''
param azureAdBackendClientId string = ''

// Every service shares the same Postgres server/database - each owns a separate
// schema internally (account_schema, loan_schema, ...), so the connection
// string is identical across services, only the schema referenced by each
// service's own SQLAlchemy models differs.
var postgresConnectionString = 'postgresql+asyncpg://${postgresAdminLogin}:${postgresAdminPassword}@${postgresHost}:5432/${postgresDatabase}?ssl=require'


var abbrs = loadJsonContent('shared/abbreviations.json')
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var tags = { 'azd-env-name': environmentName, 'assignedTo': environmentName }

// Organize resources in a resource group
resource resourceGroup 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: !empty(resourceGroupName) ? resourceGroupName : '${abbrs.resourcesResourceGroups}${environmentName}'
  location: location
  tags: tags
}

resource foundryResourceGroup 'Microsoft.Resources/resourceGroups@2021-04-01' existing = if (!empty(foundryResourceGroupName)) {
  name: !empty(foundryResourceGroupName) ? foundryResourceGroupName : resourceGroup.name
}

resource documentIntelligenceResourceGroup 'Microsoft.Resources/resourceGroups@2021-04-01' existing = if (!empty(documentIntelligenceResourceGroupName)) {
  name: !empty(documentIntelligenceResourceGroupName) ? documentIntelligenceResourceGroupName : resourceGroup.name
}



resource storageResourceGroup 'Microsoft.Resources/resourceGroups@2021-04-01' existing = if (!empty(storageResourceGroupName)) {
  name: !empty(storageResourceGroupName) ? storageResourceGroupName : resourceGroup.name
}

// Monitor application with Azure Monitor
module monitoring 'shared/monitor/monitoring.bicep' = {
  name: 'monitoring'
  scope: resourceGroup
  params: {
    location: location
    tags: tags
    applicationInsightsName: !empty(applicationInsightsName) ? applicationInsightsName : '${abbrs.insightsComponents}${resourceToken}'
    logAnalyticsName: !empty(logAnalyticsName) ? logAnalyticsName : '${abbrs.operationalInsightsWorkspaces}${resourceToken}'
  }
}


module containerApps 'shared/host/container-apps.bicep' = {
  name: 'container-apps'
  scope: resourceGroup
  params: {
    name: 'app'
    location: location
    tags: tags
    containerAppsEnvironmentName: !empty(containerAppsEnvironmentName) ? containerAppsEnvironmentName : '${abbrs.appManagedEnvironments}${resourceToken}'
    containerRegistryName: !empty(containerRegistryName) ? containerRegistryName : '${abbrs.containerRegistryRegistries}${resourceToken}'
    logAnalyticsWorkspaceName: monitoring.outputs.logAnalyticsWorkspaceName
    applicationInsightsName: monitoring.outputs.applicationInsightsName
  }
}

// Copilot backend
module backend 'app/backend.bicep' = {
  name: 'backend'
  scope: resourceGroup
  params: {
    name: !empty(backendContainerAppName) ? backendContainerAppName : '${abbrs.appContainerApps}backend-${resourceToken}'
    location: location
    tags: tags
    identityName: '${abbrs.managedIdentityUserAssignedIdentities}backend-${resourceToken}'
    applicationInsightsName: monitoring.outputs.applicationInsightsName
    containerAppsEnvironmentName: containerApps.outputs.environmentName
    containerRegistryName: containerApps.outputs.registryName
    corsAcaUrl: ''
    exists: backendAppExists
    env: [
      {
        name: 'AZURE_STORAGE_ACCOUNT'
        value: storage.outputs.name
      }
      {
        name: 'AZURE_STORAGE_CONTAINER'
        value: storageContainerName
      }
      {
        name: 'AZURE_AI_PROJECT_ENDPOINT'
        value:  '${aiFoundry.outputs.endpoint}api/projects/${aiFoundry.outputs.aiProjectName}/'
      }
      {
        name: 'AZURE_AI_MODEL_DEPLOYMENT_NAME'
        value: models[0].deploymentName
      }
      {
        name: 'AZURE_OPENAI_ENDPOINT'
        value:  aiFoundry.outputs.openAIEndpoint
      }
      {
        name: 'AZURE_OPENAI_CHAT_DEPLOYMENT_NAME'
        value: models[0].deploymentName
      }
      {
        name: 'AZURE_DOCUMENT_INTELLIGENCE_SERVICE'
        value: documentIntelligence.outputs.name
      }
      {
        name: 'TRANSACTION_MCP_URL'
        value: '${transaction.outputs.SERVICE_API_URI}/mcp'
      }
      {
        name: 'PAYMENT_MCP_URL'
        value: payment.outputs.SERVICE_API_URI
      }
      {
        name: 'ACCOUNT_MCP_URL'
        value: '${account.outputs.SERVICE_API_URI}/mcp'
      }
      {
        name: 'CUSTOMER_MCP_URL'
        value: '${customer.outputs.SERVICE_API_URI}/mcp'
      }
      {
        name: 'CUSTOMER_SERVICE_URL'
        value: customer.outputs.SERVICE_API_URI
      }
      {
        name: 'LOAN_MCP_URL'
        value: '${loan.outputs.SERVICE_API_URI}/mcp'
      }
      {
        name: 'CREDIT_MCP_URL'
        value: '${credit.outputs.SERVICE_API_URI}/mcp'
      }
      {
        name: 'DOCUMENT_MCP_URL'
        value: '${document.outputs.SERVICE_API_URI}/mcp'
      }
      {
        name: 'COMMUNICATION_MCP_URL'
        value: '${communication.outputs.SERVICE_API_URI}/mcp'
      }
      {
        name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
        value: monitoring.outputs.applicationInsightsInstrumentationKey
      }
      {
        name: 'AGENTS_TYPE'
        value: agentsType
      }
      {
        name: 'AZURE_COSMOSDB_ENDPOINT'
        value: cosmosDb.outputs.endpoint
      }
      {
        name: 'AZURE_COSMOSDB_DATABASE'
        value: cosmosDb.outputs.databaseName
      }
      {
        name: 'AUTH_ENABLED'
        value: string(authEnabled)
      }
      {
        name: 'AZURE_TENANT_ID'
        value: azureTenantId
      }
      {
        name: 'AZURE_AD_BACKEND_CLIENT_ID'
        value: azureAdBackendClientId
      }
    ]
  }
}

// Business Account Api
module account 'app/account.bicep' = {
  name: 'account'
  scope: resourceGroup
  params: {
    name: !empty(accountContainerAppName) ? accountContainerAppName : '${abbrs.appContainerApps}account-${resourceToken}'
    location: location
    tags: tags
    identityName: '${abbrs.managedIdentityUserAssignedIdentities}account-${resourceToken}'
    applicationInsightsName: monitoring.outputs.applicationInsightsName
    containerAppsEnvironmentName: containerApps.outputs.environmentName
    containerRegistryName: containerApps.outputs.registryName
    corsAcaUrl: ''
    exists: accountAppExists
    databaseUrl: postgresConnectionString

  }
}

// Business Transactions Api
module transaction 'app/transaction.bicep' = {
  name: 'transaction'
  scope: resourceGroup
  params: {
    name: !empty(transactionContainerAppName) ? transactionContainerAppName : '${abbrs.appContainerApps}transaction-${resourceToken}'
    location: location
    tags: tags
    identityName: '${abbrs.managedIdentityUserAssignedIdentities}transaction-${resourceToken}'
    applicationInsightsName: monitoring.outputs.applicationInsightsName
    containerAppsEnvironmentName: containerApps.outputs.environmentName
    containerRegistryName: containerApps.outputs.registryName
    corsAcaUrl: ''
    exists: transactionAppExists
    databaseUrl: postgresConnectionString
    env: [
      {
        name: 'ACCOUNT_SERVICE_URL'
        value: account.outputs.SERVICE_API_URI
      }
    ]

  }
}

// Business Payment Api
module payment 'app/payment.bicep' = {
  name: 'payment'
  scope: resourceGroup
  params: {
    name: !empty(paymentContainerAppName) ? paymentContainerAppName : '${abbrs.appContainerApps}payment-${resourceToken}'
    location: location
    tags: tags
    identityName: '${abbrs.managedIdentityUserAssignedIdentities}payment-${resourceToken}'
    applicationInsightsName: monitoring.outputs.applicationInsightsName
    containerAppsEnvironmentName: containerApps.outputs.environmentName
    containerRegistryName: containerApps.outputs.registryName
    corsAcaUrl: ''
    exists: paymentAppExists
    databaseUrl: postgresConnectionString
    env: [
      {
        name: 'ACCOUNT_SERVICE_URL'
        value: account.outputs.SERVICE_API_URI
      }
      {
        name: 'TRANSACTION_SERVICE_URL'
        value: transaction.outputs.SERVICE_API_URI
      }
    ]

  }
}

// Business Customer Api - source of truth for customer_id/role, used by backend auth
module customer 'app/customer.bicep' = {
  name: 'customer'
  scope: resourceGroup
  params: {
    name: !empty(customerContainerAppName) ? customerContainerAppName : '${abbrs.appContainerApps}customer-${resourceToken}'
    location: location
    tags: tags
    identityName: '${abbrs.managedIdentityUserAssignedIdentities}customer-${resourceToken}'
    applicationInsightsName: monitoring.outputs.applicationInsightsName
    containerAppsEnvironmentName: containerApps.outputs.environmentName
    containerRegistryName: containerApps.outputs.registryName
    corsAcaUrl: ''
    exists: customerAppExists
    databaseUrl: postgresConnectionString
  }
}

// Business Loan Api
module loan 'app/loan.bicep' = {
  name: 'loan'
  scope: resourceGroup
  params: {
    name: !empty(loanContainerAppName) ? loanContainerAppName : '${abbrs.appContainerApps}loan-${resourceToken}'
    location: location
    tags: tags
    identityName: '${abbrs.managedIdentityUserAssignedIdentities}loan-${resourceToken}'
    applicationInsightsName: monitoring.outputs.applicationInsightsName
    containerAppsEnvironmentName: containerApps.outputs.environmentName
    containerRegistryName: containerApps.outputs.registryName
    corsAcaUrl: ''
    exists: loanAppExists
    databaseUrl: postgresConnectionString
  }
}

// Business Credit Api
module credit 'app/credit.bicep' = {
  name: 'credit'
  scope: resourceGroup
  params: {
    name: !empty(creditContainerAppName) ? creditContainerAppName : '${abbrs.appContainerApps}credit-${resourceToken}'
    location: location
    tags: tags
    identityName: '${abbrs.managedIdentityUserAssignedIdentities}credit-${resourceToken}'
    applicationInsightsName: monitoring.outputs.applicationInsightsName
    containerAppsEnvironmentName: containerApps.outputs.environmentName
    containerRegistryName: containerApps.outputs.registryName
    corsAcaUrl: ''
    exists: creditAppExists
    databaseUrl: postgresConnectionString
  }
}

// Business Document Api - generates statements/receipts/loan letters from other services
module document 'app/document.bicep' = {
  name: 'document'
  scope: resourceGroup
  params: {
    name: !empty(documentContainerAppName) ? documentContainerAppName : '${abbrs.appContainerApps}document-${resourceToken}'
    location: location
    tags: tags
    identityName: '${abbrs.managedIdentityUserAssignedIdentities}document-${resourceToken}'
    applicationInsightsName: monitoring.outputs.applicationInsightsName
    containerAppsEnvironmentName: containerApps.outputs.environmentName
    containerRegistryName: containerApps.outputs.registryName
    corsAcaUrl: ''
    exists: documentAppExists
    databaseUrl: postgresConnectionString
    env: [
      {
        name: 'ACCOUNT_SERVICE_URL'
        value: account.outputs.SERVICE_API_URI
      }
      {
        name: 'TRANSACTION_SERVICE_URL'
        value: transaction.outputs.SERVICE_API_URI
      }
      {
        name: 'PAYMENT_SERVICE_URL'
        value: payment.outputs.SERVICE_API_URI
      }
      {
        name: 'LOAN_SERVICE_URL'
        value: loan.outputs.SERVICE_API_URI
      }
    ]
  }
}

// Business Communication Api
module communication 'app/communication.bicep' = {
  name: 'communication'
  scope: resourceGroup
  params: {
    name: !empty(communicationContainerAppName) ? communicationContainerAppName : '${abbrs.appContainerApps}communication-${resourceToken}'
    location: location
    tags: tags
    identityName: '${abbrs.managedIdentityUserAssignedIdentities}communication-${resourceToken}'
    applicationInsightsName: monitoring.outputs.applicationInsightsName
    containerAppsEnvironmentName: containerApps.outputs.environmentName
    containerRegistryName: containerApps.outputs.registryName
    corsAcaUrl: ''
    exists: communicationAppExists
    databaseUrl: postgresConnectionString
  }
}

module web 'app/web.bicep' = {
  name: 'web'
  scope: resourceGroup
  params: {
    name: !empty(webContainerAppName) ? webContainerAppName : '${abbrs.appContainerApps}web-${resourceToken}'
    location: location
    tags: tags
    identityName: '${abbrs.managedIdentityUserAssignedIdentities}web-${resourceToken}'
    apiBaseUrl:  backend.outputs.SERVICE_API_URI
    transactionApiUrl: transaction.outputs.SERVICE_API_URI
    accountApiUrl: account.outputs.SERVICE_API_URI
    applicationInsightsName: monitoring.outputs.applicationInsightsName
    containerAppsEnvironmentName: containerApps.outputs.environmentName
    containerRegistryName: containerApps.outputs.registryName
    exists: webAppExists
  }
}


// module openAi 'shared/ai/cognitiveservices.bicep' =  {
//   name: 'openai'
//   scope: openAiResourceGroup
//   params: {
//     name: !empty(openAiServiceName) ? openAiServiceName : '${abbrs.cognitiveServicesAccounts}${resourceToken}'
//     location: !empty(customOpenAiResourceGroupLocation) ? customOpenAiResourceGroupLocation : openAiResourceGroupLocation
//     tags: tags
//     sku: {
//       name: openAiSkuName
//     }
//     deployments: [
//       {
//         name: chatGptDeploymentName
//         model: {
//           format: 'OpenAI'
//           name: chatGptModelName
//           version: chatGptModelVersion
//         }
//         sku: {
//           name: chatGptDeploymentSkuName
//           capacity: chatGptDeploymentCapacity
//         }
//       }
      
//     ]
//   }
// }

module aiFoundry 'shared/ai/foundry.bicep' = {
 name: 'ai-foundry'
 scope: foundryResourceGroup
  params: {
    aiProjectName: !empty(aiProjectName) ? aiProjectName : 'proj-${resourceToken}'
    aiProjectFriendlyName: 'Banking Assistant Project'
    aiProjectDescription: 'Project for the Banking Assistant Copilot using Azure AI Foundry'
    foundryResourceName: !empty(foundryResourceName) ? foundryResourceName : 'foundry-${resourceToken}'
    location: foundryResourceGroupLocation
    tags: tags
  }
}

@batchSize(1)
module foundryModelDeployments 'shared/ai/foundry-model-deployment.bicep' = [for (model, index) in models: {
  name: 'foundry-model-deployment-${model.name}-${index}'
  scope: foundryResourceGroup
   params: {
    foundryResourceName: aiFoundry.outputs.accountName
    deploymentName: model.deploymentName
    modelName: model.name
    modelFormat: model.format
    modelVersion: model.version
    modelSkuName: model.skuName
    modelCapacity: model.capacity
    tags: tags
  }
}]



module documentIntelligence 'shared/ai/cognitiveservices.bicep' = {
  name: 'documentIntelligence'
  scope: documentIntelligenceResourceGroup
  params: {
    name: !empty(documentIntelligenceServiceName) ? documentIntelligenceServiceName : '${abbrs.cognitiveServicesFormRecognizer}${resourceToken}'
    kind: 'FormRecognizer'
    location: documentIntelligenceResourceGroupLocation
    tags: tags
    sku: {
      name: documentIntelligenceSkuName
    }
  }
}



module storage 'shared/storage/storage-account.bicep' = {
  name: 'storage'
  scope: storageResourceGroup
  params: {
    name: !empty(storageAccountName) ? storageAccountName : '${abbrs.storageStorageAccounts}${resourceToken}'
    location: storageResourceGroupLocation
    tags: tags
    allowBlobPublicAccess: false
    publicNetworkAccess: 'Enabled'
    sku: {
      name: storageSkuName
    }
    deleteRetentionPolicy: {
      enabled: true
      days: 2
    }
    containers: [
      {
        name: storageContainerName
        publicAccess: 'None'
      }
    ]
  }
}


// Azure Cosmos DB for NoSQL – ChatKit metadata store
module cosmosDb 'shared/storage/cosmosdb.bicep' = {
  name: 'cosmosdb'
  scope: resourceGroup
  params: {
    name: !empty(cosmosDbAccountName) ? cosmosDbAccountName : '${abbrs.documentDBDatabaseAccounts}${resourceToken}'
    location: location
    tags: tags
  }
}


// SYSTEM IDENTITIES

module foundryCognitiveUserRoleBackend 'shared/security/role.bicep' =  {
  scope: foundryResourceGroup
  name: 'foundry-cognitive-user-role-backend'
  params: {
    principalId: backend.outputs.SERVICE_API_IDENTITY_PRINCIPAL_ID
    roleDefinitionId: '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'
    principalType: 'ServicePrincipal'
  }
}

module foundryAIDeveloperRoleBackend 'shared/security/role.bicep' =  {
  scope: foundryResourceGroup
  name: 'foundry-ai-developerrole-backend'
  params: {
    principalId: backend.outputs.SERVICE_API_IDENTITY_PRINCIPAL_ID
    roleDefinitionId: '64702f94-c441-49e6-a78b-ef80e0188fee'
    principalType: 'ServicePrincipal'
  }
}

module storageRoleBackend 'shared/security/role.bicep' = {
  scope: storageResourceGroup
  name: 'storage-role-backend'
  params: {
    principalId: backend.outputs.SERVICE_API_IDENTITY_PRINCIPAL_ID
    roleDefinitionId: 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
    principalType: 'ServicePrincipal'
  }
}

module documentIntelligenceRoleBackend 'shared/security/role.bicep' = {
  scope: documentIntelligenceResourceGroup
  name: 'documentIntelligence-role-backend'
  params: {
    principalId: backend.outputs.SERVICE_API_IDENTITY_PRINCIPAL_ID
    roleDefinitionId: 'a97b65f3-24c7-4388-baec-2e87135dc908'
    principalType: 'ServicePrincipal'
  }
}

// Cosmos DB Built-in Data Contributor (00000000-0000-0000-0000-000000000002) for backend managed identity
module cosmosDbRoleBackend 'shared/security/cosmosdb-role.bicep' = {
  scope: resourceGroup
  name: 'cosmosdb-role-backend'
  params: {
    cosmosDbAccountName: cosmosDb.outputs.name
    principalId: backend.outputs.SERVICE_API_IDENTITY_PRINCIPAL_ID
  }
}

output AZURE_LOCATION string = location
output AZURE_TENANT_ID string = tenant().tenantId
output AZURE_RESOURCE_GROUP string = resourceGroup.name


output AZURE_CONTAINER_ENVIRONMENT_NAME string = containerApps.outputs.environmentName
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = containerApps.outputs.registryLoginServer
output AZURE_CONTAINER_REGISTRY_NAME string = containerApps.outputs.registryName

// Shared by all OpenAI deployments


// Specific to Azure Foundry
output FOUNDRY_PROJECT_ENDPOINT string =  '${aiFoundry.outputs.endpoint}api/projects/${aiFoundry.outputs.aiProjectName}/'
output FOUNDRY_RESOURCE_NAME string = aiFoundry.outputs.accountName
output FOUNDRY_CHATGPT_DEPLOYMENT string = models[0].deploymentName


output AZURE_DOCUMENT_INTELLIGENCE_SERVICE string = documentIntelligence.outputs.name
output AZURE_DOCUMENT_INTELLIGENCE_RESOURCE_GROUP string = documentIntelligenceResourceGroup.name


output AZURE_STORAGE_ACCOUNT string = storage.outputs.name
output AZURE_STORAGE_CONTAINER string = storageContainerName
output AZURE_STORAGE_RESOURCE_GROUP string = storageResourceGroup.name
output AGENTS_TYPE string = agentsType
output AZURE_COSMOSDB_ENDPOINT string = cosmosDb.outputs.endpoint
output AZURE_COSMOSDB_DATABASE string = cosmosDb.outputs.databaseName

output CUSTOMER_SERVICE_URI string = customer.outputs.SERVICE_API_URI
output LOAN_SERVICE_URI string = loan.outputs.SERVICE_API_URI
output CREDIT_SERVICE_URI string = credit.outputs.SERVICE_API_URI
output DOCUMENT_SERVICE_URI string = document.outputs.SERVICE_API_URI
output COMMUNICATION_SERVICE_URI string = communication.outputs.SERVICE_API_URI



// output BACKEND_URI string = backend.outputs.uri
// output INDEXER_FUNCTIONAPP_NAME string = indexer.outputs.name
