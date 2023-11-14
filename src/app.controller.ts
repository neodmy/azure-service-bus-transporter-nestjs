import {Controller, Get, Inject} from '@nestjs/common';
import {AppService} from './app.service';
import {Ctx, EventPattern, Payload} from '@nestjs/microservices';
import {
  AzureServiceBusClient,
  ServiceBusReceivedMessage,
  AzureServiceBusContext,
} from './azure-service-bus-transporter';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Inject('AzureServiceBusClient') private readonly azureServiceBusClient: AzureServiceBusClient,
  ) {
  }

  @Get('/publish')
  async sendMessage() {
    await this.azureServiceBusClient.emit('test-topic', { body: { foo: 'bar' }})
    console.log('message sent')
  }

  @EventPattern(
    'test-topic',
    {
      subscriptionName: 'test-sub',
      errorStrategy: {type: 'exponentialBackoff'}
    }
  )
  async getHello(@Payload() data: ServiceBusReceivedMessage, @Ctx() context: AzureServiceBusContext): Promise<string> {
    return this.appService.getHello();
  }
}
