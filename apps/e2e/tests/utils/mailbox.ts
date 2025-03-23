import { Page } from '@playwright/test';
import { parse } from 'node-html-parser';

type MailServer = 'mailpit' | 'inbucket' | 'unknown';

interface MailpitMessage {
  ID: string;
  Subject: string;
  To: Array<{ Address: string }>;
  Date: string;
  HTML?: string;
  Text?: string;
}

interface InbucketMessage {
  id: string;
  subject: string;
  date: string;
  body: {
    html: string;
  };
}

export class Mailbox {
  constructor(private readonly page: Page) {}

  async visitMailbox(
    email: string,
    params: {
      deleteAfter: boolean;
      subject?: string;
    },
  ) {
    const mailbox = email.split('@')[0];

    console.log(`Visiting mailbox ${email} ...`);

    if (!mailbox) {
      throw new Error('Invalid email');
    }

    const json = await this.getEmail(mailbox, params);

    if (!json?.body) {
      throw new Error('Email body was not found');
    }

    console.log(`Email found for ${email}`, {
      id: json.id,
      subject: json.subject,
      date: json.date,
    });

    const html = (json.body as { html: string }).html;
    const el = parse(html);

    const linkHref = el.querySelector('a')?.getAttribute('href');

    if (!linkHref) {
      throw new Error('No link found in email');
    }

    console.log(`Visiting ${linkHref} from mailbox ${email}...`);

    return this.page.goto(linkHref);
  }

  /**
   * Retrieves an OTP code from an email
   * @param email The email address to check for the OTP
   * @param deleteAfter Whether to delete the email after retrieving the OTP
   * @returns The OTP code
   */
  async getOtpFromEmail(email: string, deleteAfter: boolean = true) {
    const mailbox = email.split('@')[0];

    console.log(`Retrieving OTP from mailbox ${email} ...`);

    if (!mailbox) {
      throw new Error('Invalid email');
    }

    const json = await this.getEmail(mailbox, {
      deleteAfter,
      subject: `One-time password for MyPraxis`,
    });

    if (!json?.body) {
      throw new Error('Email body was not found');
    }

    const html = (json.body as { html: string }).html;

    const text = html.match(
      new RegExp(`Your one-time password is: (\\d{6})`),
    )?.[1];

    if (text) {
      console.log(`OTP code found in text: ${text}`);
      return text;
    }

    throw new Error('Could not find OTP code in email');
  }

