import { Pool } from 'pg';
import { CustomerRequest, ChangeRequestLog, DailyReport } from '../types';

export class DatabaseService {
  private pool: Pool | null = null;

  async initialize() {
    // For development, use in-memory storage
    // In production, connect to PostgreSQL
    if (process.env.DATABASE_URL) {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
      });
      await this.createTables();
    } else {
      // Use in-memory storage for development
      console.log('⚠️  Using in-memory storage (for development)');
      this.initInMemoryStorage();
    }
  }

  // In-memory storage for development
  private requests: CustomerRequest[] = [];
  private crLogs: ChangeRequestLog[] = [];
  private reports: DailyReport[] = [];
  private crCounter = 1;

  private initInMemoryStorage() {
    // Initialize empty storage - no test data
    this.requests = [];
  }

  private async createTables() {
    if (!this.pool) return;

    const queries = [
      `CREATE TABLE IF NOT EXISTS customer_requests (
        id SERIAL PRIMARY KEY,
        cr_number VARCHAR(20) UNIQUE NOT NULL,
        source VARCHAR(20) NOT NULL,
        source_id VARCHAR(100),
        requester_id VARCHAR(100),
        requester_name VARCHAR(100),
        requester_email VARCHAR(100),
        customer_company VARCHAR(100),
        title VARCHAR(500),
        description TEXT,
        category VARCHAR(20),
        priority VARCHAR(10),
        channel_id VARCHAR(20),
        channel_name VARCHAR(100),
        thread_ts VARCHAR(20),
        attachments JSONB,
        original_url VARCHAR(500),
        status VARCHAR(20) DEFAULT 'new',
        assignee VARCHAR(100),
        requested_at TIMESTAMP,
        collected_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS change_request_logs (
        id SERIAL PRIMARY KEY,
        cr_number VARCHAR(20) NOT NULL,
        request_id INTEGER REFERENCES customer_requests(id),
        business_impact TEXT,
        technical_requirements TEXT,
        estimated_effort VARCHAR(100),
        target_release VARCHAR(100),
        resolution TEXT,
        implementation_notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      
      `CREATE TABLE IF NOT EXISTS change_history (
        id SERIAL PRIMARY KEY,
        cr_number VARCHAR(20) NOT NULL,
        action VARCHAR(50),
        from_value VARCHAR(100),
        to_value VARCHAR(100),
        user_id VARCHAR(100),
        user_name VARCHAR(100),
        note TEXT,
        timestamp TIMESTAMP DEFAULT NOW()
      )`,
      
      `CREATE TABLE IF NOT EXISTS daily_reports (
        id SERIAL PRIMARY KEY,
        report_date DATE UNIQUE,
        total_requests INTEGER,
        by_category JSONB,
        by_priority JSONB,
        by_source JSONB,
        requests JSONB,
        generated_at TIMESTAMP DEFAULT NOW(),
        posted_channel_id VARCHAR(20),
        posted_message_ts VARCHAR(20),
        exported_file_url VARCHAR(500)
      )`
    ];

    for (const query of queries) {
      await this.pool.query(query);
    }
  }

  generateCRNumber(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const number = String(this.crCounter++).padStart(3, '0');
    return `CR-${year}${month}${day}-${number}`;
  }

  async saveCustomerRequest(request: Omit<CustomerRequest, 'id' | 'crNumber' | 'collectedAt' | 'updatedAt'>): Promise<CustomerRequest> {
    const now = new Date();
    const crNumber = this.generateCRNumber();
    
    if (this.pool) {
      // PostgreSQL implementation
      const query = `
        INSERT INTO customer_requests (
          cr_number, source, source_id, requester_id, requester_name,
          requester_email, customer_company, title, description,
          category, priority, channel_id, channel_name, thread_ts,
          attachments, original_url, status, requested_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *
      `;
      
      const values = [
        crNumber, request.source, request.sourceId, request.requesterId,
        request.requesterName, request.requesterEmail, request.customerCompany,
        request.title, request.description, request.category, request.priority,
        request.channelId, request.channelName, request.threadTs,
        JSON.stringify(request.attachments), request.originalUrl,
        request.status, request.requestedAt
      ];
      
      const result = await this.pool.query(query, values);
      return result.rows[0];
    } else {
      // In-memory implementation
      const newRequest: CustomerRequest = {
        id: String(this.requests.length + 1),
        crNumber,
        ...request,
        collectedAt: now,
        updatedAt: now,
      };
      
      this.requests.push(newRequest);
      console.log(`💾 Saved request: ${crNumber} - ${request.title}`);
      return newRequest;
    }
  }

  async getTodayRequests(): Promise<CustomerRequest[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (this.pool) {
      const query = `
        SELECT * FROM customer_requests
        WHERE collected_at >= $1
        ORDER BY collected_at DESC
      `;
      const result = await this.pool.query(query, [today]);
      return result.rows;
    } else {
      return this.requests.filter(r => {
        const requestDate = new Date(r.collectedAt);
        requestDate.setHours(0, 0, 0, 0);
        return requestDate.getTime() === today.getTime();
      });
    }
  }

  async getTodayRequestCount(): Promise<number> {
    const requests = await this.getTodayRequests();
    return requests.length;
  }

  async getYesterdayRequests(): Promise<CustomerRequest[]> {
    // For testing, return all requests (not just yesterday's)
    if (this.pool) {
      const query = `
        SELECT * FROM customer_requests
        ORDER BY priority DESC, collected_at DESC
      `;
      const result = await this.pool.query(query);
      return result.rows;
    } else {
      // Return all in-memory requests for testing
      return this.requests;
    }
  }

  async getAllRequests(): Promise<CustomerRequest[]> {
    // Return all requests regardless of date
    if (this.pool) {
      const query = `
        SELECT * FROM customer_requests
        ORDER BY priority DESC, collected_at DESC
      `;
      const result = await this.pool.query(query);
      return result.rows;
    } else {
      // Return all in-memory requests
      return this.requests;
    }
  }

  async getRequestByCRNumber(crNumber: string): Promise<CustomerRequest | null> {
    if (this.pool) {
      const query = 'SELECT * FROM customer_requests WHERE cr_number = $1';
      const result = await this.pool.query(query, [crNumber]);
      return result.rows[0] || null;
    } else {
      return this.requests.find(r => r.crNumber === crNumber) || null;
    }
  }

  async updateRequestStatus(crNumber: string, status: CustomerRequest['status'], assignee?: string): Promise<void> {
    if (this.pool) {
      const query = `
        UPDATE customer_requests
        SET status = $1, assignee = $2, updated_at = NOW()
        WHERE cr_number = $3
      `;
      await this.pool.query(query, [status, assignee, crNumber]);
    } else {
      const request = this.requests.find(r => r.crNumber === crNumber);
      if (request) {
        request.status = status;
        if (assignee) request.assignee = assignee;
        request.updatedAt = new Date();
      }
    }
  }

  async saveDailyReport(report: Omit<DailyReport, 'id'>): Promise<DailyReport> {
    if (this.pool) {
      const query = `
        INSERT INTO daily_reports (
          report_date, total_requests, by_category, by_priority,
          by_source, requests, posted_channel_id, posted_message_ts
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (report_date) DO UPDATE SET
          total_requests = $2, by_category = $3, by_priority = $4,
          by_source = $5, requests = $6, updated_at = NOW()
        RETURNING *
      `;
      
      const values = [
        report.reportDate,
        report.totalRequests,
        JSON.stringify(report.byCategory),
        JSON.stringify(report.byPriority),
        JSON.stringify(report.bySource),
        JSON.stringify(report.requests),
        report.postedChannelId,
        report.postedMessageTs
      ];
      
      const result = await this.pool.query(query, values);
      return result.rows[0];
    } else {
      const newReport: DailyReport = {
        id: String(this.reports.length + 1),
        ...report,
      };
      this.reports.push(newReport);
      return newReport;
    }
  }

  async checkDuplicateRequest(sourceId: string, source: string): Promise<boolean> {
    if (this.pool) {
      const query = 'SELECT id FROM customer_requests WHERE source_id = $1 AND source = $2';
      const result = await this.pool.query(query, [sourceId, source]);
      return result.rows.length > 0;
    } else {
      return this.requests.some(r => r.sourceId === sourceId && r.source === source);
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
    }
  }
}