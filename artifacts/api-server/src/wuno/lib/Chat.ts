import type {
  MessageSendOptions,
  Message,
  Client,
  Contact,
  MessageContent,
  MessageMedia,
} from "whatsapp-web.js";
import { Logger } from "pino";
import pLimit from "p-limit";

import { env } from "../env";
import type { UserGameProperty, User } from "../handler/database";

/**
 * Interface for accessible Chat's message property
 */
export interface IMessage {
  /**
   * User number
   */
  userNumber: string;

  /**
   * User username
   */
  userName: string;

  /**
   * Incoming chat from property
   */
  from: string;

  /**
   * Incoming chat specific message id
   */
  id: string;
}

/**
 * WhatsApp internal message data.
 *
 * whatsapp-web.js does not expose all of these fields in its public typings,
 * but WhatsApp Web uses them internally for media download.
 */
interface RawMediaData {
  directPath?: string;
  encFilehash?: string;
  filehash?: string;
  mediaKey?: string;
  mediaKeyTimestamp?: number;
  type?: string;
  mimetype?: string;
  filename?: string;
  size?: number;
}

interface RawMessage extends Message {
  _data?: RawMediaData;
}

/**
 * WhatsApp Message ID changed in newer WhatsApp Web versions.
 *
 * Older:
 *   id._serialized
 *
 * Newer:
 *   id.$1
 *
 * We support both formats.
 */
interface CompatibleMessageId {
  _serialized?: string;
  $1?: string;
  fromMe?: boolean;
  remote?: string;
  id?: string;
}

/**
 * Result returned from browser-side direct media download.
 */
interface DirectMediaResult {
  data: string;
  mimetype: string;
}

/**
 * Class for handling incoming chat and outcoming chat
 */
export class Chat {
  /**
   * Whatsapp client instance
   */
  client: Client;

  /**
   * Pino logger instance
   */
  logger: Logger;

  /**
   * Accessible message instance that contains information about incoming message
   */
  message: IMessage;

  /**
   * Actual incoming message object
   */
  private incomingMessage: Message;

  /**
   * Message limitter instance from p-limit
   */
  private limitter: ReturnType<typeof pLimit>;

  /**
   * Current chatter contact instance
   */
  private contact: Contact;

  /**
   * Accessible user document by phone number
   */
  user?: User;

  /**
   * Accessible user game property by phone number
   */
  gameProperty?: UserGameProperty;

  /**
   * Whether the current command should be delivered to one targeted player
   */
  targetOnly = false;

  /**
   * Args list from user command
   */
  args: string[];

  /**
   * Chat class constructor
   * @param client Open whatsaapp client instance
   * @param IncomingMessage Open whatsapp .onMessage message instance
   * @param logger Pino logger instance
   * @param limitter p-limit instance for limitting message
   * @param contact Current chatter contact instance
   */
  constructor(
    client: Client,
    IncomingMessage: Message,
    logger: Logger,
    limitter: ReturnType<typeof pLimit>,
    contact: Contact,
  ) {
    this.client = client;
    this.logger = logger;
    this.contact = contact;
    this.limitter = limitter;
    this.incomingMessage = IncomingMessage;

    /**
     * Important:
     *
     * WhatsApp Web newer builds renamed `_serialized` -> `$1`.
     * whatsapp-web.js still has internal code that expects `_serialized`
     * in several Message methods.
     *
     * Normalize it immediately when the Message enters our app.
     */
    this.normalizeMessageId(this.incomingMessage);

    this.message = {
      userNumber: contact.id._serialized,
      userName: contact.pushname,
      from: IncomingMessage.from,
      id: this.getMessageSerializedId(IncomingMessage) ?? IncomingMessage.id.id,
    };

    this.args = IncomingMessage.body
      .slice(env.PREFIX.length)
      .trim()
      .split(/ +/)
      .slice(1);
  }

  /**
   * Get a compatible serialized message ID.
   *
   * Supports:
   * - _serialized
   * - $1
   * - reconstruction from fromMe + remote + id
   */
  private getMessageSerializedId(message: Message): string | undefined {
    const id = message.id as CompatibleMessageId;

    if (typeof id._serialized === "string" && id._serialized.length > 0) {
      return id._serialized;
    }

    if (typeof id.$1 === "string" && id.$1.length > 0) {
      return id.$1;
    }

    if (
      typeof id.fromMe === "boolean" &&
      typeof id.remote === "string" &&
      typeof id.id === "string"
    ) {
      return `${id.fromMe}_${id.remote}_${id.id}`;
    }

    return undefined;
  }

