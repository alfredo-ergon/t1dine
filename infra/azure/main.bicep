targetScope = 'subscription'

@description('Deployment location')
param location string = 'westeurope'

@description('Environment name such as dev, test, staging, or prod')
param environmentName string

// Bootstrap only. Add reviewed modules through ADR-backed vertical slices.
resource resourceGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: 'rg-t1dine-${environmentName}-${location}'
  location: location
  tags: {
    application: 't1dine'
    environment: environmentName
    dataClassification: 'health-restricted'
  }
}

output resourceGroupName string = resourceGroup.name
