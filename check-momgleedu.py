import requests
import json
from datetime import datetime, timedelta
import base64

# API 설정
auth_str = 'project.manager@weplanet.co.kr:ATATT3xFfGF0iOh6XsGCFlo1ZbGTpGIzLS3wKSoYZXLq3NCVHXW5nSf1AMop9Bmnl_jHOO13v2bokuOEpGtYN9hJiVpuM0wBwQ3XL2eYWwt0ObVaRJgBBVPmYsyaUFwfq-6LHdW3xdoGE_Q1MF8DEPDVLaSK054QCAVtcCyy2aIQwblkerJqrK0=B56A1917'
auth = base64.b64encode(auth_str.encode()).decode()

headers = {
    'Authorization': f'Basic {auth}',
    'Accept': 'application/json'
}

# 지난주 날짜 범위
today = datetime.now()
last_week_start = today - timedelta(days=today.weekday() + 7)
last_week_end = last_week_start + timedelta(days=6)

print("Daily Request Analysis - Momgleedu")
print(f"Date Range: {last_week_start.strftime('%Y-%m-%d')} ~ {last_week_end.strftime('%Y-%m-%d')}")
print("=" * 60)

# Confluence 페이지 조회
try:
    response = requests.get(
        'https://momgle-edu.atlassian.net/wiki/rest/api/content',
        params={'limit': 20, 'type': 'page', 'expand': 'history.lastUpdated'},
        headers=headers
    )
    pages = response.json().get('results', [])
    
    print(f"\n[API Call] Momgleedu Confluence")
    print(f"- Total Pages Found: {len(pages)}")
    
    # 지난주 수정된 페이지 필터링
    last_week_pages = []
    for page in pages:
        last_updated = page.get('history', {}).get('lastUpdated', {}).get('when', '')
        if last_updated:
            update_date = datetime.fromisoformat(last_updated.replace('Z', '+00:00'))
            if last_week_start <= update_date <= last_week_end + timedelta(days=1):
                last_week_pages.append(page)
    
    print(f"- Pages Modified Last Week: {len(last_week_pages)}")
    
    if last_week_pages:
        print("\n[Top Priority Pages - Last Week]:")
        for i, page in enumerate(last_week_pages[:3], 1):
            title = page.get('title', 'N/A')
            author = page.get('history', {}).get('lastUpdated', {}).get('by', {}).get('displayName', 'N/A')
            when = page.get('history', {}).get('lastUpdated', {}).get('when', 'N/A')[:10]
            url = f"https://momgle-edu.atlassian.net/wiki{page.get('_links', {}).get('webui', '')}"
            
            print(f"\n### {i}. {title}")
            print(f"   - Author: {author}")
            print(f"   - Modified: {when}")
            print(f"   - Link: {url}")
    
    # 페이지별 댓글 확인
    print("\n\n[Checking Comments on Pages...]")
    total_comments = 0
    for page in pages[:5]:  # 상위 5개 페이지만
        page_id = page.get('id')
        comment_response = requests.get(
            f'https://momgle-edu.atlassian.net/wiki/rest/api/content/{page_id}/child/comment',
            headers=headers
        )
        comments = comment_response.json().get('results', [])
        if comments:
            total_comments += len(comments)
            print(f"- {page.get('title')}: {len(comments)} comments")
    
    print(f"\nTotal Comments Found: {total_comments}")
    
except Exception as e:
    print(f"Error: {e}")

print("\n" + "=" * 60)
print("Analysis Complete")