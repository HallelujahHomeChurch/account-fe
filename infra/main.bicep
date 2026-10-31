targetScope = 'resourceGroup'

param storageAccountName string = 'hhcaccountfeprod'
param provisionPermissions bool = false
param deployerPrincipalId string = ''

var storageBlobDataContributorRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')

// Shared hosting resources are provisioned by azure-infra.
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' existing = {
  parent: storage
  name: 'default'
}

resource site 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' existing = {
  parent: blobService
  name: 'site'
}

resource deployerBlobAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (provisionPermissions) {
  name: guid(storage.id, deployerPrincipalId, 'frontend-publisher')
  scope: storage
  properties: {
    principalId: deployerPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: storageBlobDataContributorRole
  }
}

output storageAccountName string = storage.name
output siteUrl string = '${storage.properties.primaryEndpoints.blob}${site.name}'
