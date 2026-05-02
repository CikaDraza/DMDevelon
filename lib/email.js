import { resend } from "./resend";

// Mapa from adresa po tipu
export const FROM_EMAIL_MAP = {
  contact: "Contact Form <contact@dmdevelon.website>",
  newsletter: "DMDevelon Newsletter <newsletter@dmdevelon.website>",
  system: "DMDevelon <noreply@dmdevelon.website>",
  verification: "DMDevelon <noreply@dmdevelon.website>",
  testimonial: "DMDevelon <contact@dmdevelon.website>",
};

function htmlToText(html) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Generička metoda za slanje email-a
export async function sendEmail(options) {
  const { to, subject, html, text, type, from } = options;

  const fromEmail =
    from || (type && FROM_EMAIL_MAP[type]) || FROM_EMAIL_MAP.system;

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text: text || htmlToText(html),
    });

    if (error) {
      console.error("❌ Resend error:", error);
      throw error;
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("❌ Error sending email:", error);
    throw error;
  }
}
