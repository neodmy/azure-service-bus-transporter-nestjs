import {ClientProxy, ReadPacket, WritePacket} from '@nestjs/microservices';
import {ServiceBusClient, ServiceBusMessage, ServiceBusSender} from '@azure/service-bus';
import {ClientOptions} from './client-options.interface';

export class AzureServiceBusClient extends ClientProxy {
  private client: ServiceBusClient;
  private senders: Map<string, ServiceBusSender>;

  constructor(private readonly options: ClientOptions) {
    super();
    this.initializeSerializer(options);
    this.initializeDeserializer(options);
    this.senders = new Map<string, ServiceBusSender>();
  }

  connect(): Promise<ServiceBusClient> {
    if (this.client) {
      return Promise.resolve(this.client);
    }

    this.client = new ServiceBusClient(this.options.connectionString);
    return Promise.resolve(this.client);
  }

  async close(): Promise<void> {
    for (let sender of this.senders.values()) {
      await sender.close();
    }
    if (this.client) {
      await this.client.close();
    }
    this.client = null;
    this.senders = new Map<string, ServiceBusSender>();
  }

  private getSender(pattern: string) {
    if (this.senders.has(pattern)) return this.senders.get(pattern);
    const sender = this.client.createSender(pattern);
    this.senders.set(pattern, sender);
    return sender;
  }

  private buildMessage(packet: Record<string, any>): ServiceBusMessage {
    let body = packet.body;
    const {
      subject,
      contentEncoding,
      applicationProperties = {},
      scheduledEnqueueTimeUtc,
      ...messageFields
    } = packet.options;

    return {
      subject,
      applicationProperties: {
        contentEncoding,
        attemptCount: 0,
        ...applicationProperties,
      },
      scheduledEnqueueTimeUtc,
      ...messageFields,
      body,
    }
  }

  protected publish(packet: ReadPacket, callback: (packet: WritePacket) => void): () => void {
    // request/response pattern not used in this module
    return function () {
    };
  }

  protected async dispatchEvent(packet: ReadPacket): Promise<any> {
    const pattern = this.normalizePattern(packet.pattern);
    const serializedPacket = this.serializer.serialize(packet);
    const sender = this.getSender(pattern);
    const message = this.buildMessage(serializedPacket);
    if(message.scheduledEnqueueTimeUtc) {
      await sender.scheduleMessages(message, message.scheduledEnqueueTimeUtc);
    } else {
      await sender.sendMessages(message);
    }
  }
}
