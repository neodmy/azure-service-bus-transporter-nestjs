import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClientsModule } from '@nestjs/microservices';
import { AzureServiceBusClient } from './azure-service-bus-transporter';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'AzureServiceBusClient',
        customClass: AzureServiceBusClient,
        options: {
          connectionString: process.env.SERVICE_BUS_CONNECTION_STRING,
        },
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
