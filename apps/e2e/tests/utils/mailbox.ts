import { Page } from '@playwright/test';
import { parse } from 'node-html-parser';

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
      subject: `One-time password for Makerkit`,
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

  async getEmail(
    mailbox: string,
    params: {
      deleteAfter: boolean;
      subject?: string;
    },
  ) {
    // Mailpit API base URL (running on port 54324 as configured in Supabase)
    const baseUrl = 'http://127.0.0.1:54324/api';
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
}
