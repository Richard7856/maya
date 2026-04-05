import type { Payment } from "@maya/types";
import { apiClient } from "./client";

export interface PaymentIntentResponse {
  // Stripe client_secret — passed to PaymentSheet on the mobile app
  client_secret: string;
  payment_id: string;
  amount: number;
}

export interface AccessCodeResponse {
  access_code: string;
}

export const paymentsApi = {
  list: () =>
    apiClient.get<Payment[]>("/payments").then((r) => r.data),

  // Creates a Stripe PaymentIntent server-side and returns the client_secret
  createIntent: (paymentId: string) =>
    apiClient
      .post<PaymentIntentResponse>(`/payments/${paymentId}/pay`)
      .then((r) => r.data),

  // Returns the access code only if the current month's payment is 'paid'
  getAccessCode: () =>
    apiClient
      .get<AccessCodeResponse>("/payments/mine/access-code")
      .then((r) => r.data),
};
