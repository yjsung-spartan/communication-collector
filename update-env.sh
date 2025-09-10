#!/bin/bash
# Update Momgleedu email and redeploy

echo "Updating Momgleedu Confluence email..."
echo "project.manager@weplanet.com" | vercel env add MOMGLEEDU_CONFLUENCE_EMAIL production --force

echo "Redeploying with updated configuration..."
vercel --prod

echo "Deployment complete!"