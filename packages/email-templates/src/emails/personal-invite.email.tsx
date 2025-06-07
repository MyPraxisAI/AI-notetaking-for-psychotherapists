import {
  Body,
  Column,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
  render,
} from '@react-email/components';

import { BodyStyle } from '../components/body-style';
import { EmailContent } from '../components/content';
import { CtaButton } from '../components/cta-button';
import { EmailFooter } from '../components/footer';
import { EmailHeader } from '../components/header';
import { EmailHeading } from '../components/heading';
import { EmailWrapper } from '../components/wrapper';
import { initializeEmailI18n } from '../lib/i18n';

interface Props {
  inviterName: string | undefined;
  inviterEmail: string;
  invitedUserEmail: string;
  link: string;
  productName: string;
  language?: string;
}

export async function renderPersonalInviteEmail(props: Props) {
  // We'll use the same namespace prefix as the team invite email
  // but with a "personal-" prefix to differentiate
  const namespace = 'personal-invite-email';

  const { t } = await initializeEmailI18n({
    language: props.language,
    namespace,
  });

  const previewText = `Join ${props.productName} - Invitation from ${props.inviterName || props.inviterEmail}`;
  const subject = t(`${namespace}:subject`, { 
    productName: props.productName 
  });

  const heading = t(`${namespace}:heading`, {
    productName: props.productName,
  });

  const hello = t(`${namespace}:hello`, {
    invitedUserEmail: props.invitedUserEmail,
  });

  const mainText = t(`${namespace}:mainText`, {
    inviterName: props.inviterName || props.inviterEmail,
    inviterEmail: props.inviterEmail,
    productName: props.productName,
  });

  const joinApp = t(`${namespace}:joinApp`, {
    productName: props.productName,
  });

  const html = await render(
    <Html>
      <Head>
        <BodyStyle />
      </Head>

      <Preview>{previewText}</Preview>

      <Tailwind>
        <Body>
          <EmailWrapper>
            <EmailHeader>
              <EmailHeading>{heading}</EmailHeading>
            </EmailHeader>

            <EmailContent>
              <Text className="text-[16px] leading-[24px] text-[#242424]">
                {hello}
              </Text>

              <Text
                className="text-[16px] leading-[24px] text-[#242424]"
                dangerouslySetInnerHTML={{ __html: mainText }}
              />

              <Section className="mb-[32px] mt-[32px] text-center">
                <CtaButton href={props.link}>{joinApp}</CtaButton>
              </Section>

              <Text className="text-[16px] leading-[24px] text-[#242424]">
                {t(`${namespace}:copyPasteLink`)}{' '}
                <Link href={props.link} className="text-blue-600 no-underline">
                  {props.link}
                </Link>
              </Text>

              <Hr className="mx-0 my-[26px] w-full border border-solid border-[#eaeaea]" />

              <Text className="text-[12px] leading-[24px] text-[#666666]">
                {t(`${namespace}:invitationIntendedFor`, {
                  invitedUserEmail: props.invitedUserEmail,
                })}
              </Text>
            </EmailContent>

            <EmailFooter>{props.productName}</EmailFooter>
          </EmailWrapper>
        </Body>
      </Tailwind>
    </Html>,
  );

  return {
    html,
    subject,
  };
}
