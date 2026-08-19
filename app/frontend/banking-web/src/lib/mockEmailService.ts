// There is no real email backend wired in yet, so this never claims to
// have sent anything real. It just records that a receipt was generated,
// for the UI to reflect honestly.
export interface MockEmailReceipt {
  to: string;
  subject: string;
  sentAt: string;
}

export const mockEmailService = {
  sendReceipt(to: string, subject: string): MockEmailReceipt {
    return { to, subject, sentAt: new Date().toISOString() };
  },
};
