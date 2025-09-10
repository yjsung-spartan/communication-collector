import json
import sys
import requests

# Fetch data
response = requests.get("https://weplanet-slack-1g2jdsz4h-yjsungs-projects.vercel.app/api/requests")
data = response.json()

# Count by source
sources = {}
for d in data['data']:
    s = d.get('source', 'unknown')
    sources[s] = sources.get(s, 0) + 1

print('=== Source Breakdown ===')
for k, v in sources.items():
    print(f'{k}: {v}')
print(f'\nTotal: {data["total"]}')

# Analyze Confluence data
confluence_data = [d for d in data['data'] if d.get('source') == 'confluence']
if confluence_data:
    print(f'\n=== Confluence Breakdown ({len(confluence_data)} total) ===')
    
    fanlight_count = 0
    momgle_count = 0
    unknown_count = 0
    
    for d in confluence_data:
        url = d.get('originalUrl', '').lower()
        channel = d.get('channelName', '').lower()
        
        if 'fanlight' in url:
            fanlight_count += 1
            print(f"Fanlight: {d.get('title', 'No title')[:50]}...")
        elif 'momgle' in url:
            momgle_count += 1
            print(f"Momgleedu: {d.get('title', 'No title')[:50]}...")
        else:
            unknown_count += 1
            print(f"Unknown: {url[:100]}...")
    
    print(f'\n=== Summary ===')
    print(f'Fanlight: {fanlight_count}')
    print(f'Momgleedu: {momgle_count}')
    print(f'Unknown: {unknown_count}')
    print(f'Total Confluence: {len(confluence_data)}')