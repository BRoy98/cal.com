import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import MailComposer from "nodemailer/lib/mail-composer";

let client: SESv2Client | null = null;

function getClient(): SESv2Client {
  if (!client) {
    const config: ConstructorParameters<typeof SESv2Client>[0] = {
      region: process.env.AWS_SES_REGION || "us-east-1",
    };

    if (process.env.AWS_SES_ACCESS_KEY_ID && process.env.AWS_SES_SECRET_ACCESS_KEY) {
      config.credentials = {
        accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
      };
    }

    client = new SESv2Client(config);
  }
  return client;
}

export async function sendViaSes(payload: Record<string, unknown>): Promise<void> {
  const mail = new MailComposer(payload);
  const raw = await mail.compile().build();

  const ses = getClient();
  await ses.send(
    new SendEmailCommand({
      Content: {
        Raw: { Data: raw },
      },
    })
  );
}
