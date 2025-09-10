#!/bin/bash

# GitHub repository info
OWNER="yjsung-spartan"
REPO="communication-collector"
TOKEN="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"

# Function to add secret
add_secret() {
    SECRET_NAME=$1
    SECRET_VALUE=$2
    
    echo "Adding secret: $SECRET_NAME"
    
    curl -X PUT \
        -H "Authorization: token $TOKEN" \
        -H "Accept: application/vnd.github.v3+json" \
        "https://api.github.com/repos/$OWNER/$REPO/actions/secrets/$SECRET_NAME" \
        -d "{\"encrypted_value\":\"$SECRET_VALUE\",\"key_id\":\"YOUR_KEY_ID\"}"
}

# Add Confluence secrets
add_secret "CONFLUENCE_BASE_URL" "https://fanlight-weplanet.atlassian.net"
add_secret "CONFLUENCE_EMAIL" "project.manager@weplanet.co.kr"
add_secret "CONFLUENCE_API_TOKEN" "ATATT3xFfGF0hABegZbdZqwfI_8e1-dCRrc4W60le8qMPEgMpkGRnVZa7skNTSlT0p0iLbqj8AbCoyPoM14ciHZtS7oczC36ZuvTiFLJp4qCOZXC3JyZvKAfZDEPtHH56uGzJE8C53NEHb4i0NJOhJBZs9oCrTHQN_UCm9JuvboOCeIKuyRRwOA=875F0D6E"
add_secret "CONFLUENCE_SPACES" "DOCS,DEV,PM"

# Add Figma secrets
add_secret "FIGMA_ACCESS_TOKEN" "figd_pPdkTYmBaLqZznGjxxaBT1xup5uIk166DDoBZbPK"
add_secret "FIGMA_FILE_KEYS" "O99LlTEvqCRtqUIAXLEgpw"

echo "Done adding secrets!"