/**
 * Cardcom Low Profile API client.
 * 
 * Cardcom Low Profile is the recurring billing flow:
 * 1. Create LowProfile session → user gets redirected to Cardcom payment page
 * 2. User pays → Cardcom redirects back with LowProfileId
 * 3. Get LowProfileResult → returns Token for future charges
 * 4. Use ChargeToken to bill recurring charges (monthly)
 * 
 * Terminal 137368 supports Low Profile.
 * Note: requires UserName/UserPassword (not ApiName/ApiPassword).
 */

const TERMINAL = process.env.CARDCOM_TERMINAL || '137368';
const USERNAME = process.env.CARDCOM_USERNAME!;
const API_PASSWORD = process.env.CARDCOM_API_PASSWORD!;

const CARDCOM_BASE = 'https://secure.cardcom.solutions/api/v11';

export type CreateLowProfileParams = {
  amount: number;              // In ILS (Cardcom requires ILS, not USD)
  successUrl: string;
  errorUrl: string;
  webhookUrl: string;          // Cardcom POSTs to this URL after payment
  productName: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerIdNumber?: string;
  externalUniqTransactionId?: string;  // Our internal subscription_id
  isRecurring?: boolean;
  metadata?: Record<string, string>;   // Custom1-Custom5 fields
};

export type LowProfileSession = {
  lowProfileId: string;
  url: string;
  raw: any;
};

/**
 * Create a Low Profile payment session.
 * Returns a URL that the user needs to be redirected to in order to pay.
 */
export async function createLowProfileSession(
  params: CreateLowProfileParams
): Promise<LowProfileSession> {
  const body: any = {
    TerminalNumber: Number(TERMINAL),
    ApiName: USERNAME,                        // Cardcom v11 uses ApiName for the username
    ReturnValue: params.externalUniqTransactionId || '',
    Amount: params.amount,
    SuccessRedirectUrl: params.successUrl,
    FailedRedirectUrl: params.errorUrl,
    WebHookUrl: params.webhookUrl,
    Document: {
      To: params.customerName || '',
      Email: params.customerEmail || '',
      Phone: params.customerPhone || '',
      TaxId: params.customerIdNumber || '',
      Products: [
        {
          Description: params.productName,
          UnitCost: params.amount,
          Quantity: 1,
        },
      ],
    },
    ISOCoinId: 1,                            // 1 = ILS, 2 = USD
    Operation: params.isRecurring ? 'ChargeAndCreateToken' : 'ChargeOnly',
    UIDefinition: {
      Languages: ['he', 'en'],
      IsHideCardOwnerName: false,
      IsHideCardOwnerPhone: false,
      IsHideCardOwnerEmail: false,
    },
  };

  // Custom fields (Cardcom maps these to Custom1-Custom5)
  if (params.metadata) {
    const entries = Object.entries(params.metadata).slice(0, 5);
    entries.forEach(([key, value], i) => {
      body[`Custom${i + 1}`] = value;
      body[`Custom${i + 1}Name`] = key;
    });
  }

  const res = await fetch(`${CARDCOM_BASE}/LowProfile/Create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  
  if (data.ResponseCode !== 0) {
    throw new Error(`Cardcom error ${data.ResponseCode}: ${data.Description || 'Unknown'}`);
  }
  
  return {
    lowProfileId: data.LowProfileId,
    url: data.Url,
    raw: data,
  };
}

/**
 * Get the result of a Low Profile session after the user paid.
 * Returns the deal info + token for future recurring charges.
 */
export async function getLowProfileResult(lowProfileId: string): Promise<any> {
  const body = {
    TerminalNumber: Number(TERMINAL),
    ApiName: USERNAME,
    ApiPassword: API_PASSWORD,
    LowProfileId: lowProfileId,
  };

  const res = await fetch(`${CARDCOM_BASE}/LowProfile/GetLpResult`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return data;
}

/**
 * Charge a saved token (recurring billing).
 * Called by cron monthly to renew subscriptions.
 */
export type ChargeTokenParams = {
  token: string;
  amount: number;
  productName: string;
  customerName?: string;
  customerEmail?: string;
  externalUniqTransactionId?: string;
  cardLast4?: string;             // Cardcom requires the last 4 digits to charge a token
};

export type ChargeResult = {
  success: boolean;
  responseCode: number;
  responseText: string;
  dealNumber?: string;
  raw: any;
};

export async function chargeToken(params: ChargeTokenParams): Promise<ChargeResult> {
  const body = {
    TerminalNumber: Number(TERMINAL),
    ApiName: USERNAME,
    ApiPassword: API_PASSWORD,
    TokenToCharge: {
      Token: params.token,
      CardValidityMonth: 12,
      CardValidityYear: 30,
      Last4Digits: params.cardLast4 || '',
    },
    Amount: params.amount,
    ISOCoinId: 1,
    ReturnValue: params.externalUniqTransactionId || '',
    Document: {
      To: params.customerName || '',
      Email: params.customerEmail || '',
      Products: [{
        Description: params.productName,
        UnitCost: params.amount,
        Quantity: 1,
      }],
    },
  };

  const res = await fetch(`${CARDCOM_BASE}/Transactions/Transaction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  
  return {
    success: data.ResponseCode === 0,
    responseCode: data.ResponseCode,
    responseText: data.Description || data.Message || 'Unknown',
    dealNumber: data.TranzactionId ? String(data.TranzactionId) : undefined,
    raw: data,
  };
}

/**
 * Convert USD to ILS (rough conversion - in production use exchange rate API).
 * For now we just multiply by 3.7 as a fixed rate.
 */
export function usdToIls(usd: number): number {
  return Math.round(usd * 3.7 * 100) / 100;
}

export function isCardcomConfigured(): boolean {
  return !!(USERNAME && API_PASSWORD);
}
