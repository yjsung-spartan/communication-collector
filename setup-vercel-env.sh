#!/bin/bash

echo "Vercel 환경변수 설정 스크립트"
echo "================================"

# Confluence - Fanlight
vercel env add CONFLUENCE_DOMAIN production <<< "fanlight-weplanet.atlassian.net"
vercel env add CONFLUENCE_EMAIL production <<< "project.manager@weplanet.co.kr"
vercel env add CONFLUENCE_API_TOKEN production <<< "ATATT3xFfGF0iOh6XsGCFlo1ZbGTpGIzLS3wKSoYZXLq3NCVHXW5nSf1AMop9Bmnl_jHOO13v2bokuOEpGtYN9hJiVpuM0wBwQ3XL2eYWwt0ObVaRJgBBVPmYsyaUFwfq-6LHdW3xdoGE_Q1MF8DEPDVLaSK054QCAVtcCyy2aIQwblkerJqrK0=B56A1917"

# Confluence - Momgleedu
vercel env add MOMGLEEDU_CONFLUENCE_DOMAIN production <<< "momgle-edu.atlassian.net"
vercel env add MOMGLEEDU_CONFLUENCE_EMAIL production <<< "project.manager@weplanet.co.kr"
vercel env add MOMGLEEDU_CONFLUENCE_API_TOKEN production <<< "ATATT3xFfGF0iOh6XsGCFlo1ZbGTpGIzLS3wKSoYZXLq3NCVHXW5nSf1AMop9Bmnl_jHOO13v2bokuOEpGtYN9hJiVpuM0wBwQ3XL2eYWwt0ObVaRJgBBVPmYsyaUFwfq-6LHdW3xdoGE_Q1MF8DEPDVLaSK054QCAVtcCyy2aIQwblkerJqrK0=B56A1917"

# Figma
vercel env add FIGMA_ACCESS_TOKEN production <<< "figd_pPdkTYmBaLqZznGjxxaBT1xup5uIk166DDoBZbPK"
vercel env add FIGMA_FILE_KEYS production <<< "O99LlTEvqCRtqUIAXLEgpw"
vercel env add FIGMA_CLIENT_AUTHORS production <<< "Lucy,heather,PM,최지선"
vercel env add FIGMA_INCLUDE_RESOLVED production <<< "false"

# Request Keywords
vercel env add REQUEST_KEYWORDS production <<< "요청,문의,개선,오류,버그,에러,불편,안됨,안돼,추가,변경,이슈,문제,확인,검토,필요,수정,업데이트,반영"
vercel env add URGENT_KEYWORDS production <<< "긴급,급함,ASAP,장애,다운,먹통,중단,멈춤"
vercel env add HIGH_KEYWORDS production <<< "중요,우선,빠른,시급"
vercel env add LOW_KEYWORDS production <<< "검토,고려,제안,아이디어"

# Author Filtering
vercel env add CLIENT_AUTHORS production <<< "heather,client,customer,고객,Lucy,최지선,PM,임자영"
vercel env add INTERNAL_AUTHORS production <<< "iOS,Android,DANIEL,LUCY,LILY,ANDREW,GEUN,WOOJUN,AARON,HAYDEN,project manager,WEPLANET"
vercel env add FILTER_BY_AUTHOR production <<< "true"
vercel env add INCLUDE_INTERNAL production <<< "false"

# Output Directory
vercel env add OUTPUT_DIR production <<< "./exports"

echo ""
echo "환경변수 설정 완료!"
echo "다음 명령어로 재배포하세요:"
echo "vercel --prod"