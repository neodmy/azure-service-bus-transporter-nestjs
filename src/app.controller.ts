import {Controller, Get, Inject} from '@nestjs/common';
import {AppService} from './app.service';
import {EventPattern} from '@nestjs/microservices';
import {AzureServiceBusPayload} from './utils/server';
import {AzureServiceBusClient} from './azure-service-bus-transporter';

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
  async getHello(payload: AzureServiceBusPayload): Promise<string> {
    console.log(payload.message);
    return this.appService.getHello();
  }
}
