// Feature switches. Loans are off because the ERPNext Lending module is not
// installed or used here: the Loan doctype does not exist, so every loan call
// fails. Set loans to true only after Lending (or a replacement) is in place.
export const FEATURES = {
  loans: false,
};
