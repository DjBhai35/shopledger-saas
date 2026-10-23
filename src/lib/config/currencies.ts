export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
}

export interface CountryOption {
  code: string;
  name: string;
  currency: string;
  currencySymbol: string;
}

export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "PKR", symbol: "Rs.", name: "Pakistani Rupee" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "AED", symbol: "AED", name: "UAE Dirham" },
  { code: "SAR", symbol: "SAR", name: "Saudi Riyal" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "CAD", symbol: "CA$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "AU$", name: "Australian Dollar" },
  { code: "BDT", symbol: "৳", name: "Bangladeshi Taka" },
];

export const POPULAR_COUNTRIES: CountryOption[] = [
  { code: "PK", name: "Pakistan", currency: "PKR", currencySymbol: "Rs." },
  { code: "US", name: "United States", currency: "USD", currencySymbol: "$" },
  { code: "IN", name: "India", currency: "INR", currencySymbol: "₹" },
  { code: "AE", name: "United Arab Emirates", currency: "AED", currencySymbol: "AED" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", currencySymbol: "SAR" },
  { code: "GB", name: "United Kingdom", currency: "GBP", currencySymbol: "£" },
  { code: "CA", name: "Canada", currency: "CAD", currencySymbol: "CA$" },
  { code: "AU", name: "Australia", currency: "AUD", currencySymbol: "AU$" },
  { code: "BD", name: "Bangladesh", currency: "BDT", currencySymbol: "৳" },
];
