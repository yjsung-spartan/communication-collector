import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import { ConfluencePageCollectorService } from './src/services/confluencePageCollectorService';
import { DatabaseService } from './src/services/databaseService';

dotenv.config();

async function createDatabase() {
  console.log('📦 Creating SQLite database with real data...\n');
  
  // Create SQLite database
  const db = new Database('requests.db');
  
  // Create table
  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cr_number TEXT UNIQUE NOT NULL,
      source TEXT NOT NULL,
      source_id TEXT,
      requester_id TEXT,
      requester_name TEXT,
      requester_email TEXT,
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
  
  // Collect data using existing service
  const dbService = new DatabaseService();
  await dbService.initialize();
  
  try {
    // Collect Fanlight data
    if (process.env.CONFLUENCE_API_TOKEN) {
      console.log('📊 Collecting Fanlight Confluence...');
      const fanlightCollector = new ConfluencePageCollectorService(dbService);
      const fanlightCount = await fanlightCollector.collectPagesAndComments([], 'fanlight');
      console.log(`✅ Fanlight: Collected ${fanlightCount} items\n`);
    }
    
    // Collect Momgleedu data
    if (process.env.CONFLUENCE_API_TOKEN) {  // Note: uses same token
      console.log('📊 Collecting Momgleedu Confluence...');
      const momgleeduCollector = new ConfluencePageCollectorService(dbService);
      const momgleeduCount = await momgleeduCollector.collectPagesAndComments([], 'momgleedu');
      console.log(`✅ Momgleedu: Collected ${momgleeduCount} items\n`);
    }
    
    // Get all requests from memory DB
    const allRequests = await dbService.getAllRequests();
    console.log(`📋 Total requests collected: ${allRequests.length}`);
    
    // Insert into SQLite
    const insert = db.prepare(`
      INSERT OR REPLACE INTO customer_requests 
      (cr_number, source, source_id, requester_id, requester_name, requester_email, 
       title, description, category, priority, channel_name, requested_at, status, original_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const req of allRequests) {
      insert.run(
        req.crNumber,
        req.source,
        req.sourceId || null,
        req.requesterId || null,
        req.requesterName || null,
        req.requesterEmail || null,
        req.title || null,
        req.description || null,
        req.category || null,
        req.priority || null,
        req.channelName || null,
        req.requestedAt?.toISOString() || null,
        req.status || 'open',
        req.originalUrl || null
      );
    }
    
    console.log(`\n✅ Database created: requests.db`);
    console.log(`📊 Total records: ${allRequests.length}`);
    
    // Show sample data
    const samples = db.prepare('SELECT * FROM customer_requests LIMIT 3').all();
    console.log('\n📝 Sample records:');
    samples.forEach((row: any) => {
      console.log(`  - ${row.title} (${row.source})`);
    });
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await dbService.close();
    db.close();
  }
}

createDatabase();