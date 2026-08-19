// Payments Domain Model
export class Payment {
  constructor(
    public id: string,
    public description: string,
    public recipientName: string,
    public amount: number,
    public timestamp: string,
    // Null for settled entries - the service only sets this while a payment is
    // still in flight, so callers must guard before calling string methods.
    public status: string | null,
    public paymentType?: string,
    public category?: string,
    public cardId?: string,
    // "income" | "outcome" - amount is always a positive number on the wire;
    // this is what actually tells you the direction of money movement.
    public flowType?: string,
    public type?: string
  ) {}
}
