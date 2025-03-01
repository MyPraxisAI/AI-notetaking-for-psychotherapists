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
