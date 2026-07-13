import { resend } from "./resend";

// Mapa from adresa po tipu.
//   contact/testimonial -> contact@ (Zoho inbox: kontakt forma, messages, testimonials)
//   project             -> milan.drazic@ (komunikacija oko projekata/zahteva)
//   system/verification -> noreply@ (transakcioni, bez odgovora)
export const FROM_EMAIL_MAP = {
  contact: "Contact DMDevelon <contact@dmdevelon.website>",
  newsletter: "DMDevelon Newsletter <newsletter@dmdevelon.website>",
  system: "DMDevelon <noreply@dmdevelon.website>",
  verification: "DMDevelon <noreply@dmdevelon.website>",
  testimonial: "DMDevelon <contact@dmdevelon.website>",
  project: "DMDevelon Projects <milan.drazic@dmdevelon.website>",
};

// Reply-To po tipu — kuda stižu odgovori (mora da ima Zoho inbox).
export const REPLY_TO_MAP = {
  contact: "contact@dmdevelon.website",
  testimonial: "contact@dmdevelon.website",
  project: "milan.drazic@dmdevelon.website",
};

function htmlToText(html) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Generička metoda za slanje email-a
export async function sendEmail(options) {
  const { to, subject, html, text, type, from, replyTo } = options;

  const fromEmail =
    from || (type && FROM_EMAIL_MAP[type]) || FROM_EMAIL_MAP.system;
  const replyToAddress = replyTo || (type && REPLY_TO_MAP[type]) || undefined;

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: Array.isArray(to) ? to : [to],
      ...(replyToAddress ? { replyTo: replyToAddress } : {}),
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
