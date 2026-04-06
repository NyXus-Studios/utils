/**
 * Share command metadata from a common spot to be used for both runtime
 * and registration.
 */

export const TOTP_COMMAND = {
  name: 'totp',
  description: 'Generate a one-time code for a service.',
  options: [
    {
      name: 'service',
      description: 'The service to generate a TOTP code for.',
      type: 3,
      required: true,
      choices: [
        {
          name: 'cloudflare',
          value: 'cloudflare',
        },
        {
          name: 'gmail',
          value: 'gmail',
        },
      ],
    },
  ],
};
