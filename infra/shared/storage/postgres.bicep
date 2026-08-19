metadata description = 'Creates an Azure Database for PostgreSQL Flexible Server for the FinTech domain services (schema-per-domain: account_schema, transaction_schema, ...).'

// NOT YET WIRED into main.bicep - see infra/README-postgres.md.
// Provisioning target (existing instance vs new server) was deferred by the
// user; this module is ready to wire in once that decision is made.

param name string
param location string = resourceGroup().location
param tags object = {}

param administratorLogin string = 'bankadmin'

@secure()
param administratorLoginPassword string

@allowed(['Standard_B1ms', 'Standard_B2s', 'Standard_D2ds_v4'])
param skuName string = 'Standard_B1ms'
param skuTier string = 'Burstable'

param postgresVersion string = '16'
param databaseName string = 'bankingassistant'
param storageSizeGB int = 32

// POC scope: firewall allows Azure services. Production should use VNet
// integration + private endpoint instead of a public firewall rule.
param allowAzureServices bool = true

resource server 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: skuName
    tier: skuTier
  }
  properties: {
    version: postgresVersion
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorLoginPassword
    storage: {
      storageSizeGB: storageSizeGB
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }

  resource database 'databases' = {
    name: databaseName
  }

  resource firewallAzureServices 'firewallRules' = if (allowAzureServices) {
    name: 'AllowAllAzureServices'
    properties: {
      startIpAddress: '0.0.0.0'
      endIpAddress: '0.0.0.0'
    }
  }
}

output name string = server.name
output fullyQualifiedDomainName string = server.properties.fullyQualifiedDomainName
output databaseName string = databaseName
output administratorLogin string = administratorLogin
