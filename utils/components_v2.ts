/**
 * Constants and helpers for Discord's Components V2 (introduced March 2025).
 */

/**
 * Message flag required to activate Components V2 for a message.
 * Setting this disables traditional 'content' and 'embeds' in favor of a component-only layout.
 */
export const IS_COMPONENTS_V2 = 1 << 15;

/**
 * Official Discord Component Type IDs for V2 System.
 * Reference: https://discord.com/developers/docs/interactions/message-components#component-types
 */
// Based on Discord documentation for Component V2 types
// Note: Discordeno v21 might not have these updated enums yet.
export enum ComponentV2Type {
  ActionRow = 1,
  Button = 2,
  StringSelect = 3,
  TextInput = 4,
  UserSelect = 5,
  RoleSelect = 6,
  MentionableSelect = 7,
  ChannelSelect = 8,
  Section = 9,
  TextDisplay = 10,
  Thumbnail = 11,
  MediaGallery = 12,
  File = 13,
  Separator = 14,
  Container = 17,
  Label = 18,
  // File_Upload = 19
}
