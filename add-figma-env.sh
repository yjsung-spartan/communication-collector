#!/bin/bash
# Add Figma environment variables to Vercel

echo "Adding Figma environment variables..."

# Figma settings
echo "figd_pPdkTYmBaLqZznGjxxaBT1xup5uIk166DDoBZbPK" | vercel env add FIGMA_ACCESS_TOKEN production --force
echo "O99LlTEvqCRtqUIAXLEgpw" | vercel env add FIGMA_FILE_KEYS production --force
echo "Lucy,heather,PM,최지선" | vercel env add FIGMA_CLIENT_AUTHORS production --force
echo "false" | vercel env add FIGMA_INCLUDE_RESOLVED production --force

echo "Environment variables added successfully!"
echo "Redeploying..."

# Redeploy with new environment variables
vercel --prod

echo "Deployment complete!"