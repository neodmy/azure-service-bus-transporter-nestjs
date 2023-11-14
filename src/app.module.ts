import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClientsModule } from '@nestjs/microservices';
import { AzureServiceBusClient} from './utils/client-proxy';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'AzureServiceBusClient',
        customClass: AzureServiceBusClient,
        options: {
          connectionString: process.env.SERVICE_BUS_CONNECTION_STRING,
        }
      }
    ])
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
