/**
 * The core server that runs on a Cloudflare worker.
 */

import { AutoRouter } from 'itty-router';
import {
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  verifyKey,
} from 'discord-interactions';
import { TOTP_COMMAND } from './commands.js';

class JsonResponse extends Response {
  constructor(body, init) {
    const jsonBody = JSON.stringify(body);
    init = init || {
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
    };
    super(jsonBody, init);
  }
}

const router = AutoRouter();

const ALLOWED_GUILD_ID = '1098115673454039121';
const REQUIRED_ROLE_ID = '1490840570569163025';

const SERVICE_CONFIG = {
  cloudflare: {
    envKey: 'CFKEY',
    label: 'Cloudflare',
  },
  gmail: {
    envKey: 'GMKEY',
    label: 'Gmail',
  },
};

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * A simple :wave: hello page to verify the worker is working.
 */
router.get('/', () => {
  return new Response('Util bot is online.');
});

function ephemeralMessage(content) {
  return new JsonResponse({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
      flags: InteractionResponseFlags.EPHEMERAL,
    },
  });
}

function hasRequiredContext(interaction) {
  if (interaction.guild_id !== ALLOWED_GUILD_ID) {
    return {
      ok: false,
      message: 'This command can only be used in the configured server.',
    };
  }

  const roles = interaction.member?.roles || [];
  if (!roles.includes(REQUIRED_ROLE_ID)) {
    return {
      ok: false,
      message: 'You do not have permission to use this command.',
    };
  }

  return { ok: true };
}

function getServiceFromCommand(interaction) {
  return interaction.data?.options?.find((option) => option.name === 'service')
    ?.value;
}

function getServiceFromComponent(interaction) {
  const customId = interaction.data?.custom_id || '';
  if (!customId.startsWith('totp_regen:')) {
    return null;
  }

  const [, service] = customId.split(':');
  return service;
}

function base32ToBytes(secret) {
  const cleaned = secret.toUpperCase().replace(/=|\s|-/g, '');
  let bits = '';

  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error('Invalid base32 secret.');
    }
    bits += index.toString(2).padStart(5, '0');
  }

  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }

  return new Uint8Array(bytes);
}

async function generateTotp(secret, nowMs = Date.now()) {
  const counter = Math.floor(nowMs / 1000 / 30);
  const counterBuffer = new ArrayBuffer(8);
  const counterView = new DataView(counterBuffer);
  counterView.setUint32(4, counter, false);

  const keyBytes = base32ToBytes(secret);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', cryptoKey, counterBuffer),
  );

  const offset = signature[signature.length - 1] & 0x0f;
  const binaryCode =
    ((signature[offset] & 0x7f) << 24) |
    ((signature[offset + 1] & 0xff) << 16) |
    ((signature[offset + 2] & 0xff) << 8) |
    (signature[offset + 3] & 0xff);

  const code = (binaryCode % 1_000_000).toString().padStart(6, '0');
  const expiresAtUnix = (counter + 1) * 30;

  return {
    code,
    expiresAtUnix,
  };
}

async function getTotpResponse(service, env) {
  const config = SERVICE_CONFIG[service];
  if (!config) {
    return ephemeralMessage('Unsupported service.');
  }

  const secret = env[config.envKey];
  if (!secret) {
    return ephemeralMessage(`Missing environment key: ${config.envKey}.`);
  }

  const { code, expiresAtUnix } = await generateTotp(secret);
  const content =
    `${config.label} TOTP: **${code}**\n` +
    `Expires <t:${expiresAtUnix}:R> (<t:${expiresAtUnix}:T>).`;

  return new JsonResponse({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
      flags: InteractionResponseFlags.EPHEMERAL,
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 1,
              label: 'Regenerate',
              custom_id: `totp_regen:${service}`,
            },
          ],
        },
      ],
    },
  });
}

/**
 * Main route for all requests sent from Discord.  All incoming messages will
 * include a JSON payload described here:
 * https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object
 */
router.post('/', async (request, env) => {
  const { isValid, interaction } = await server.verifyDiscordRequest(
    request,
    env,
  );
  if (!isValid || !interaction) {
    return new Response('Bad request signature.', { status: 401 });
  }

  if (interaction.type === InteractionType.PING) {
    // The `PING` message is used during the initial webhook handshake, and is
    // required to configure the webhook in the developer portal.
    return new JsonResponse({
      type: InteractionResponseType.PONG,
    });
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    if (interaction.data.name.toLowerCase() !== TOTP_COMMAND.name.toLowerCase()) {
      return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
    }

    const contextCheck = hasRequiredContext(interaction);
    if (!contextCheck.ok) {
      return ephemeralMessage(contextCheck.message);
    }

    const service = getServiceFromCommand(interaction);
    return getTotpResponse(service, env);
  }

  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    const service = getServiceFromComponent(interaction);
    if (!service) {
      return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
    }

    const contextCheck = hasRequiredContext(interaction);
    if (!contextCheck.ok) {
      return ephemeralMessage(contextCheck.message);
    }

    return getTotpResponse(service, env);
  }

  console.error('Unknown Type');
  return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
});
router.all('*', () => new Response('Not Found.', { status: 404 }));

async function verifyDiscordRequest(request, env) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const body = await request.text();
  const isValidRequest =
    signature &&
    timestamp &&
    (await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY));
  if (!isValidRequest) {
    return { isValid: false };
  }

  return { interaction: JSON.parse(body), isValid: true };
}

const server = {
  verifyDiscordRequest,
  fetch: router.fetch,
};

export default server;
