// Email templejti za različite scenarije

export const emailTemplates = {
  // 1. Kontakt forma - notifikacija adminu
  contactNotification: (data) => ({
    subject: `New Message from ${data.name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #FFB633;">New Message</h2>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px;">
          <p><strong>From:</strong> ${data.name} (${data.email})</p>
          <p><strong>Message:</strong></p>
          <p style="white-space: pre-wrap;">${data.message}</p>
        </div>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">
          Received at: ${new Date().toLocaleString()}
        </p>
      </div>
    `,
  }),

  // 2. Verifikacija email-a za nove korisnike
  emailVerification: (data) => ({
    subject: "Verify your email address",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #FFB633;">Welcome to DMDevelon!</h2>
        <p>Hi ${data.name},</p>
        <p>Please verify your email address by clicking the button below:</p>
        <a href="${data.verificationUrl}" 
           style="display: inline-block; background: #FFB633; color: #000; 
                  padding: 12px 24px; text-decoration: none; border-radius: 6px; 
                  font-weight: bold; margin: 20px 0;">
          Verify Email
        </a>
        <p style="color: #666; font-size: 14px;">
          Or copy this link: ${data.verificationUrl}
        </p>
        <p style="color: #999; font-size: 12px;">
          This link expires in 24 hours.
        </p>
      </div>
    `,
  }),

  // 2b. Reset šifre
  passwordReset: (data) => ({
    subject: "Reset your password",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #FFB633;">Reset your password</h2>
        <p>Hi ${data.name},</p>
        <p>We received a request to reset your password. Click the button below to choose a new one:</p>
        <a href="${data.resetUrl}"
           style="display: inline-block; background: #FFB633; color: #000;
                  padding: 12px 24px; text-decoration: none; border-radius: 6px;
                  font-weight: bold; margin: 20px 0;">
          Reset Password
        </a>
        <p style="color: #666; font-size: 14px;">
          Or copy this link: ${data.resetUrl}
        </p>
        <p style="color: #999; font-size: 12px;">
          This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  }),

  // 2c. Generička notifikacija o aktivnosti (request/projekat)
  activityNotification: (data) => ({
    subject: data.title,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        ${
          data.logoUrl
            ? `<div style="text-align:center; padding: 16px 0;">
                 <img src="${data.logoUrl}" alt="DMDevelon"
                      width="56" height="56"
                      style="width:56px; height:56px; display:inline-block;" />
               </div>`
            : ""
        }
        <h2 style="color: #FFB633;">${data.title}</h2>
        ${data.message ? `<p>${data.message}</p>` : ""}
        <a href="${data.ctaUrl}"
           style="display: inline-block; background: #FFB633; color: #000;
                  padding: 12px 24px; text-decoration: none; border-radius: 6px;
                  font-weight: bold; margin: 20px 0;">
          ${data.ctaLabel || "View"}
        </a>
        <p style="color: #999; font-size: 12px;">
          You're receiving this because you have activity on DMDevelon.
        </p>
      </div>
    `,
  }),

  // 2b. Digest novih poruka (batched, šalje ga cron sweep)
  //   data: { name, logoUrl, wordmarkUrl, ctaUrl, totalCount,
  //           conversations: [{ title, count, preview }] }
  newMessageDigest: (data) => {
    const total = data.totalCount || 0;
    const subject =
      total === 1
        ? "You have a new message on DMDevelon"
        : `You have ${total} new messages on DMDevelon`;
    const rows = (data.conversations || [])
      .map(
        (c) => `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
              <tr>
                <td width="34" valign="top" style="width:34px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center" valign="middle"
                          style="width:24px; height:24px; background:#FFB633;
                                 border-radius:50%; color:#000; font-family:Arial,sans-serif;
                                 font-weight:bold; font-size:12px; line-height:24px;
                                 mso-line-height-rule:exactly;">${c.count}</td>
                    </tr>
                  </table>
                </td>
                <td valign="middle" style="padding-left:6px;">
                  <strong style="color:#111;">${c.title}</strong>
                  ${c.preview ? `<div style="color:#666; font-size:13px; margin-top:4px;">${c.preview}</div>` : ""}
                </td>
              </tr>
            </table>
          </td>
        </tr>`,
      )
      .join("");
    return {
      subject,
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color:#111;">
        ${
          data.logoUrl
            ? `<div style="text-align:center; padding: 16px 0;">
                 <img src="${data.logoUrl}" alt="DMDevelon"
                      width="56" height="56"
                      style="width:56px; height:56px; display:inline-block;" />
               </div>`
            : ""
        }
        <h2 style="color: #FFB633; margin-bottom: 4px;">${subject}</h2>
        <p style="color:#555;">Hi ${data.name || "there"}, here's what you missed:</p>
        <table style="width:100%; border-collapse: collapse; margin: 12px 0;">
          ${rows}
        </table>
        <a href="${data.ctaUrl}"
           style="display: inline-block; background: #FFB633; color: #000;
                  padding: 12px 24px; text-decoration: none; border-radius: 6px;
                  font-weight: bold; margin: 12px 0;">
          Open messages
        </a>
        ${
          data.wordmarkUrl
            ? `<div style="text-align:center; margin-top: 28px; padding-top: 16px;
                          border-top: 1px solid #eee;">
                 <img src="${data.wordmarkUrl}" alt="DMDevelon"
                      width="200" height="60"
                      style="width:200px; height:60px; display:inline-block;" />
               </div>`
            : ""
        }
        <p style="color: #999; font-size: 12px; margin-top: 16px; text-align:center;">
          You're receiving this because email notifications are on. You can turn
          them off anytime in your DMDevelon settings.
        </p>
      </div>
    `,
    };
  },

  // 3. Odgovor admina na kontakt poruku
  contactReply: (data) => ({
    subject: "Re: Your message to DMDevelon",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #FFB633;">Hi ${data.name},</h2>
        <p>Thank you for reaching out. Here's our response:</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          ${data.replyMessage}
        </div>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">Your original message:</p>
        <p style="color: #999; font-size: 12px; font-style: italic;">
          ${data.originalMessage}
        </p>
      </div>
    `,
  }),

  // 4. Notifikacija za novi testimonial
  newTestimonialNotification: (data) => ({
    subject: "New Testimonial Submitted",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #FFB633;">New Testimonial Received</h2>
        <p><strong>Customer:</strong> ${data.customerName}</p>
        <p><strong>Project:</strong> ${data.projectName}</p>
        <p><strong>Rating:</strong> ${"⭐".repeat(data.rating)}</p>
        <p>Please review and approve in the admin panel.</p>
      </div>
    `,
  }),

  // 5. Newsletter (jednostavan primer)
  newsletter: (data) => ({
    subject: data.title,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <header style="background: #0a0a0b; padding: 20px; text-align: center;">
          <h1 style="color: #FFB633; margin: 0;">DMDevelon</h1>
        </header>
        <div style="padding: 20px;">
          <h2>${data.title}</h2>
          ${data.content}
        </div>
        <footer style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;">
          <p>You're receiving this because you subscribed to our newsletter.</p>
          <a href="${data.unsubscribeUrl}" style="color: #FFB633;">Unsubscribe</a>
        </footer>
      </div>
    `,
  }),

  // 6. Notifikacija o statusu projekta
  projectStatusUpdate: (data) => ({
    subject: `Project Update: ${data.projectName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #FFB633;">Hi ${data.customerName},</h2>
        <p>Your project <strong>${data.projectName}</strong> status has been updated to: 
           <span style="color: ${data.status === "completed" ? "#22c55e" : "#FFB633"}; font-weight: bold; text-transform: uppercase;">
             ${data.status}
           </span>
        </p>
        ${data.message ? `<p>${data.message}</p>` : ""}
        <a href="https://dmdevelon.website/dashboard/projects" 
           style="display: inline-block; background: #FFB633; color: #000; 
                  padding: 12px 24px; text-decoration: none; border-radius: 6px; 
                  font-weight: bold; margin: 20px 0;">
          View Project
        </a>
      </div>
    `,
  }),
};
