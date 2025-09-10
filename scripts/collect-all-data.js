#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { DatabaseService } = require('../dist/services/databaseService');
const { BatchCollectorService } = require('../dist/services/batchCollectorService');
const { FigmaCollectorService } = require('../dist/services/figmaCollectorService');
const { ConfluencePageCollectorService } = require('../dist/services/confluencePageCollectorService');
const { App, LogLevel } = require('@slack/bolt');

require('dotenv').config();

async function collectAllData() {
  console.log('🚀 Starting comprehensive data collection...');
  const startTime = Date.now();
  
  const dbService = new DatabaseService();
  await dbService.initialize();
  
  const results = {
    timestamp: new Date().toISOString(),
    sources: {
      slack: { success: false, count: 0, errors: [] },
      confluence: { success: false, count: 0, errors: [] },
      figma: { success: false, count: 0, errors: [] }
    },
    totalRequests: 0,
    duration: 0
  };

  try {
    // 1. Slack Collection
    if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_APP_TOKEN) {
      console.log('📨 Collecting from Slack...');
      try {
        const slackApp = new App({
          token: process.env.SLACK_BOT_TOKEN,
          appToken: process.env.SLACK_APP_TOKEN,
          signingSecret: process.env.SLACK_SIGNING_SECRET || '',
          socketMode: false,
          logLevel: LogLevel.ERROR,
        });
        
        const config = {
          slackBotToken: process.env.SLACK_BOT_TOKEN,
          slackAppToken: process.env.SLACK_APP_TOKEN,
          slackSigningSecret: process.env.SLACK_SIGNING_SECRET || '',
          monitorChannels: (process.env.MONITOR_CHANNELS || '').split(',').filter(c => c),
          reportChannel: process.env.REPORT_CHANNEL || '',
          requestKeywords: (process.env.REQUEST_KEYWORDS || '요청,문의,개선,오류,버그').split(','),
          urgentKeywords: (process.env.URGENT_KEYWORDS || '긴급,급함,ASAP').split(','),
          highKeywords: (process.env.HIGH_KEYWORDS || '중요,우선').split(','),
          lowKeywords: (process.env.LOW_KEYWORDS || '검토,고려,제안').split(','),
        };
        
        const slackCollector = new BatchCollectorService(slackApp, config, dbService);
        
        // Collect ALL historical data
        const channels = config.monitorChannels;
        for (const channel of channels) {
          console.log(`  - Channel: ${channel}`);
          await slackCollector.collectChannelHistory(channel, 1000); // Get up to 1000 messages
        }
        
        const slackRequests = await dbService.getRequestsBySource('slack');
        results.sources.slack.success = true;
        results.sources.slack.count = slackRequests.length;
        console.log(`  ✅ Collected ${slackRequests.length} Slack requests`);
      } catch (error) {
        results.sources.slack.errors.push(error.message);
        console.error('  ❌ Slack collection failed:', error.message);
      }
    }

    // 2. Confluence Collection  
    if (process.env.CONFLUENCE_DOMAINS && process.env.CONFLUENCE_API_TOKEN) {
      console.log('📄 Collecting from Confluence...');
      try {
        const confluenceCollector = new ConfluencePageCollectorService(dbService);
        const domains = (process.env.CONFLUENCE_DOMAINS || '').split(',').filter(d => d);
        
        for (const domain of domains) {
          console.log(`  - Domain: ${domain}`);
          // Set domain-specific URL
          process.env.CONFLUENCE_BASE_URL = `https://${domain}`;
          
          // Collect from all spaces in this domain
          await confluenceCollector.collectPagesAndComments([]);
        }
        
        const confluenceRequests = await dbService.getRequestsBySource('confluence');
        results.sources.confluence.success = true;
        results.sources.confluence.count = confluenceRequests.length;
        console.log(`  ✅ Collected ${confluenceRequests.length} Confluence comments`);
      } catch (error) {
        results.sources.confluence.errors.push(error.message);
        console.error('  ❌ Confluence collection failed:', error.message);
      }
    }

    // 3. Figma Collection
    if (process.env.FIGMA_ACCESS_TOKEN) {
      console.log('🎨 Collecting from Figma...');
      try {
        const figmaCollector = new FigmaCollectorService(dbService);
        const files = (process.env.FIGMA_FILE_KEYS || '').split(',').filter(f => f);
        
        for (const fileKey of files) {
          console.log(`  - File: ${fileKey}`);
          await figmaCollector.collectFileComments(fileKey);
        }
        
        const figmaRequests = await dbService.getRequestsBySource('figma');
        results.sources.figma.success = true;
        results.sources.figma.count = figmaRequests.length;
        console.log(`  ✅ Collected ${figmaRequests.length} Figma comments`);
      } catch (error) {
        results.sources.figma.errors.push(error.message);
        console.error('  ❌ Figma collection failed:', error.message);
      }
    }

    // Get all requests
    const allRequests = await dbService.getAllRequests();
    results.totalRequests = allRequests.length;
    results.duration = Date.now() - startTime;

    // Save to JSON file
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const filename = `collected-${new Date().toISOString().split('T')[0]}.json`;
    const filepath = path.join(dataDir, filename);
    
    // Save full data
    fs.writeFileSync(filepath, JSON.stringify({
      metadata: results,
      requests: allRequests
    }, null, 2));

    // Also save latest.json for easy access
    fs.writeFileSync(path.join(dataDir, 'latest.json'), JSON.stringify({
      metadata: results,
      requests: allRequests
    }, null, 2));

    console.log(`\n📊 Collection Summary:`);
    console.log(`  Total Requests: ${results.totalRequests}`);
    console.log(`  Slack: ${results.sources.slack.count}`);
    console.log(`  Confluence: ${results.sources.confluence.count}`);
    console.log(`  Figma: ${results.sources.figma.count}`);
    console.log(`  Duration: ${(results.duration / 1000).toFixed(2)}s`);
    console.log(`  Saved to: ${filepath}`);

  } catch (error) {
    console.error('❌ Collection failed:', error);
    process.exit(1);
  } finally {
    await dbService.close();
  }
}

// Run if called directly
if (require.main === module) {
  collectAllData()
    .then(() => {
      console.log('✅ Collection complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { collectAllData };