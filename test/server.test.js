import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import {
  InteractionResponseType,
  InteractionType,
  InteractionResponseFlags,
} from 'discord-interactions';
import { TOTP_COMMAND } from '../src/commands.js';
import sinon from 'sinon';
import server from '../src/server.js';

describe('Server', () => {
  describe('GET /', () => {
    it('should return a simple health message', async () => {
      const request = {
        method: 'GET',
        url: new URL('/', 'http://discordo.example'),
      };
      const env = {};

      const response = await server.fetch(request, env);
      const body = await response.text();

      expect(body).to.equal('Util bot is online.');
    });
  });

  describe('POST /', () => {
    let verifyDiscordRequestStub;
    let dateNowStub;

    beforeEach(() => {
      verifyDiscordRequestStub = sinon.stub(server, 'verifyDiscordRequest');
      dateNowStub = sinon.stub(Date, 'now').returns(1_700_000_000_000);
    });

    afterEach(() => {
      verifyDiscordRequestStub.restore();
      dateNowStub.restore();
    });

    it('should handle a PING interaction', async () => {
      const interaction = {
        type: InteractionType.PING,
      };

      const request = {
        method: 'POST',
        url: new URL('/', 'http://discordo.example'),
      };

      const env = {};

      verifyDiscordRequestStub.resolves({
        isValid: true,
        interaction: interaction,
      });

      const response = await server.fetch(request, env);
      const body = await response.json();
      expect(body.type).to.equal(InteractionResponseType.PONG);
    });

    it('should reject command usage in an unapproved guild', async () => {
      const interaction = {
        type: InteractionType.APPLICATION_COMMAND,
        guild_id: '1',
        member: {
          roles: ['1490840570569163025'],
        },
        data: {
          name: TOTP_COMMAND.name,
          options: [{ name: 'service', value: 'cloudflare' }],
        },
      };

      const request = {
        method: 'POST',
        url: new URL('/', 'http://discordo.example'),
      };

      const env = { CFKEY: 'JBSWY3DPEHPK3PXP' };

      verifyDiscordRequestStub.resolves({
        isValid: true,
        interaction: interaction,
      });

      const response = await server.fetch(request, env);
      const body = await response.json();
      expect(body.type).to.equal(
        InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      );
      expect(body.data.flags).to.equal(InteractionResponseFlags.EPHEMERAL);
      expect(body.data.content).to.equal(
        'This command can only be used in the configured server.',
      );
    });

    it('should reject command usage when role is missing', async () => {
      const interaction = {
        type: InteractionType.APPLICATION_COMMAND,
        guild_id: '1098115673454039121',
        member: {
          roles: [],
        },
        data: {
          name: TOTP_COMMAND.name,
          options: [{ name: 'service', value: 'cloudflare' }],
        },
      };

      const request = {
        method: 'POST',
        url: new URL('/', 'http://discordo.example'),
      };

      const env = {
        CFKEY: 'JBSWY3DPEHPK3PXP',
      };

      verifyDiscordRequestStub.resolves({
        isValid: true,
        interaction: interaction,
      });

      const response = await server.fetch(request, env);
      const body = await response.json();
      expect(body.type).to.equal(
        InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      );
      expect(body.data.flags).to.equal(InteractionResponseFlags.EPHEMERAL);
      expect(body.data.content).to.equal(
        'You do not have permission to use this command.',
      );
    });

    it('should generate a totp code for a valid /totp command', async () => {
      const interaction = {
        type: InteractionType.APPLICATION_COMMAND,
        guild_id: '1098115673454039121',
        member: {
          roles: ['1490840570569163025'],
        },
        data: {
          name: TOTP_COMMAND.name,
          options: [{ name: 'service', value: 'cloudflare' }],
        },
      };

      const request = {
        method: 'POST',
        url: new URL('/', 'http://discordo.example'),
      };

      const env = {
        CFKEY: 'JBSWY3DPEHPK3PXP',
      };

      verifyDiscordRequestStub.resolves({
        isValid: true,
        interaction: interaction,
      });

      const response = await server.fetch(request, env);
      const body = await response.json();
      expect(body.type).to.equal(
        InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      );
      expect(body.data.flags).to.equal(InteractionResponseFlags.EPHEMERAL);
      expect(body.data.content).to.match(/Cloudflare TOTP: \*\*\d{6}\*\*/);
      expect(body.data.components[0].components[0].custom_id).to.equal(
        'totp_regen:cloudflare',
      );
    });

    it('should regenerate a code from the button custom id', async () => {
      const interaction = {
        type: InteractionType.MESSAGE_COMPONENT,
        guild_id: '1098115673454039121',
        member: {
          roles: ['1490840570569163025'],
        },
        data: {
          custom_id: 'totp_regen:gmail',
        },
      };

      const request = {
        method: 'POST',
        url: new URL('/', 'http://discordo.example'),
      };

      const env = {
        GMKEY: 'JBSWY3DPEHPK3PXP',
      };

      verifyDiscordRequestStub.resolves({
        isValid: true,
        interaction: interaction,
      });

      const response = await server.fetch(request, env);
      const body = await response.json();
      expect(body.type).to.equal(
        InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      );
      expect(body.data.flags).to.equal(InteractionResponseFlags.EPHEMERAL);
      expect(body.data.content).to.match(/Gmail TOTP: \*\*\d{6}\*\*/);
    });

    it('should handle an unknown command interaction', async () => {
      const interaction = {
        type: InteractionType.APPLICATION_COMMAND,
        data: {
          name: 'unknown',
        },
      };

      const request = {
        method: 'POST',
        url: new URL('/', 'http://discordo.example'),
      };

      verifyDiscordRequestStub.resolves({
        isValid: true,
        interaction: interaction,
      });

      const response = await server.fetch(request, {});
      const body = await response.json();
      expect(response.status).to.equal(400);
      expect(body.error).to.equal('Unknown Type');
    });
  });

  describe('All other routes', () => {
    it('should return a "Not Found" response', async () => {
      const request = {
        method: 'GET',
        url: new URL('/unknown', 'http://discordo.example'),
      };
      const response = await server.fetch(request, {});
      expect(response.status).to.equal(404);
      const body = await response.text();
      expect(body).to.equal('Not Found.');
    });
  });
});
