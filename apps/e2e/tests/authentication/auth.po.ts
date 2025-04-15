import { Page, expect } from '@playwright/test';
import { TOTP } from 'totp-generator';

import { Mailbox } from '../utils/mailbox';

export class AuthPageObject {
  private readonly page: Page;
  private readonly mailbox: Mailbox;

  constructor(page: Page) {
    this.page = page;
    this.mailbox = new Mailbox(page);
  }

  goToSignIn() {
    return this.page.goto('/auth/sign-in');
  }

  goToSignUp() {
    return this.page.goto('/auth/sign-up');
  }

  async signOut() {
    // Check if the logout button is visible
    const logoutButton = this.page.locator('[data-test="logout-button"]');
    const isLogoutButtonVisible = await logoutButton.isVisible();
    
    // If the logout button is not visible, the sidebar might be collapsed in responsive mode
    if (!isLogoutButtonVisible) {
      // Click the menu button to show the sidebar
      await this.page.click('[data-test="nav-menu-button"]');
      
      // Wait for the sidebar animation to complete and the logout button to be visible
      await this.page.waitForSelector('[data-test="logout-button"]', { state: 'visible' });
    }
    
    // Now click the logout button
    await this.page.click('[data-test="logout-button"]');
  }

  async signIn(params: { email: string; password: string }) {
    await this.page.waitForTimeout(500);

    await this.page.fill('input[name="email"]', params.email);
    await this.page.fill('input[name="password"]', params.password);
    await this.page.click('button[type="submit"]');
  }

  async signUp(params: {
    email: string;
    password: string;
    repeatPassword: string;
  }) {
    await this.page.waitForTimeout(500);

    await this.page.fill('input[name="email"]', params.email);
    await this.page.fill('input[name="password"]', params.password);
    await this.page.fill('input[name="repeatPassword"]', params.repeatPassword);

    await this.page.click('button[type="submit"]');
  }

  async submitMFAVerification(key: string) {
    const period = 30;

    const { otp } = TOTP.generate(key, {
      period,
    });

    console.log(`OTP ${otp} code`, {
      period,
    });

    await this.page.fill('[data-input-otp]', otp);
    await this.page.click('[data-test="submit-mfa-button"]');
  }

  async visitConfirmEmailLink(
    email: string,
    params: {
      deleteAfter: boolean;
      subject?: string;
    } = {
      deleteAfter: true,
    },
  ) {
    await this.page.waitForTimeout(500);
    return expect(async () => {
      const res = await this.mailbox.visitMailbox(email, params);

      expect(res).not.toBeNull();
    }).toPass();
  }

  createRandomEmail() {
    const value = Math.random() * 10000000000;

    return `${value.toFixed(0)}@makerkit.dev`;
  }

  async signUpFlow(path: string) {
    const email = this.createRandomEmail();

    await this.page.goto(`/auth/sign-up?next=${path}`);

    await this.signUp({
      email,
      password: 'password',
      repeatPassword: 'password',
    });

    await this.visitConfirmEmailLink(email);

    return {
      email,
    };
  }

  async updatePassword(password: string) {
    await this.page.fill('[name="password"]', password);
    await this.page.fill('[name="repeatPassword"]', password);
    await this.page.click('[type="submit"]');
  }
}
