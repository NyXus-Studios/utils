export async function createDestinationAddress(apiToken, accountID, email) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountID}/email/routing/addresses`,
    {
      body: `{"email":"${email}"}`,
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiToken,
        'Content-Type': 'application/json',
      },
    }
  );
  const data = await response.json();
  return data.success;
}
