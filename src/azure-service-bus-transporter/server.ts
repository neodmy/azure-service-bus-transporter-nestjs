import {CustomTransportStrategy, Server} from '@nestjs/microservices';
import {
  ServiceBusClient,
  ServiceBusReceiver,
  ServiceBusReceivedMessage,
  ProcessErrorArgs,
} from '@azure/service-bus';
import * as moment from 'moment';
import {ClientOptions} from './client-options.interface';
import {AzureServiceBusContext} from './context';

type Subscription = { close(): Promise<void> }

enum ErrorStrategies {
  DeadLetter = 'deadLetter',
  ExponentialBackoff = 'exponentialBackoff'
}

enum ExponentialBackoffMeasure {
  Minutes = 'minutes',
  Seconds = 'seconds'
}

type exponentialBackoffOptions = {
  maxAttempts: number
  backoffFactor: number
  measure: ExponentialBackoffMeasure
}

type ErrorStrategy = {
  type: ErrorStrategies,
  options?: exponentialBackoffOptions
}

type HandlerExtra = {
  subscriptionName: string
  errorStrategy: ErrorStrategy
}

export type { ServiceBusReceivedMessage } from '@azure/service-bus';

export class AzureServiceBusServer
  extends Server
  implements CustomTransportStrategy {

  private client: ServiceBusClient;
  private receivers: Map<string, ServiceBusReceiver>;
  private subscriptions: Map<string, Subscription>;

  constructor(private readonly options: ClientOptions) {
    super();
    this.receivers = new Map<string, ServiceBusReceiver>();
    this.subscriptions = new Map<string, Subscription>();
  }

  private bindHandlers() {
    this.messageHandlers.forEach((handler, topicName) => {
      const {subscriptionName, errorStrategy} = handler.extras as HandlerExtra;
      const receiver = this.client.createReceiver(topicName, subscriptionName);
      this.receivers.set(topicName, receiver);
      const context = new AzureServiceBusContext(receiver);
      const subscription = receiver.subscribe(
        {
          processMessage: async (message: ServiceBusReceivedMessage): Promise<void> => {
            try {
              await handler(message, context);
              // @ts-ignore
              if (!message.delivery.remote_settled) await receiver.completeMessage(message);
            } catch (e) {
              if (errorStrategy.type === ErrorStrategies.ExponentialBackoff) {
                await this.handleExponentialBackoff(topicName, message, errorStrategy.options);
              } else {
                await receiver.deadLetterMessage(
                  message,
                  {
                    deadLetterReason: 'DeadLetterError',
                    deadLetterErrorDescription: e.message,
                  });
              }
            }
          },
          async processError(args: ProcessErrorArgs): Promise<void> {
            console.log({error: args});
          },
        },
        {autoCompleteMessages: false},
      );
      this.subscriptions.set(`${topicName}${subscriptionName}`, subscription);
    })
  }

  private async cleanUp() {
    for (let subscription of this.subscriptions.values()) {
      await subscription.close();
    }
    this.subscriptions = new Map<string, Subscription>();
    for (let receiver of this.receivers.values()) {
      await receiver.close();
    }
    this.receivers = new Map<string, ServiceBusReceiver>();
    await this.client.close();
    this.client = null;
  }

  private async handleExponentialBackoff(
    topic: string,
    message: ServiceBusReceivedMessage,
    options: exponentialBackoffOptions = {
      maxAttempts: 10,
      backoffFactor: 2,
      measure: ExponentialBackoffMeasure.Minutes,
    },
  ): Promise<void> {
    const currentAttempts = message.applicationProperties.attemptCount as number || 0;
    const limitReached = (currentAttempts + 1) === options.maxAttempts;
    const receiver = this.receivers.get(topic);

    if (limitReached) {
      await receiver.deadLetterMessage(
        message,
        {
          deadLetterReason: 'ExponentialBackoffMaxAttempts',
          deadLetterErrorDescription: `The message has reached the maximum number of attempts: ${options.maxAttempts}`,
        },
      );
    } else {
      const nextAttempt = options.backoffFactor ** currentAttempts;
      const scheduledTime = moment().add(nextAttempt, options.measure).toDate().getTime();

      const sender = this.client.createSender(topic);
      await sender.scheduleMessages(
        [{...message, applicationProperties: {...message.applicationProperties, attemptCount: currentAttempts + 1}}],
        new Date(scheduledTime),
      );
      await receiver.completeMessage(message);
      await sender.close();
    }

    return Promise.resolve();
  }

  listen(callback: () => void) {
    this.client = new ServiceBusClient(this.options.connectionString);
    this.bindHandlers();
    callback();
  }

  async close() {
    await this.cleanUp();
  }
}
