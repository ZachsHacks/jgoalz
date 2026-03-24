// Twilio SMS helper
// Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER in .env.local

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

export async function sendSMS(to: string, body: string): Promise<{ success: boolean; error?: string }> {
  if (!accountSid || !authToken || !fromNumber) {
    console.warn("Twilio not configured - SMS not sent:", { to, body });
    return { success: false, error: "Twilio not configured" };
  }

  // Normalize phone number: strip non-digits, ensure +1 prefix
  const digits = to.replace(/\D/g, "");
  const formattedTo = digits.startsWith("1") ? `+${digits}` : `+1${digits}`;

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        },
        body: new URLSearchParams({
          To: formattedTo,
          From: fromNumber,
          Body: body,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Twilio error:", error);
      return { success: false, error };
    }

    return { success: true };
  } catch (err) {
    console.error("SMS send failed:", err);
    return { success: false, error: String(err) };
  }
}