  /**
   * Normalize WhatsApp Web's new `$1` message ID into `_serialized`.
   *
   * This is needed because whatsapp-web.js still uses `_serialized`
   * internally for getQuotedMessage(), downloadMedia(), react(), etc.
   */
  private normalizeMessageId(message: Message): string | undefined {
    const id = message.id as CompatibleMessageId;

    const serialized = this.getMessageSerializedId(message);

    if (!serialized) {
      this.logger.warn(
        {
          messageId: id,
        },
        "[WA-ID] Tidak bisa menentukan serialized message ID",
      );

      return undefined;
    }

    if (id._serialized !== serialized) {
      try {
        Object.defineProperty(id, "_serialized", {
          value: serialized,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      } catch {
        /**
         * Fallback apabila object WhatsApp dibuat non-configurable.
         */
        try {
          (id as CompatibleMessageId & { _serialized?: string })._serialized =
            serialized;
        } catch {
          // Ignore. We still return the serialized ID below.
        }
      }
    }

    return serialized;
  }

  /**
   * Send text or image with caption to current person chatter
   */
  async sendToCurrentPerson(
    content: MessageContent | MessageSendOptions,
    image?: MessageMedia,
  ) {
    await this.sendToOtherPerson(this.message.from, content, image);
  }

  /**
   * Reply current chatter using text or image with caption
   */
  async replyToCurrentPerson(
    content: MessageContent | MessageSendOptions,
    image?: MessageMedia,
  ) {
    if (image) {
      await this.limitter(
        async () =>
          await this.incomingMessage.reply(
            image,
            this.message.from,
            content as MessageSendOptions,
          ),
      );
    } else {
      await this.limitter(
        async () => await this.incomingMessage.reply(content as MessageContent),
      );
    }
  }

  /**
   * Send reaction to current person chatter
   */
  async reactToCurrentPerson(emoji: string) {
    await this.limitter(async () => await this.incomingMessage.react(emoji));
  }

  /**
   * Send text or image with caption to someone
   */
  async sendToOtherPerson(
    to: string,
    content: MessageContent | MessageSendOptions,
    image?: MessageMedia,
  ) {
    if (image) {
      await this.limitter(
        async () =>
          await this.client.sendMessage(
            to,
            image,
            content as MessageSendOptions,
          ),
      );
    } else {
      await this.limitter(
        async () =>
          await this.client.sendMessage(to, content as MessageContent),
      );
    }
  }

  /**
   * Get current contact profile picture string
   */
  async getContactProfilePicture() {
    return await this.contact.getProfilePicUrl();
  }

  /**
   * Direct media downloader using WhatsApp Web's DownloadManager.
   *
   * Why this exists:
   *
   * message.downloadMedia() can fail on newer WhatsApp Web versions,
   * especially for @lid chats and media that is not currently cached.
   *
   * We therefore use the media information already attached to the
   * Message object (_data) and ask WhatsApp Web's own DownloadManager
   * to download + decrypt it.
   */
  private async downloadMediaDirect(
    message: Message,
    source: string,
  ): Promise<MessageMedia | null> {
    const rawMessage = message as RawMessage;
    const data = rawMessage._data;

    if (!data) {
      this.logger.warn(
        {
          source,
          messageId: this.getMessageSerializedId(message),
        },
        "[MEDIA] _data tidak tersedia",
      );

      return null;
    }

    /**
     * These values are required by DownloadManager.
     */
    if (
      !data.directPath ||
      !data.mediaKey ||
      !data.mimetype ||
      !data.type
    ) {
      this.logger.warn(
        {
          source,
          messageId: this.getMessageSerializedId(message),
          hasDirectPath: Boolean(data.directPath),
          hasMediaKey: Boolean(data.mediaKey),
          mimetype: data.mimetype,
          type: data.type,
        },
        "[MEDIA] Data media tidak lengkap untuk direct download",
      );

      return null;
    }

    try {
      const mediaInfo = {
        directPath: data.directPath,
        encFilehash: data.encFilehash,
        filehash: data.filehash,
        mediaKey: data.mediaKey,
        mediaKeyTimestamp: data.mediaKeyTimestamp,
        type: data.type,
        mimetype: data.mimetype,
      };

      const result = await this.client.pupPage.evaluate(
        async (media): Promise<DirectMediaResult> => {
          const downloadModule = window.require("WAWebDownloadManager");

          const downloadManager = downloadModule?.downloadManager;

          if (!downloadManager?.downloadAndMaybeDecrypt) {
            throw new Error(
              "WAWebDownloadManager.downloadAndMaybeDecrypt tidak tersedia",
            );
          }

          /**
           * Current WhatsApp Web download manager expects a QPL-like object.
           * These two methods are enough for media download compatibility.
           */
          const mockQpl = {
            addAnnotations() {
              return this;
            },

            addPoint() {
              return this;
            },
          };

          const decryptedMedia =
            await downloadManager.downloadAndMaybeDecrypt({
              directPath: media.directPath,
              encFilehash: media.encFilehash,
              filehash: media.filehash,
              mediaKey: media.mediaKey,
              mediaKeyTimestamp: media.mediaKeyTimestamp,
              type: media.type,
              mimetype: media.mimetype,
              signal: new AbortController().signal,
              downloadQpl: mockQpl,
            });

          /**
           * Normalize ArrayBuffer / Uint8Array / Blob-like result.
           */
          let arrayBuffer: ArrayBuffer;

          if (decryptedMedia instanceof Blob) {
            arrayBuffer = await decryptedMedia.arrayBuffer();
          } else if (decryptedMedia instanceof ArrayBuffer) {
            arrayBuffer = decryptedMedia;
          } else if (
            decryptedMedia &&
            decryptedMedia.buffer instanceof ArrayBuffer
          ) {
            const view = decryptedMedia as Uint8Array;

            arrayBuffer = view.buffer.slice(
              view.byteOffset,
              view.byteOffset + view.byteLength,
            );
          } else {
            throw new Error(
              "Format hasil download media tidak dikenali",
            );
          }

          const bytes = new Uint8Array(arrayBuffer);

          /**
           * Avoid String.fromCharCode(...bytes) on large images.
           */
          const chunkSize = 0x8000;
          let binary = "";

          for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(
              i,
              Math.min(i + chunkSize, bytes.length),
            );

            binary += String.fromCharCode(...chunk);
          }

          return {
            data: btoa(binary),
            mimetype: media.mimetype,
          };
        },
        mediaInfo,
      );

      if (!result?.data) {
        this.logger.warn(
          {
            source,
            messageId: this.getMessageSerializedId(message),
          },
          "[MEDIA] Direct download menghasilkan data kosong",
        );

        return null;
      }

      /**
       * MessageMedia constructor:
       *   new MessageMedia(mimetype, base64, filename)
       */
      return new MessageMedia(
        result.mimetype || data.mimetype,
        result.data,
        data.filename,
      );
    } catch (error) {
      this.logger.warn(
        {
          err: error,
          source,
          messageId: this.getMessageSerializedId(message),
          mimetype: data.mimetype,
          type: data.type,
          hasDirectPath: Boolean(data.directPath),
        },
        "[MEDIA] Direct media download gagal",
      );

      return null;
    }
  }

  /**
   * Download media with normal whatsapp-web.js method first,
   * then use the direct WhatsApp Web DownloadManager as fallback.
   */
  private async downloadMediaWithRetry(
    message: Message,
    source: string,
  ): Promise<MessageMedia | null> {
    /**
     * Fix `$1` -> `_serialized` before whatsapp-web.js accesses the ID.
     */
    this.normalizeMessageId(message);

    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const media = await message.downloadMedia();

        if (media) {
          this.logger.info(
            {
              source,
              attempt,
              mimetype: media.mimetype,
              filename: media.filename,
            },
            "[MEDIA] downloadMedia() berhasil",
          );

          return media;
        }

        this.logger.warn(
          {
            source,
            attempt,
            messageId: this.getMessageSerializedId(message),
          },
          "[MEDIA] downloadMedia() menghasilkan null",
        );
      } catch (error) {
        this.logger.warn(
          {
            err: error,
            source,
            attempt,
            messageId: this.getMessageSerializedId(message),
            messageIdDollarOne: (message.id as CompatibleMessageId).$1,
          },
          "[MEDIA] downloadMedia() gagal",
        );
      }

      /**
       * Retry normal download first.
       */
      if (attempt < maxAttempts) {
        await new Promise<void>((resolve) =>
          setTimeout(resolve, attempt * 700),
        );
      }
    }

