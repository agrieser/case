import { describe, it, expect } from '@jest/globals';
import {
  sanitizeInput,
  validateTitle,
  validateInvestigationName,
  validateCommandText,
  validateSlackUserId,
  validateSlackChannelId,
  parseCommandArgs,
  validateCommandContext,
  createSafeErrorMessage,
  ValidationError
} from '../validation';

describe('validation middleware', () => {
  describe('sanitizeInput', () => {
    it('should remove XSS attempts', () => {
      expect(sanitizeInput('<script>alert("xss")</script>test')).toBe('test');
      expect(sanitizeInput('<img src=x onerror=alert(1)>')).toBe('');
      expect(sanitizeInput('javascript:alert(1)')).toBe('alert(1)');
      expect(sanitizeInput('<iframe src="evil.com"></iframe>')).toBe('');
    });

    it('should escape HTML entities', () => {
      expect(sanitizeInput('test & <> "\' content')).toBe('test &amp; &lt;&gt; &quot;&#39; content');
    });

    it('should trim whitespace', () => {
      expect(sanitizeInput('  test  ')).toBe('test');
    });
  });

  describe('validateTitle', () => {
    it('should accept valid titles', () => {
      expect(validateTitle('Valid Title')).toBe('Valid Title');
      expect(validateTitle('API response times increasing')).toBe('API response times increasing');
    });

    it('should reject empty titles', () => {
      expect(() => validateTitle('')).toThrow(ValidationError);
      expect(() => validateTitle('   ')).toThrow(ValidationError);
    });

    it('should reject titles that are too long', () => {
      const longTitle = 'a'.repeat(201);
      expect(() => validateTitle(longTitle)).toThrow('Title must be less than 200 characters');
    });

    it('should reject titles with suspicious patterns', () => {
      expect(() => validateTitle('../../etc/passwd')).toThrow('Title contains invalid characters');
      expect(() => validateTitle('//evil.com/path')).toThrow('Title contains invalid characters');
      expect(() => validateTitle('\\\\network\\share')).toThrow('Title contains invalid characters');
    });

    it('should sanitize XSS in titles', () => {
      expect(validateTitle('<b>Bold</b> Title')).toBe('&lt;b&gt;Bold&lt;/b&gt; Title');
    });
  });

  describe('validateInvestigationName', () => {
    it('should accept valid investigation names', () => {
      expect(validateInvestigationName('case-golden-falcon')).toBe('case-golden-falcon');
      expect(validateInvestigationName('CASE-SILVER-DOLPHIN')).toBe('case-silver-dolphin');
    });

    it('should reject invalid formats', () => {
      expect(() => validateInvestigationName('invalid-name')).toThrow('Invalid investigation name format');
      expect(() => validateInvestigationName('case-123-456')).toThrow('Invalid investigation name format');
      // case-golden-falcon-extra is now valid with the hash suffix
    });

    it('should reject empty names', () => {
      expect(() => validateInvestigationName('')).toThrow('Investigation name cannot be empty');
    });
  });

  describe('validateCommandText', () => {
    it('should accept valid command text', () => {
      expect(validateCommandText('investigate API issues')).toBe('investigate API issues');
    });

    it('should reject command text that is too long', () => {
      const longText = 'a'.repeat(501);
      expect(() => validateCommandText(longText)).toThrow('Command text too long');
    });

    it('should reject shell metacharacters', () => {
      expect(() => validateCommandText('test; rm -rf /')).toThrow('Command contains invalid characters');
      expect(() => validateCommandText('test | cat /etc/passwd')).toThrow('Command contains invalid characters');
      expect(() => validateCommandText('test && evil')).toThrow('Command contains invalid characters');
      expect(() => validateCommandText('test `whoami`')).toThrow('Command contains invalid characters');
    });

    it('should reject directory traversal attempts', () => {
      expect(() => validateCommandText('test ../../../etc/passwd')).toThrow('Command contains invalid characters');
    });
  });

  describe('validateSlackUserId', () => {
    it('should accept valid Slack user IDs', () => {
      expect(validateSlackUserId('U123456789')).toBe('U123456789');
      expect(validateSlackUserId('U1234567890ABCDEF')).toBe('U1234567890ABCDEF');
    });

    it('should reject invalid user IDs', () => {
      expect(() => validateSlackUserId('123456789')).toThrow('Invalid Slack user ID format');
      expect(() => validateSlackUserId('u123456789')).toThrow('Invalid Slack user ID format');
      expect(() => validateSlackUserId('U12345')).toThrow('Invalid Slack user ID format');
    });
  });

  describe('validateSlackChannelId', () => {
    it('should accept valid Slack channel IDs', () => {
      expect(validateSlackChannelId('C123456789')).toBe('C123456789');
      expect(validateSlackChannelId('C1234567890ABCDEF')).toBe('C1234567890ABCDEF');
    });

    it('should reject invalid channel IDs', () => {
      expect(() => validateSlackChannelId('123456789')).toThrow('Invalid Slack channel ID format');
      expect(() => validateSlackChannelId('c123456789')).toThrow('Invalid Slack channel ID format');
      expect(() => validateSlackChannelId('C12345')).toThrow('Invalid Slack channel ID format');
    });
  });

  describe('parseCommandArgs', () => {
    it('should parse command and arguments', () => {
      expect(parseCommandArgs('investigate API issues')).toEqual({
        subcommand: 'investigate',
        args: 'API issues'
      });
    });

    it('should handle empty commands', () => {
      expect(parseCommandArgs('')).toEqual({
        subcommand: '',
        args: ''
      });
    });

    it('should handle commands without args', () => {
      expect(parseCommandArgs('status')).toEqual({
        subcommand: 'status',
        args: ''
      });
    });

    it('should validate command text', () => {
      expect(() => parseCommandArgs('test; malicious')).toThrow('Command contains invalid characters');
    });
  });

  describe('validateCommandContext', () => {
    const validCommand = {
      command: '/case',
      user_id: 'U123456789',
      channel_id: 'C123456789',
      text: 'test'
    };

    it('should accept valid command context', () => {
      expect(() => validateCommandContext(validCommand as any)).not.toThrow();
    });

    it('should reject missing user ID', () => {
      const command = { ...validCommand, user_id: '' };
      expect(() => validateCommandContext(command as any)).toThrow('Missing user ID');
    });

    it('should reject missing channel ID', () => {
      const command = { ...validCommand, channel_id: '' };
      expect(() => validateCommandContext(command as any)).toThrow('Missing channel ID');
    });

    it('should reject wrong command', () => {
      const command = { ...validCommand, command: '/wrong' };
      expect(() => validateCommandContext(command as any)).toThrow('Invalid command');
    });
  });

  describe('createSafeErrorMessage', () => {
    it('should return validation error messages', () => {
      const error = new ValidationError('Title too long');
      expect(createSafeErrorMessage(error)).toBe('⚠️ Title too long');
    });

    it('should hide internal errors', () => {
      const error = new Error('Database connection failed at host:port');
      expect(createSafeErrorMessage(error)).toBe('⚠️ An error occurred. Please try again.');
    });

    it('should handle non-error objects', () => {
      expect(createSafeErrorMessage('string error')).toBe('⚠️ An error occurred. Please try again.');
      expect(createSafeErrorMessage(null)).toBe('⚠️ An error occurred. Please try again.');
    });
  });
});