  /**
   * Detects which mail server is running on the specified port
   * @returns The detected mail server type
   */
  private async detectMailServer(): Promise<MailServer> {
    const isCI = process.env.CI === 'true';
    console.log(`Environment: ${isCI ? 'CI' : 'Local'}`);
    
    // Based on docker ps output, we know that:
    // - Local environment uses Mailpit (port 8025 mapped to 54324)
    // - CI environment uses Inbucket (port 9000 mapped to 54324)
    
    // Check the root endpoint to identify the mail server
    try {
      const rootUrl = 'http://127.0.0.1:54324/';
      
      const rootResponse = await fetch(rootUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      if (rootResponse.ok) {
        const text = await rootResponse.text();
        
        // Check for Mailpit indicators in the HTML
        if (text.includes('Mailpit') || text.includes('mailpit')) {
          return 'mailpit';
        }
        
        // Check for Inbucket indicators in the HTML
        if (text.includes('Inbucket') || text.includes('inbucket')) {
          return 'inbucket';
        }
        
        // Log the first part of the response for debugging
        console.log(`Root page content (first 200 chars): ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
      }
    } catch (error) {
      console.error('Error checking root endpoint:', error instanceof Error ? error.message : String(error));
    }
    
    // If detection fails, make a decision based on environment
    if (isCI) {
      console.log('CI environment detected, defaulting to Inbucket');
      return 'inbucket';
    } else {
      console.log('Local environment detected, defaulting to Mailpit');
      return 'mailpit';
    }
  }

  async getEmail(
    mailbox: string,
    params: {
      deleteAfter: boolean;
      subject?: string;
    },
  ) {
    const serverType = await this.detectMailServer();
    
    // Log which server we're using
    console.log(`Using mail server: ${serverType}`);
    
    if (serverType === 'inbucket') {
      return this.getEmailFromInbucket(mailbox, params);
    } else if (serverType === 'mailpit') {
      return this.getEmailFromMailpit(mailbox, params);
    } else {
      // If unknown, try Inbucket first, then fall back to Mailpit if that fails
      try {
        console.log('Attempting to use Inbucket first...');
        return await this.getEmailFromInbucket(mailbox, params);
      } catch (error) {
        console.log('Inbucket failed, falling back to Mailpit:', error);
        return this.getEmailFromMailpit(mailbox, params);
      }
    }
  }
  
  /**
   * Gets an email from the Mailpit server
   */
  private async getEmailFromMailpit(
    mailbox: string,
    params: {
      deleteAfter: boolean;
      subject?: string;
    },
  ) {
    // Mailpit runs on port 8025 in the container (mapped to 54324)
    const host = '127.0.0.1';
    const baseUrl = `http://${host}:54324/api`;
    const searchUrl = `${baseUrl}/v1/messages`;

    // Fetch all messages
    const response = await fetch(searchUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch emails: ${response.statusText}`);
    }

    const result = await response.json() as {
      messages: Array<{
        ID: string;
        Subject: string;
        To: Array<{ Address: string }>
      }>,
      total: number
    };

    if (!result.messages || !result.messages.length) {
      console.log(`No emails found in mailbox`);
      return;
    }

    // Filter messages by recipient
    let filteredMessages = result.messages.filter(message => {
      return message.To.some(recipient => {
        // Check if the recipient address starts with the mailbox name
        // This handles addresses like "123456@makerkit.dev"
        return recipient.Address.startsWith(`${mailbox}@`);
      });
    });

    console.log(`Found ${filteredMessages.length} emails for recipient ${mailbox}@*`);

    if (filteredMessages.length === 0) {
      console.log(`No emails found for recipient ${mailbox}@*`);
      return;
    }

    // Filter by subject if provided
    if (params.subject) {
      filteredMessages = filteredMessages.filter(
        (item) => item.Subject === params.subject
      );

      console.log(
        `Found ${filteredMessages.length} emails with subject ${params.subject}`,
      );

      if (filteredMessages.length === 0) {
        console.log(`No emails found with subject ${params.subject}`);
        return;
      }
    }

    // Get the most recent message
    const message = filteredMessages[filteredMessages.length - 1];
    console.log(`Message: ${JSON.stringify(message)}`);

    const messageId = message?.ID;
    const messageUrl = `${baseUrl}/v1/message/${messageId}`;

    // Fetch the full message content
    const messageResponse = await fetch(messageUrl);

    if (!messageResponse.ok) {
      throw new Error(`Failed to fetch email: ${messageResponse.statusText}`);
    }

    const messageData = await messageResponse.json();

    // Delete message if requested
    if (params.deleteAfter) {
      console.log(`Deleting email ${messageId} ...`);

      const deleteUrl = `${baseUrl}/v1/messages`;
      const res = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ids: [messageId]
        })
      });

      if (!res.ok) {
        console.error(`Failed to delete email: ${res.statusText}`);
      }
    }

    // Transform the response to match the expected format
    return {
      id: messageData.ID,
      subject: messageData.Subject,
      date: messageData.Date,
      body: {
        html: messageData.HTML || messageData.Text
      }
    };
  }

  /**
   * Gets an email from the Inbucket server
   */
  private async getEmailFromInbucket(
    mailbox: string,
    params: {
      deleteAfter: boolean;
      subject?: string;
    },
  ) {
    const url = `http://127.0.0.1:54324/api/v1/mailbox/${mailbox}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch emails: ${response.statusText}`);
    }

    const json = (await response.json()) as Array<{
      id: string;
      subject: string;
    }>;

    if (!json || !json.length) {
      console.log(`No emails found for mailbox ${mailbox}`);

      return;
    }

    const message = params.subject
      ? (() => {
          const filtered = json.filter(
            (item) => item.subject === params.subject,
          );

          console.log(
            `Found ${filtered.length} emails with subject ${params.subject}`,
          );

          return filtered[filtered.length - 1];
        })()
      : json[0];

    console.log(`Message: ${JSON.stringify(message)}`);

    const messageId = message?.id;
    const messageUrl = `${url}/${messageId}`;

    const messageResponse = await fetch(messageUrl);

    if (!messageResponse.ok) {
      throw new Error(`Failed to fetch email: ${messageResponse.statusText}`);
    }

    // delete message
    if (params.deleteAfter) {
      console.log(`Deleting email ${messageId} ...`);

      const res = await fetch(messageUrl, {
        method: 'DELETE',
      });

      if (!res.ok) {
        console.error(`Failed to delete email: ${res.statusText}`);
      }
    }

    return await messageResponse.json();
  }
}
