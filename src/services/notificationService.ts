import { env } from 'src/utils/helpers';
import { sendMail } from 'src/mailer/mailer';
import type { SecurityAlert } from './monitoringService';

const LOG_PREFIX = '[Notification]';

/**
 * Notification delivery results for observability
 */
export interface NotificationResult {
  channel: string;
  success: boolean;
  error?: string;
}

/**
 * Format a security alert into a human-readable text body
 */
const formatAlertText = (alert: SecurityAlert): string => {
  return [
    `Alert ID: ${alert.id}`,
    `Type: ${alert.type}`,
    `Severity: ${alert.severity.toUpperCase()}`,
    `Message: ${alert.message}`,
    `Timestamp: ${alert.timestamp.toISOString()}`,
    `IP: ${alert.data.ip ?? 'unknown'}`,
    `User: ${alert.data.userId ?? 'anonymous'}`,
    `Data: ${JSON.stringify(alert.data, null, 2)}`,
  ].join('\n');
};

/**
 * Send an alert email to configured recipients.
 *
 * Requires ALERT_EMAIL_RECIPIENTS (comma-separated list of addresses).
 */
const sendEmailNotification = async (alert: SecurityAlert): Promise<NotificationResult> => {
  const recipients = String(env('ALERT_EMAIL_RECIPIENTS', ''));
  if (!recipients) {
    return { channel: 'email', success: false, error: 'ALERT_EMAIL_RECIPIENTS not configured' };
  }

  try {
    for (const to of recipients.split(',').map(r => r.trim()).filter(Boolean)) {
      await sendMail({
        to,
        subject: `[${alert.severity.toUpperCase()}] Security Alert: ${alert.type}`,
        text: formatAlertText(alert),
        temp: 'default',
        data: {
          message: formatAlertText(alert).replace(/\n/g, '<br>'),
        },
      });
    }
    return { channel: 'email', success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { channel: 'email', success: false, error: message };
  }
};

/**
 * Post an alert to a Discord webhook.
 *
 * Requires ALERT_DISCORD_WEBHOOK_URL.
 */
const sendDiscordNotification = async (alert: SecurityAlert): Promise<NotificationResult> => {
  const webhookUrl = String(env('ALERT_DISCORD_WEBHOOK_URL', ''));
  if (!webhookUrl) {
    return { channel: 'discord', success: false, error: 'ALERT_DISCORD_WEBHOOK_URL not configured' };
  }

  try {
    const severityColor: Record<string, number> = {
      low: 0x2ecc71,
      medium: 0xf1c40f,
      high: 0xe67e22,
      critical: 0xe74c3c,
    };

    const payload = {
      embeds: [
        {
          title: `Security Alert: ${alert.type}`,
          description: alert.message,
          color: severityColor[alert.severity] ?? 0x95a5a6,
          fields: [
            { name: 'Severity', value: alert.severity.toUpperCase(), inline: true },
            { name: 'Alert ID', value: alert.id, inline: true },
            { name: 'IP', value: alert.data.ip ?? 'unknown', inline: true },
            { name: 'User', value: alert.data.userId ?? 'anonymous', inline: true },
            { name: 'Timestamp', value: alert.timestamp.toISOString(), inline: false },
          ],
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return { channel: 'discord', success: false, error: `Discord responded with ${response.status}` };
    }

    return { channel: 'discord', success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { channel: 'discord', success: false, error: message };
  }
};

/**
 * Dispatch an alert through all configured notification channels.
 *
 * Failures are caught per-channel so one broken channel never crashes the
 * application or blocks the others.
 */
export const dispatchAlert = async (alert: SecurityAlert): Promise<NotificationResult[]> => {
  const results: NotificationResult[] = [];

  const channels: Array<(a: SecurityAlert) => Promise<NotificationResult>> = [
    sendEmailNotification,
    sendDiscordNotification,
  ];

  for (const channel of channels) {
    try {
      results.push(await channel(alert));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ channel: 'unknown', success: false, error: message });
    }
  }

  // Log results for observability
  for (const result of results) {
    if (result.success) {
      if (env('NODE_ENV') !== 'test') {
        console.debug(`${LOG_PREFIX} Alert ${alert.id} delivered via ${result.channel}`);
      }
    } else {
      console.error(`${LOG_PREFIX} Alert ${alert.id} failed on ${result.channel}: ${result.error}`);
    }
  }

  return results;
};

/**
 * Send a support-ticket acknowledgement to the requester and, when
 * SUPPORT_EMAIL is configured, a new-ticket notice to the support team.
 * Failures are logged and never block the request.
 */
export const notifySupportTicket = async (ticket: {
  reference: string;
  email: string;
  name?: string | null;
  subject: string;
}): Promise<NotificationResult[]> => {
  const results: NotificationResult[] = [];
  const deliveries = [
    {
      channel: 'email:requester',
      to: ticket.email,
      subject: `We received your request [${ticket.reference}]`,
      text: `Hi ${ticket.name ?? 'there'},<br/><br/>Thanks for contacting us. Your request "${ticket.subject}" ` +
        `has been received and our team will get back to you soon.<br/><br/>Reference: <b>${ticket.reference}</b>`,
    },
    ...(env('SUPPORT_EMAIL', '')
      ? [{
        channel: 'email:support',
        to: env('SUPPORT_EMAIL', ''),
        subject: `New support ticket [${ticket.reference}]`,
        text: `A new support ticket was opened: <b>${ticket.subject}</b> (${ticket.reference}).`,
      }]
      : []),
  ];

  for (const { channel, ...mail } of deliveries) {
    try {
      await sendMail(mail);
      results.push({ channel, success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`${LOG_PREFIX} Support ticket ${ticket.reference} failed on ${channel}: ${message}`);
      results.push({ channel, success: false, error: message });
    }
  }

  return results;
};
