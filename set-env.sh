#!/bin/bash
# Set Vercel environment variables

echo "Setting Momgleedu Confluence environment variables..."

# Momgleedu Confluence settings
vercel env add MOMGLEEDU_CONFLUENCE_DOMAIN production --force <<< "momgleedu.atlassian.net"
vercel env add MOMGLEEDU_CONFLUENCE_EMAIL production --force <<< "momgleeduAPI"
vercel env add MOMGLEEDU_CONFLUENCE_API_TOKEN production --force <<< "ATCTT3xFfGN06MUMfQFd5TSrESQHwP-xht5xeGqqjc1t58epvjByLCnEOT3KBT125LZc312aZjuhcCYI_dTaaPEWzfg25UAbBu97Ha4VuFtaaeW50Eqa_MAmmswgJZJPRnmMyEPbON0lrlK0pRxq8q1VYbQiud-j7YiIvr7e26_1d77Rijht3Bo=41E997CD"
vercel env add MOMGLEEDU_ORG_ID production --force <<< "6b1d42ad-47d6-4844-8d59-34b8d59148a1"

echo "Environment variables set successfully!"
echo "Redeploying..."

# Redeploy with new environment variables
vercel --prod

echo "Deployment complete!"