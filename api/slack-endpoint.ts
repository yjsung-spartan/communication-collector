import { App, LogLevel } from '@slack/bolt';
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

// Slack 메시지 조회 API 엔드포인트
export function setupSlackEndpoints(app: express.Application) {
  
  // Get Slack messages from specific channels
  app.get('/api/slack/messages', async (req, res) => {
    try {
      const { channel, startDate, endDate, limit = 100 } = req.query;
      
      if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_APP_TOKEN) {
        return res.status(400).json({
          success: false,
          error: 'Slack credentials not configured'
        });
      }
      
      const slackApp = new App({
        token: process.env.SLACK_BOT_TOKEN,
        appToken: process.env.SLACK_APP_TOKEN,
        signingSecret: process.env.SLACK_SIGNING_SECRET || '',
        socketMode: false,
        logLevel: LogLevel.ERROR,
      });
      
      // Get channel list if not specified
      if (!channel) {
        const channelsResult = await slackApp.client.conversations.list({
          token: process.env.SLACK_BOT_TOKEN,
          exclude_archived: true,
          types: 'public_channel,private_channel'
        });
        
        return res.json({
          success: true,
          channels: channelsResult.channels?.map(ch => ({
            id: ch.id,
            name: ch.name,
            is_private: ch.is_private,
            num_members: ch.num_members
          }))
        });
      }
      
      // Get messages from specific channel
      const oldest = startDate ? new Date(startDate as string).getTime() / 1000 : undefined;
      const latest = endDate ? new Date(endDate as string).getTime() / 1000 : undefined;
      
      const result = await slackApp.client.conversations.history({
        token: process.env.SLACK_BOT_TOKEN,
        channel: channel as string,
        oldest,
        latest,
        limit: parseInt(limit as string),
        inclusive: true
      });
      
      // Enrich messages with user info
      const messages = [];
      for (const message of result.messages || []) {
        let userName = 'Unknown';
        if (message.user) {
          try {
            const userInfo = await slackApp.client.users.info({
              token: process.env.SLACK_BOT_TOKEN,
              user: message.user
            });
            userName = userInfo.user?.real_name || userInfo.user?.name || 'Unknown';
          } catch (err) {
            console.error('Error fetching user info:', err);
          }
        }
        
        messages.push({
          ts: message.ts,
          text: message.text,
          user: message.user,
          userName,
          timestamp: new Date(parseFloat(message.ts!) * 1000).toISOString(),
          type: message.type,
          thread_ts: message.thread_ts,
          reply_count: message.reply_count,
          reply_users_count: message.reply_users_count
        });
      }
      
      res.json({
        success: true,
        channel: channel as string,
        total: messages.length,
        has_more: result.has_more,
        messages
      });
      
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  // Get thread replies
  app.get('/api/slack/thread', async (req, res) => {
    try {
      const { channel, thread_ts } = req.query;
      
      if (!channel || !thread_ts) {
        return res.status(400).json({
          success: false,
          error: 'channel and thread_ts are required'
        });
      }
      
      if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_APP_TOKEN) {
        return res.status(400).json({
          success: false,
          error: 'Slack credentials not configured'
        });
      }
      
      const slackApp = new App({
        token: process.env.SLACK_BOT_TOKEN,
        appToken: process.env.SLACK_APP_TOKEN,
        signingSecret: process.env.SLACK_SIGNING_SECRET || '',
        socketMode: false,
        logLevel: LogLevel.ERROR,
      });
      
      const result = await slackApp.client.conversations.replies({
        token: process.env.SLACK_BOT_TOKEN,
        channel: channel as string,
        ts: thread_ts as string,
        inclusive: true
      });
      
      // Enrich replies with user info
      const replies = [];
      for (const message of result.messages || []) {
        let userName = 'Unknown';
        if (message.user) {
          try {
            const userInfo = await slackApp.client.users.info({
              token: process.env.SLACK_BOT_TOKEN,
              user: message.user
            });
            userName = userInfo.user?.real_name || userInfo.user?.name || 'Unknown';
          } catch (err) {
            console.error('Error fetching user info:', err);
          }
        }
        
        replies.push({
          ts: message.ts,
          text: message.text,
          user: message.user,
          userName,
          timestamp: new Date(parseFloat(message.ts!) * 1000).toISOString(),
          type: message.type
        });
      }
      
      res.json({
        success: true,
        channel: channel as string,
        thread_ts: thread_ts as string,
        total: replies.length,
        replies
      });
      
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  // Search messages
  app.get('/api/slack/search', async (req, res) => {
    try {
      const { query, sort = 'timestamp', sort_dir = 'desc' } = req.query;
      
      if (!query) {
        return res.status(400).json({
          success: false,
          error: 'query parameter is required'
        });
      }
      
      if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_APP_TOKEN) {
        return res.status(400).json({
          success: false,
          error: 'Slack credentials not configured'
        });
      }
      
      const slackApp = new App({
        token: process.env.SLACK_BOT_TOKEN,
        appToken: process.env.SLACK_APP_TOKEN,
        signingSecret: process.env.SLACK_SIGNING_SECRET || '',
        socketMode: false,
        logLevel: LogLevel.ERROR,
      });
      
      const result = await slackApp.client.search.messages({
        token: process.env.SLACK_BOT_TOKEN,
        query: query as string,
        sort: sort as string,
        sort_dir: sort_dir as 'asc' | 'desc'
      });
      
      const messages = result.messages?.matches?.map(match => ({
        text: match.text,
        user: match.user,
        userName: match.username,
        timestamp: match.ts,
        channel: match.channel?.name,
        channelId: match.channel?.id,
        permalink: match.permalink
      })) || [];
      
      res.json({
        success: true,
        query: query as string,
        total: result.messages?.total || 0,
        messages
      });
      
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
}