    /**
     * Normal whatsapp-web.js downloader failed.
     *
     * Try WhatsApp Web's own DownloadManager directly.
     */
    this.logger.info(
      {
        source,
        messageId: this.getMessageSerializedId(message),
      },
      "[MEDIA] Mencoba direct DownloadManager fallback",
    );

    const directMedia = await this.downloadMediaDirect(message, source);

    if (directMedia) {
      this.logger.info(
        {
          source,
          mimetype: directMedia.mimetype,
          filename: directMedia.filename,
        },
        "[MEDIA] Direct DownloadManager berhasil",
      );

      return directMedia;
    }

    this.logger.warn(
      {
        source,
        messageId: this.getMessageSerializedId(message),
      },
      "[MEDIA] Semua metode download media gagal",
    );

    return null;
  }

  /**
   * Current chatter have quoted message that have media in it
   */
  async hasQuotedMessageMedia() {
    const hasQuotedMessage = this.incomingMessage.hasQuotedMsg;

    if (!hasQuotedMessage) {
      return {
        hasQuotedMessage: false,
        quotedMessage: undefined,
        quotedMessageMedia: undefined,
        mediaDownloadError: false,
        quoteLookupError: false,
      };
    }

    /**
     * Normalize current message before whatsapp-web.js calls getQuotedMessage().
     */
    this.normalizeMessageId(this.incomingMessage);

    let quotedMessage: Message;

    try {
      quotedMessage = await this.incomingMessage.getQuotedMessage();

      /**
       * The quoted Message may itself have the new `$1` ID structure.
       */
      this.normalizeMessageId(quotedMessage);
    } catch (error) {
      this.logger.warn(
        {
          err: error,
          currentMessageId: this.getMessageSerializedId(
            this.incomingMessage,
          ),
        },
        "[MEDIA] Gagal membuka pesan yang dibalas",
      );

      return {
        hasQuotedMessage,
        quotedMessage: undefined,
        quotedMessageMedia: null,
        mediaDownloadError: false,
        quoteLookupError: true,
      };
    }

    if (!quotedMessage.hasMedia) {
      return {
        quotedMessage,
        hasQuotedMessage,
        quotedMessageMedia: null,
        mediaDownloadError: false,
        quoteLookupError: false,
      };
    }

    const quotedMessageMedia = await this.downloadMediaWithRetry(
      quotedMessage,
      "quoted message",
    );

    return {
      quotedMessage,
      hasQuotedMessage,
      quotedMessageMedia,
      mediaDownloadError: !quotedMessageMedia,
      quoteLookupError: false,
    };
  }

  /**
   * Current chatter have message media in it
   */
  async hasMediaInCurrentChat() {
    const hasMedia = this.incomingMessage.hasMedia;
    const currentChat = this.incomingMessage;

    if (!hasMedia) {
      return {
        hasMedia,
        currentChat,
        currentMedia: undefined,
        mediaDownloadError: false,
      };
    }

    /**
     * Normalize the current message ID first.
     */
    this.normalizeMessageId(this.incomingMessage);

    const currentMedia = await this.downloadMediaWithRetry(
      this.incomingMessage,
      "current message",
    );

    return {
      hasMedia,
      currentChat,
      currentMedia,
      mediaDownloadError: !currentMedia,
    };
  }

  /**
   * User property setter
   * @param user An user document by phone number
   */
  setUserAndGameProperty(user: User, gameProperty: UserGameProperty) {
    this.user = user;
    this.gameProperty = gameProperty;
  }

  /**
   * Is current chatter sending message via DM chat
   *
   * WhatsApp now uses @lid for some direct chats.
   */
  get isDMChat() {
    return (
      this.message.from.endsWith("@c.us") ||
      this.message.from.endsWith("@lid")
    );
  }

  /**
   * Is current chatter sending message via Group chat
   */
  get isGroupChat() {
    return this.message.from.endsWith("@g.us");
  }

  /**
   * Is current chatter joining a game session
   */
  get isJoiningGame() {
    return this.gameProperty?.isJoiningGame;
  }
}