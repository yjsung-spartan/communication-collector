const Database = require('better-sqlite3');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

async function fetchConfluenceData(domain, email, token) {
  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  const allData = [];
  
  try {
    // Fetch pages
    const pagesUrl = `https://${domain}/wiki/rest/api/content?type=page&limit=50&expand=version`;
    const response = await axios.get(pagesUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });
    
    const projectName = domain.includes('fanlight') ? 'Fanlight' : 'Momgleedu';
    
    // Add pages
    for (const page of response.data.results || []) {
      allData.push({
        cr_number: `CR-${Date.now()}-${page.id}`,
        source: 'confluence',
        requester_name: page.version?.by?.displayName || 'Unknown',
        title: page.title,
        description: `Page: ${page.title}`,
        category: 'documentation',
        priority: 'medium',
        channel_name: projectName,
        requested_at: page.version?.when || new Date().toISOString(),
        status: 'open',
        original_url: `https://${domain}/wiki${page._links?.webui || ''}`
      });
      
      // Fetch comments for first 10 pages only (to avoid timeout)
      if (allData.length <= 10) {
        try {
          const commentsUrl = `https://${domain}/wiki/rest/api/content/${page.id}/child/comment?expand=body.view,version&limit=10`;
          const commentsResponse = await axios.get(commentsUrl, {
            headers: {
              'Authorization': `Basic ${auth}`,
              'Accept': 'application/json'
            }
          });
          
          for (const comment of commentsResponse.data.results || []) {
            allData.push({
              cr_number: `CR-${Date.now()}-C${comment.id}`,
              source: 'confluence',
              requester_name: comment.version?.by?.displayName || 'Unknown',
              title: `Comment on: ${page.title}`,
              description: comment.body?.view?.value?.replace(/<[^>]*>/g, '').substring(0, 500) || '',
              category: 'comment',
              priority: 'medium',
              channel_name: projectName,
              requested_at: comment.version?.when || new Date().toISOString(),
              status: 'open',
              original_url: `https://${domain}/wiki${page._links?.webui || ''}`
            });
          }
        } catch (err) {
          console.log('Error fetching comments:', err.message);
        }
      }
    }
  } catch (error) {
    console.error(`Error fetching from ${domain}:`, error.message);
  }
  
  return allData;
}

async function buildDatabase() {
  console.log('Building database at build time...');
  
  const db = new Database('public/requests.db');
  
  // Create table
  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cr_number TEXT UNIQUE NOT NULL,
      source TEXT NOT NULL,
      requester_name TEXT,
      title TEXT,
      description TEXT,
      category TEXT,
      priority TEXT,
      channel_name TEXT,
      requested_at TEXT,
      status TEXT,
      original_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  const insert = db.prepare(`
    INSERT OR REPLACE INTO customer_requests 
    (cr_number, source, requester_name, title, description, category, priority, channel_name, requested_at, status, original_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  let totalCount = 0;
  
  // Fetch Fanlight data
  if (process.env.CONFLUENCE_API_TOKEN) {
    console.log('Fetching Fanlight data...');
    const fanlightData = await fetchConfluenceData(
      process.env.CONFLUENCE_DOMAIN || 'fanlight-weplanet.atlassian.net',
      process.env.CONFLUENCE_EMAIL,
      process.env.CONFLUENCE_API_TOKEN
    );
    
    for (const item of fanlightData) {
      insert.run(
        item.cr_number, item.source, item.requester_name, item.title,
        item.description, item.category, item.priority, item.channel_name,
        item.requested_at, item.status, item.original_url
      );
    }
    totalCount += fanlightData.length;
    console.log(`Added ${fanlightData.length} Fanlight items`);
  }
  
  // Fetch Momgleedu data (using same credentials)
  if (process.env.CONFLUENCE_API_TOKEN) {
    console.log('Fetching Momgleedu data...');
    const momgleeduData = await fetchConfluenceData(
      process.env.MOMGLEEDU_CONFLUENCE_DOMAIN || 'momgle-edu.atlassian.net',
      process.env.CONFLUENCE_EMAIL,
      process.env.CONFLUENCE_API_TOKEN
    );
    
    for (const item of momgleeduData) {
      insert.run(
        item.cr_number, item.source, item.requester_name, item.title,
        item.description, item.category, item.priority, item.channel_name,
        item.requested_at, item.status, item.original_url
      );
    }
    totalCount += momgleeduData.length;
    console.log(`Added ${momgleeduData.length} Momgleedu items`);
  }
  
  db.close();
  console.log(`Database built successfully with ${totalCount} items`);
}

buildDatabase().catch(console.error);